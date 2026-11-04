# Build Android offline packs on a PC

The phone imports a **folder** whose root contains `manifest.json`. The Android app copies it into app-private storage, verifies every file, checks the local Shortbread style and SQLite FTS5 index, then switches the active version. Older versions stay installed for rollback.

## Locked inputs and Davao first build

`source-lock.json` pins the Geofabrik Philippines extract dated 2026-10-31 by URL, size, and published MD5. It also records the exact Shortbread Tilemaker commit and the current HTTP ETag, size, and last-modified date of its OSM-derived coastline inputs. The auxiliary server metadata is a change detector, not a cryptographic signature; the fetch script records SHA-256 after download beside the data. Review the upstream snapshot and record the SHA-256 values in the build log when refreshing data.

Fetch the large source inputs only on the build PC:

```powershell
.\mobile\scripts\offline-data\fetch-pinned-philippines.ps1
.\mobile\scripts\offline-data\fetch-pinned-shortbread-water.ps1
```

Use Osmium Tool 1.19.0, Tilemaker 3.2.0, and PMTiles CLI 1.31.2. Clone `shortbread-tiles/shortbread-tilemaker` and check out exactly `d1bafac78056cc7e40f3f83b84a4496227f62508`. Extract the locked water ZIPs into that checkout's `data/` folder and use `ogr2ogr` to project `simplified-water-polygons-split-3857` into the `simplified-water-polygons-split-4326` directory expected by the pinned configuration. Do not run the upstream `get-shapefiles.sh` unchanged: it downloads mutable URLs without checking the source lock.

Example commands (run from the repository root; output paths are disposable build outputs):

```powershell
osmium extract --bbox 125.2,6.8,125.75,7.45 --strategy complete_ways --set-bounds --output work/offline-data/davao.osm.pbf work/offline-data/philippines-20261031.osm.pbf
osmium export --attributes type,id --output-format geojsonseq --output work/offline-data/davao.geojsons work/offline-data/davao.osm.pbf
python mobile/scripts/offline-data/geojsonseq-to-fts.py work/offline-data/davao.geojsons work/offline-data/pack/search/places.sqlite
pmtiles verify work/offline-data/pack/map/davao.pmtiles
```

Tilemaker resolves the config's `data/...` coastline paths from its working directory. Run it from the Shortbread checkout so those paths use the locked local coastline inputs:

```powershell
Push-Location work/offline-data/shortbread-tilemaker
try {
  tilemaker --config config.json --process process.lua --bbox 125.2,6.8,125.75,7.45 --input ../davao.osm.pbf --output ../pack/map/davao.pmtiles
} finally {
  Pop-Location
}
```

The Shortbread settings include a demo TileJSON URL in metadata; it is not used by the local style. Keep the app style source pointed only at the packaged PMTiles file.

## Style, glyphs, sprites, and manifest

`geojsonseq-to-fts.py` writes the complete searchable place/business set to the SQLite FTS5 index and a tiny empty `search/pois.geojson` compatibility asset. Do not put nationwide features in GeoJSON: MapLibre would ingest the entire file into one in-memory source. POI map labels use the bounded Shortbread `pois` vector layer from PMTiles; search remains independent in SQLite. `style-template.json` is an authored Shortbread 1.1 MapLibre style with the PMTiles vector source and a tiny local GeoJSON compatibility source plus local glyph/sprite placeholders. Put it at `style/style.json`, package the `Noto Sans Regular` PBF ranges under `style/glyphs/`, and include the font's OFL license in `style/LICENSES.md`. `source-lock.json` pins MapLibre Font Maker and the Google Fonts repository revisions; check them out at those commits, build the Font Maker command line with CMake, copy the locked Noto Sans variable TTF and OFL license from the Google Fonts checkout, then run `font-maker --name "Noto Sans Regular" style/glyphs <path-to-NotoSans[wdth,wght].ttf>`. Do not use a hosted glyph endpoint. The style template does not include a third-party style, font, or icon artwork.

The current style has no icon layers. `make-empty-sprite.py style/sprites` creates the valid transparent sprite pair needed by the style contract without external assets. If icon artwork is added later, replace that pair with licensed local sprites and record each source and license in the pack.

After all assets exist, create the versioned manifest and SHA-256 checksums:

```powershell
python mobile/scripts/offline-data/build-manifest.py work/offline-data/pack --source-pbf work/offline-data/philippines-20261031.osm.pbf --pack-id ph-davao --version 1.0.1 --name "Davao sample" --region davao --data-date 2026-10-31
```

`build-manifest.py` refuses incomplete styles, missing map/search/POI/glyph/sprite/license files, network URLs, non-FTS5 search databases, and unsupported regions. The example manifest is a non-installable template. A checksum checks integrity after packaging; it does not authenticate who built a pack.

## Release gates

No generated map pack is checked into the repository. First prove local PMTiles through the locked MapLibre React Native build after a cold restart in airplane mode and capture zero external map/search requests. If it fails, evaluate a legally generated pack through MapLibre's documented offline flow. Then import the Davao sample and test style, search, corrupt-file rejection, low-storage failure, and rollback. Only after that proof should the Davao/Mindanao and nationwide data snapshots be built.

There is no validated local router. The app uses explicitly online OSRM guidance and discloses that it follows a car profile, needs internet, and may mis-handle ferries or motorcycle access. Do not add a graph to a pack until a native routing module passes a real Android route test.

Show `© OpenStreetMap contributors` and state that OSM-derived database data is available under ODbL-1.0. The `LICENSES.md` and manifest must list the Shortbread Tilemaker configuration (FTWPL), OSM coastline data (ODbL-1.0), tile schema, font, style, and any additional assets. No paid map service or public tile scraping is part of this pipeline.
