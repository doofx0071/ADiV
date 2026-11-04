#!/usr/bin/env python3
"""Hash and write a v1 ADiV map-pack manifest after map/style assets exist."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import sqlite3
import sys
from pathlib import Path, PurePosixPath
from typing import Any

PACK_ID = re.compile(r"^ph-[a-z0-9]+(?:-[a-z0-9]+)*$")
SEMVER = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
REMOTE_URL = re.compile(r"^(?:https?:)?//", re.IGNORECASE)
MAP_PLACEHOLDER = "pmtiles://__ADIV_MAP_URI__"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def md5(path: Path) -> str:
    digest = hashlib.md5(usedforsecurity=False)
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_relative_path(value: str) -> str:
    path = PurePosixPath(value)
    if not value or not path.parts or path.is_absolute() or "\\" in value or ":" in value or any(part in ("", ".", "..") for part in path.parts):
        raise ValueError(f"Pack asset path must be a safe relative path: {value}")
    return path.as_posix()


def reject_remote_urls(value: Any) -> None:
    if isinstance(value, str):
        if REMOTE_URL.match(value):
            raise ValueError(f"The local style contains a network URL: {value}")
        if value.startswith(("pmtiles://", "file://", "asset://")) and "__ADIV_" not in value:
            raise ValueError("The local style must use ADiV pack placeholders for local files.")
    elif isinstance(value, list):
        for child in value:
            reject_remote_urls(child)
    elif isinstance(value, dict):
        for child in value.values():
            reject_remote_urls(child)


def verify_style(path: Path) -> None:
    style = json.loads(path.read_text(encoding="utf-8"))
    if style.get("version") != 8:
        raise ValueError("The local style must use MapLibre style version 8.")
    sources = style.get("sources")
    if not isinstance(sources, dict) or len(sources) != 2:
        raise ValueError("The local style must contain one vector source and one indexed POI source.")
    vector_sources = [source for source in sources.values() if source.get("type") == "vector"]
    poi_sources = [source for source in sources.values() if source.get("type") == "geojson"]
    if len(vector_sources) != 1 or vector_sources[0].get("url") != MAP_PLACEHOLDER or vector_sources[0].get("tiles"):
        raise ValueError("The local style must read one vector PMTiles source through the ADiV placeholder.")
    if len(poi_sources) != 1 or poi_sources[0].get("data") != "__ADIV_POI_URI__":
        raise ValueError("The local style must read the indexed OSM POI file through the ADiV placeholder.")
    if style.get("glyphs") != "__ADIV_GLYPHS_URI__/{fontstack}/{range}.pbf":
        raise ValueError("The local style must use its packaged glyph files.")
    if style.get("sprite") != "__ADIV_SPRITE_URI__":
        raise ValueError("The local style must use its packaged sprite files.")
    layer_ids = {layer.get("id") for layer in style.get("layers", []) if isinstance(layer, dict)}
    if not {"street-labels", "search-poi-labels"}.issubset(layer_ids):
        raise ValueError("The local style must render street names and indexed place/business labels.")
    reject_remote_urls(style)


def verify_search_index(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        row = connection.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='places_fts'"
        ).fetchone()
        if not row or "using fts5" not in (row[0] or "").lower():
            raise ValueError("The search database must contain the places_fts FTS5 table.")
        connection.execute(
            "SELECT name, aliases, category, admin, lat, lon FROM places_fts WHERE places_fts MATCH ? LIMIT 1",
            ('"adivpackprobe"*',),
        ).fetchone()
        version = connection.execute("PRAGMA user_version").fetchone()[0]
        if version != 2:
            raise ValueError(f"search index user_version must be 2, found {version}")
    except sqlite3.OperationalError as error:
        raise ValueError(f"Could not query the FTS5 search index: {error}") from error
    finally:
        connection.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("pack_directory", type=Path)
    parser.add_argument("--source-pbf", type=Path, required=True)
    parser.add_argument("--pack-id", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--region", choices=("davao", "mindanao", "philippines"), required=True)
    parser.add_argument("--data-date", required=True, help="YYYY-MM-DD date represented by the source extract")
    parser.add_argument("--minimum-app-version", default="1.3.2")
    parser.add_argument("--coverage", nargs=4, type=float, metavar=("WEST", "SOUTH", "EAST", "NORTH"))
    parser.add_argument("--map-path", default="map/davao.pmtiles")
    parser.add_argument("--search-path", default="search/places.sqlite")
    parser.add_argument("--poi-path", default="search/pois.geojson")
    parser.add_argument("--style-path", default="style/style.json")
    parser.add_argument("--glyphs-dir", default="style/glyphs")
    parser.add_argument("--sprite-base", default="style/sprites/sprite")
    parser.add_argument("--force", action="store_true", help="Replace an existing manifest.json")
    args = parser.parse_args()

    if not PACK_ID.fullmatch(args.pack_id):
        raise ValueError("pack-id must start with ph- and use lowercase letters, digits, or hyphens.")
    if not SEMVER.fullmatch(args.version) or not SEMVER.fullmatch(args.minimum_app_version):
        raise ValueError("version and minimum-app-version must use three-part semantic versions.")
    try:
        dt.date.fromisoformat(args.data_date)
    except (TypeError, ValueError) as error:
        raise ValueError("data-date must use YYYY-MM-DD.") from error
    source_lock_path = Path(__file__).with_name("source-lock.json")
    source_lock = json.loads(source_lock_path.read_text(encoding="utf-8"))
    source_pbf = args.source_pbf.resolve(strict=True)
    if source_pbf.stat().st_size != source_lock["bytes"] or md5(source_pbf) != source_lock["md5"].lower():
        raise ValueError("The provided OSM PBF does not match the locked Geofabrik snapshot.")
    if args.data_date != source_lock["snapshotDate"]:
        raise ValueError("data-date must match the locked OSM snapshot; refresh source-lock.json to use newer data.")
    assets = {
        "map": safe_relative_path(args.map_path),
        "search": safe_relative_path(args.search_path),
        "poi": safe_relative_path(args.poi_path),
        "style": safe_relative_path(args.style_path),
        "glyphsDir": safe_relative_path(args.glyphs_dir),
        "sprite": safe_relative_path(args.sprite_base),
    }

    root = args.pack_directory.resolve(strict=True)
    manifest_path = root / "manifest.json"
    if manifest_path.exists() and not args.force:
        raise FileExistsError("manifest.json already exists; pass --force only when intentionally rebuilding it.")
    if args.region != "davao" and args.coverage is None:
        raise ValueError("Provide an explicit --coverage for Mindanao or Philippines packs.")
    coverage = args.coverage if args.coverage is not None else [125.2, 6.8, 125.75, 7.45]
    west, south, east, north = coverage
    if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        raise ValueError("coverage must be valid west,south,east,north coordinates.")

    map_path = root / assets["map"]
    search_path = root / assets["search"]
    poi_path = root / assets["poi"]
    style_path = root / assets["style"]
    licenses_path = root / "style/LICENSES.md"
    glyphs_dir = root / assets["glyphsDir"]
    sprite_json = root / f"{assets['sprite']}.json"
    sprite_png = root / f"{assets['sprite']}.png"
    for path in (map_path, search_path, poi_path, style_path, licenses_path, sprite_json, sprite_png):
        if not path.is_file():
            raise FileNotFoundError(f"Required pack file is missing: {path.relative_to(root)}")
    if not glyphs_dir.is_dir() or not any(path.is_file() for path in glyphs_dir.rglob("*.pbf")):
        raise ValueError("The style/glyphs directory must contain at least one packaged .pbf range.")

    verify_style(style_path)
    verify_search_index(search_path)

    file_entries: list[dict[str, Any]] = []
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise ValueError(f"Pack folders cannot contain symbolic links: {path.relative_to(root)}")
        if not path.is_file() or path == manifest_path:
            continue
        relative = path.relative_to(root).as_posix()
        file_entries.append({"path": relative, "sha256": sha256(path), "bytes": path.stat().st_size})
    if len(file_entries) < 7:
        raise ValueError("The map pack does not contain its map, search, style, glyph, sprite, and license files.")

    manifest = {
        "format": "adiv-offline-pack",
        "manifestVersion": 1,
        "packId": args.pack_id,
        "version": args.version,
        "name": args.name,
        "region": args.region,
        "dataDate": args.data_date,
        "minimumAppVersion": args.minimum_app_version,
        "attribution": "© OpenStreetMap contributors · Data available under ODbL-1.0",
        "source": {
            "provider": source_lock["provider"],
            "pbfDate": source_lock["snapshotDate"],
            "pbfMd5": source_lock["md5"],
        },
        "licenses": [
            {"component": "OpenStreetMap data and coastline polygons", "license": "ODbL-1.0", "attribution": "© OpenStreetMap contributors"},
            {"component": "Shortbread 1.1 tile schema", "license": "CC0-1.0"},
            {"component": "Shortbread Tilemaker configuration", "license": "FTWPL"},
            {"component": "Noto Sans font data", "license": "OFL-1.1"},
            {"component": "ADiV offline style and transparent sprite", "license": "CC0-1.0"},
        ],
        "coverage": coverage,
        "mapSchema": "shortbread-1.1",
        "searchSchemaVersion": 2,
        "assets": assets,
        "files": file_entries,
    }
    temporary = root / f".manifest-{os.getpid()}.tmp"
    try:
        temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        os.replace(temporary, manifest_path)
    finally:
        if temporary.exists():
            temporary.unlink()
    print(f"Wrote {manifest_path} with {len(file_entries)} checksummed files.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"offline pack manifest failed: {error}", file=sys.stderr)
        raise SystemExit(1)
