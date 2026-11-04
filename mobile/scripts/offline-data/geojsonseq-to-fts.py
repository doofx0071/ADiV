#!/usr/bin/env python3
"""Build the versioned ADiV place/street index from osmium GeoJSONSeq output."""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from pathlib import Path
from typing import Any, Iterator

PLACE_TYPES = {
    "city",
    "town",
    "village",
    "hamlet",
    "suburb",
    "neighbourhood",
    "quarter",
    "locality",
    "isolated_dwelling",
}

POI_TAGS = (
    "amenity",
    "office",
    "shop",
    "leisure",
    "tourism",
    "healthcare",
    "craft",
    "historic",
    "emergency",
    "man_made",
    "public_transport",
    "railway",
    "aeroway",
)


def iter_features(path: Path) -> Iterator[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as source:
        for line_number, line in enumerate(source, start=1):
            line = line.strip().lstrip("\x1e")
            if not line:
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f"Invalid GeoJSONSeq record on line {line_number}: {error}") from error
            if isinstance(value, dict) and value.get("type") == "Feature":
                yield value


def coordinate_pairs(value: Any) -> Iterator[tuple[float, float]]:
    if not isinstance(value, list):
        return
    if len(value) >= 2 and isinstance(value[0], (int, float)) and isinstance(value[1], (int, float)):
        yield float(value[0]), float(value[1])
        return
    for child in value:
        yield from coordinate_pairs(child)


def choose_name(properties: dict[str, Any]) -> str | None:
    direct = properties.get("name")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()
    for key in ("name:en", "name:tl", "name:ceb"):
        value = properties.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    for key in sorted(key for key in properties if key.startswith("name:")):
        value = properties.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def category_for(properties: dict[str, Any]) -> str | None:
    for key in POI_TAGS:
        value = properties.get(key)
        if isinstance(value, str) and value:
            return f"{key}:{value}"
    place = properties.get("place")
    if isinstance(place, str) and place in PLACE_TYPES:
        return f"place:{place}"
    highway = properties.get("highway")
    if isinstance(highway, str) and highway:
        return f"road:{highway}"
    return None


def admin_for(properties: dict[str, Any]) -> str | None:
    values: list[str] = []
    for key in (
        "addr:street",
        "addr:neighbourhood",
        "addr:suburb",
        "addr:barangay",
        "addr:district",
        "addr:city",
        "addr:province",
        "addr:state",
        "is_in:city",
        "is_in:state",
        "is_in",
    ):
        value = properties.get(key)
        if isinstance(value, str) and value.strip() and value.strip() not in values:
            values.append(value.strip())
    return ", ".join(values) or None


def aliases_for(name: str) -> str:
    """Index a compact form as well, so joined queries match spaced names."""
    compact = "".join(character for character in name if character.isalnum())
    return compact if compact.casefold() != name.casefold() else ""


def place_center(feature: dict[str, Any]) -> tuple[float, float] | None:
    geometry = feature.get("geometry")
    if not isinstance(geometry, dict):
        return None
    coordinates = list(coordinate_pairs(geometry.get("coordinates")))
    if not coordinates:
        return None
    lon = sum(pair[0] for pair in coordinates) / len(coordinates)
    lat = sum(pair[1] for pair in coordinates) / len(coordinates)
    if not (-180 <= lon <= 180 and -90 <= lat <= 90):
        return None
    return lat, lon


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("geojsonseq", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(args.output.suffix + ".tmp")
    poi_output = args.output.with_name("pois.geojson")
    poi_temporary = poi_output.with_suffix(poi_output.suffix + ".tmp")
    if temporary.exists():
        temporary.unlink()
    if poi_temporary.exists():
        poi_temporary.unlink()
    connection = sqlite3.connect(temporary)
    inserted = 0
    # Keep the legacy POI source asset required by the pack manifest, but do
    # not put nationwide features in it. Map labels come from the bounded
    # Shortbread `pois` vector layer; FTS5 remains the complete place search.
    poi_temporary.write_text('{"type":"FeatureCollection","features":[]}\n', encoding="utf-8")
    try:
        connection.execute("PRAGMA journal_mode = DELETE")
        connection.execute("PRAGMA synchronous = FULL")
        connection.execute("CREATE TABLE seen_objects (object_id TEXT PRIMARY KEY)")
        connection.execute(
            """CREATE VIRTUAL TABLE places_fts USING fts5(
                 name, aliases, category, admin, lat UNINDEXED, lon UNINDEXED,
                 tokenize = 'unicode61 remove_diacritics 2'
               )"""
        )
        connection.execute("BEGIN")
        for feature in iter_features(args.geojsonseq):
            properties = feature.get("properties")
            if not isinstance(properties, dict):
                continue
            name = choose_name(properties)
            category = category_for(properties)
            center = place_center(feature)
            if not name or not category or center is None:
                continue
            object_id = f"{properties.get('@type', '')}/{properties.get('@id', '')}"
            if object_id == "/":
                object_id = f"{category}/{name}/{center[0]:.6f}/{center[1]:.6f}"
            inserted_object = connection.execute(
                "INSERT OR IGNORE INTO seen_objects(object_id) VALUES (?)", (object_id,)
            ).rowcount
            if not inserted_object:
                continue
            connection.execute(
                "INSERT INTO places_fts(name, aliases, category, admin, lat, lon) VALUES (?, ?, ?, ?, ?, ?)",
                (name, aliases_for(name), category, admin_for(properties), center[0], center[1]),
            )
            inserted += 1
            if inserted % 5000 == 0:
                connection.commit()
                connection.execute("BEGIN")
        connection.commit()
        connection.execute("DROP TABLE seen_objects")
        connection.execute("INSERT INTO places_fts(places_fts) VALUES ('optimize')")
        connection.execute("PRAGMA user_version = 2")
        connection.commit()
    except Exception:
        connection.rollback()
        connection.close()
        if temporary.exists():
            temporary.unlink()
        if poi_temporary.exists():
            poi_temporary.unlink()
        raise
    connection.close()
    os.replace(temporary, args.output)
    os.replace(poi_temporary, poi_output)
    print(f"Built {args.output} with {inserted:,} searchable features; map POI labels come from Shortbread vector tiles.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # CLI failure should be concise and actionable.
        print(f"offline search build failed: {error}", file=sys.stderr)
        raise SystemExit(1)
