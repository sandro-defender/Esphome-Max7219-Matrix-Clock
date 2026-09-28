#!/usr/bin/env python3
"""Rasterise the repository fonts for the web configurator preview.

The configurator shows the *real* glyphs the firmware draws, so the bitmaps it
paints have to come from the same font files and the same sizes the ESPHome
configuration compiles. This script is therefore driven by
``packages/fonts_local.yaml`` (ids, files, sizes, glyph sets) instead of a
second list that could drift.

    python3 scripts/generate_glyphs.py            # rewrite src/glyphs.generated.ts
    python3 scripts/generate_glyphs.py --check    # fail if the file is stale

The rasterisation matches ESPHome's ``font`` component as closely as Pillow
allows: FreeType outlines, an 8 bit coverage bitmap and a hard 50 % threshold,
which is what ESPHome stores for ``bpp: 1``. Advances are rounded up per glyph,
matching the ``pt_to_px()`` measurement used by tests/test_config.py.

Requires: pip install pyyaml pillow freetype-py
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import yaml
import freetype
from PIL import ImageFont

HERE = Path(__file__).resolve().parent
APP = HERE.parent
REPO = APP.parent
FONT_PACKAGE = REPO / "packages" / "fonts_local.yaml"
OUTPUT = APP / "src" / "glyphs.generated.ts"

CLOCK_TEXT = "88:88:88"
DIGITS = "0123456789"
PANEL_HEIGHT = 8


class ConfigError(SystemExit):
    def __init__(self, message: str) -> None:
        super().__init__(f"generate_glyphs: {message}")


def glyph_records(
    font: ImageFont.FreeTypeFont,
    face: freetype.Face,
    characters: str,
) -> dict[str, dict]:
    """Rasterise every character exactly like ESPHome stores it for bpp: 1."""
    records: dict[str, dict] = {}
    for char in characters:
        mask = font.getmask(char, mode="1")
        data = bytes(mask)
        width, height = mask.size
        rows = []
        for row in range(height):
            bits = 0
            for col in range(width):
                if data[row * width + col] > 127:
                    bits |= 1 << (width - 1 - col)
            rows.append(bits)
        # getbbox() is relative to the ascender line, which is what ESPHome
        # stores as glyph.offset_y: the distance from the text box top to ink.
        top = font.getbbox(char)[1] if width and height else 0
        face.load_char(ord(char), freetype.FT_LOAD_RENDER | freetype.FT_LOAD_TARGET_MONO)
        records[char] = {
            "w": width,
            "h": height,
            "top": top,
            # ESPHome derives the glyph advance from FreeType's 26.6 fixed-
            # point horiAdvance. Pillow's getlength() varies between its
            # Windows and Linux wheels, which made generated previews fail CI.
            "advance": (face.glyph.metrics.horiAdvance + 63) // 64,
            "rows": rows,
        }
    return records


def build() -> str:
    if not FONT_PACKAGE.is_file():
        raise ConfigError(f"missing {FONT_PACKAGE}")
    entries = (yaml.safe_load(FONT_PACKAGE.read_text(encoding="utf-8")) or {}).get("font") or []
    if not entries:
        raise ConfigError(f"no font entries in {FONT_PACKAGE}")

    lines: list[str] = []
    for entry in entries:
        font_id = entry["id"]
        size = int(entry["size"])
        if int(entry.get("bpp", 1)) != 1:
            raise ConfigError(f"{font_id}: only bpp: 1 fonts are supported by the preview")
        source = (FONT_PACKAGE.parent / entry["file"]["path"]).resolve()
        if not source.is_file():
            raise ConfigError(f"{font_id}: missing font file {source}")
        characters = "".join(entry["glyphs"])
        try:
            font = ImageFont.truetype(str(source), size)
            face = freetype.Face(str(source))
            face.set_pixel_sizes(size, 0)
        except OSError as error:  # pragma: no cover - broken font file
            raise ConfigError(f"{font_id}: cannot open {source} ({error})") from error

        glyphs = glyph_records(font, face, characters)
        missing = [char for char in characters if char != " " and not glyphs[char]["h"]]
        if missing:
            raise ConfigError(f"{font_id}: no ink for {''.join(missing)!r}")
        zero = glyphs["0"]
        clock_width = sum(glyphs[char]["advance"] for char in CLOCK_TEXT)
        max_digit_height = max(glyphs[char]["h"] for char in DIGITS)
        print(
            f"{font_id:28s} size {size:2d}  {CLOCK_TEXT} = {clock_width:2d}px  "
            f"digit ink {max_digit_height}px  baseline offset {zero['top']}px"
        )

        lines.append(f"  {font_id}: {{")
        lines.append(f"    file: {json_string(source.relative_to(REPO).as_posix())},")
        lines.append(f"    size: {size},")
        lines.append(f"    inkHeight: {zero['h']},")
        lines.append(f"    inkTop: {zero['top']},")
        lines.append(f"    clockWidth: {clock_width},")
        lines.append(f"    maxDigitHeight: {max_digit_height},")
        lines.append("    glyphs: {")
        for char, glyph in glyphs.items():
            name = char if char != " " else "space"
            rows = ", ".join(str(value) for value in glyph["rows"])
            lines.append(
                f"      {json_string(name)}: {{ w: {glyph['w']}, h: {glyph['h']}, "
                f"top: {glyph['top']}, advance: {glyph['advance']}, rows: [{rows}] }},"
            )
        lines.append("    },")
        lines.append("  },")

    return "\n".join(
        [
            "// GENERATED FILE - do not edit by hand.",
            "//",
            "// Source of truth: packages/fonts_local.yaml plus the TTF/OTF files in fonts/.",
            "// Regenerate with:  python3 scripts/generate_glyphs.py",
            "//",
            "// Rows are bit masks, most significant bit = leftmost pixel. `top` is the",
            "// distance from the text box top to the first ink row, which is the value",
            "// ESPHome stores as glyph.offset_y and the renderer uses for centring.",
            "",
            "export interface GeneratedGlyph {",
            "  w: number;",
            "  h: number;",
            "  top: number;",
            "  advance: number;",
            "  rows: number[];",
            "}",
            "",
            "export interface GeneratedFont {",
            "  file: string;",
            "  size: number;",
            "  /** Ink height of the digit 0; the renderer centres on it. */",
            "  inkHeight: number;",
            "  /** Offset of the digit 0 ink from the text box top. */",
            "  inkTop: number;",
            "  /** Width of worst-case \"88:88:88\" in pixels, the 48 px panel budget. */",
            "  clockWidth: number;",
            "  /** Tallest digit, in pixels. */",
            "  maxDigitHeight: number;",
            "  glyphs: Record<string, GeneratedGlyph>;",
            "}",
            "",
            "export const GENERATED_FONTS: Record<string, GeneratedFont> = {",
            *lines,
            "};",
            "",
        ]
    )


def json_string(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="only check that the file is current")
    args = parser.parse_args()

    content = build()
    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_text(encoding="utf-8") != content:
            print("glyphs.generated.ts is out of date; run scripts/generate_glyphs.py", file=sys.stderr)
            return 1
        print("glyphs.generated.ts is up to date")
        return 0

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(content, encoding="utf-8")
    print(f"wrote {OUTPUT.relative_to(REPO)} ({len(content.splitlines())} lines)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
