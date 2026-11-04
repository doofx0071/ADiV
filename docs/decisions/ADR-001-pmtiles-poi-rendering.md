# ADR-001: Render Nationwide POIs from PMTiles Vector Tiles

## Status

Proposed; pack v1.0.1 is prepared and physical-device validation is pending.

## Date

2026-11-03

## Context

On the Xiaomi test device, APK 1.3.7 rendered the nationwide map and returned local search results in Airplane mode, but the map was sluggish and Android closed the app. Android exit history recorded a native crash at 1.5 GB RSS and a later Java exception at 5.6 GB RSS. The prior map style loaded a 68.7 MB nationwide GeoJSON file containing roughly 365,000 POIs as a single MapLibre source. The Shortbread PMTiles already has a named `pois` vector layer at zoom 14.

## Decision

Use the PMTiles `pois` vector layer for visible map dots and labels. Keep the complete nationwide place/business search index in SQLite FTS5. Emit only a tiny empty GeoJSON file to preserve the existing pack manifest and style-source contract until that contract can be versioned separately.

## Alternatives Considered

### Keep the nationwide GeoJSON source

Rejected for the pack: MapLibre must ingest a dense nationwide source even when only a small viewport is visible, which matches the observed memory-growth symptom.

### Limit map labels to a small selection of GeoJSON features

Rejected: it adds a second, lossy POI dataset and still duplicates map features already encoded in PMTiles. The existing vector source is viewport/tile bounded.

### Remove the GeoJSON source contract immediately

Deferred: the current validator, manifest, and Android importer require a POI asset and GeoJSON source. A format migration would require an app update and is unnecessary for this pack-only mitigation.

## Consequences

- The map renderer requests POIs from the same local PMTiles archive and evaluates only rendered vector tiles for the viewport.
- Place/business text search remains backed by the unchanged full FTS5 index.
- POI map labels follow the Shortbread tile schema and zoom range; search records can be more complete than labels visible on the map.
- The package is about 68.7 MB smaller because the full duplicate GeoJSON is removed.
- The hypothesis is not considered validated until the user imports v1.0.1 and retests the Xiaomi in Airplane mode. Keep v1.0.0 for rollback until then.
