#!/usr/bin/env python3
"""Create the valid transparent sprite pair used by styles without icon layers."""

from __future__ import annotations

import argparse
import json
import struct
import zlib
from pathlib import Path


def png_chunk(kind: bytes, data: bytes) -> bytes:
    checksum = zlib.crc32(kind + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", checksum)


def transparent_png() -> bytes:
    signature = b"\x89PNG\r\n\x1a\n"
    header = struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0)
    image_data = zlib.compress(b"\x00\x00\x00\x00\x00")
    return signature + png_chunk(b"IHDR", header) + png_chunk(b"IDAT", image_data) + png_chunk(b"IEND", b"")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("sprite_directory", type=Path)
    args = parser.parse_args()
    args.sprite_directory.mkdir(parents=True, exist_ok=True)
    json_path = args.sprite_directory / "sprite.json"
    png_path = args.sprite_directory / "sprite.png"
    if json_path.exists() or png_path.exists():
        raise FileExistsError("Sprite files already exist; refusing to replace them.")
    json_path.write_text(json.dumps({}, separators=(",", ":")) + "\n", encoding="utf-8")
    png_path.write_bytes(transparent_png())
    print(f"Created empty sprite pair in {args.sprite_directory}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
