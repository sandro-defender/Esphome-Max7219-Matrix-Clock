#!/usr/bin/env python3
"""Generate native 8 px Georgian date glyphs from fonts/max7219.ttf.

The firmware uses private one-byte Georgian codes so it can render month and
weekday labels without a UTF-8 decoder.  This script keeps their MAX7219 rows,
advances and the configurator preview derived from the same source font.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import freetype

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "fonts/max7219.ttf"
CPP_OUTPUT = ROOT / "packages/max7219_date_font.generated.h"
TS_OUTPUT = ROOT / "web-configurator/src/date_font.generated.ts"
# This TTF stores each hand-drawn LED cell as a 3×3 unit square in a 32-unit em.
# Rasterising at the native em lets us collapse each square to precisely one LED.
NATIVE_GRID_PX = 32
CELL_PX = 3

# Code order 0x80..0x94, matching the existing compact Georgian date strings.
CODEPOINTS = (0x10D9, 0x10D5, 0x10D8, 0x10DD, 0x10E0, 0x10E8, 0x10E1,
              0x10D0, 0x10DB, 0x10D7, 0x10EE, 0x10E3, 0x10DE, 0x10D1,
              0x10DC, 0x10D4, 0x10D3, 0x10D2, 0x10DA, 0x10E5, 0x10E2)


def glyph_rows(face: freetype.Face, codepoint: int) -> tuple[list[int], int]:
    if face.get_char_index(codepoint) == 0:
        raise ValueError(f"{FONT}: missing U+{codepoint:04X}")
    face.load_char(codepoint, freetype.FT_LOAD_RENDER | freetype.FT_LOAD_TARGET_MONO)
    glyph, bitmap = face.glyph, face.glyph.bitmap
    if bitmap.width % CELL_PX or bitmap.rows % CELL_PX:
        raise ValueError(f"{FONT}: U+{codepoint:04X} is not aligned to {CELL_PX}px hand-drawn cells")
    width, height = bitmap.width // CELL_PX, bitmap.rows // CELL_PX
    if width > 8 or height > 8:
        raise ValueError(f"{FONT}: U+{codepoint:04X} is {width}×{height} cells; date renderer supports 8×8")
    rows = []
    for cell_y in range(height):
        row = 0
        for cell_x in range(width):
            on = any(bitmap.buffer[(cell_y * CELL_PX + py) * bitmap.pitch + (cell_x * CELL_PX + px) // 8]
                     & (0x80 >> ((cell_x * CELL_PX + px) % 8))
                     for py in range(CELL_PX) for px in range(CELL_PX))
            if on:
                row |= 1 << (7 - cell_x)
        rows.append(row)
    advance = (glyph.metrics.horiAdvance + 63) // 64
    if advance % CELL_PX:
        raise ValueError(f"{FONT}: U+{codepoint:04X} advance is not aligned to {CELL_PX}px hand-drawn cells")
    # The Date screen uses one eight-row baseline: shorter letters get their
    # blank bearing above the ink, never below it.
    return ([0] * (8 - height) + rows)[:8], advance // CELL_PX


def build() -> dict[Path, str]:
    face = freetype.Face(str(FONT))
    face.set_pixel_sizes(NATIVE_GRID_PX, 0)
    glyphs = [glyph_rows(face, codepoint) for codepoint in CODEPOINTS]
    rows = [glyph[0] for glyph in glyphs]
    advances = [glyph[1] for glyph in glyphs]
    row_lines = ",\n    ".join("{" + ",".join(f"0x{value:02X}" for value in row) + "}" for row in rows)
    advance_line = ",".join(map(str, advances))
    cpp = "// GENERATED from native hand-drawn cells in fonts/max7219.ttf by scripts/generate_date_font.py; do not edit.\n#pragma once\n#include <stdint.h>\n\nnamespace max7219_date_font {\nstatic constexpr uint8_t ROWS[21][8] = {\n    " + row_lines + "\n};\nstatic constexpr uint8_t ADVANCES[21] = {" + advance_line + "};\n}  // namespace max7219_date_font\n"
    ts_rows = ",\n  ".join("[" + ", ".join(f"0x{value:02X}" for value in row) + "]" for row in rows)
    ts = "// GENERATED from native hand-drawn cells in fonts/max7219.ttf by scripts/generate_date_font.py; do not edit.\nexport const MAX7219_GEORGIAN_ROWS: readonly (readonly number[])[] = [\n  " + ts_rows + "\n];\nexport const MAX7219_GEORGIAN_ADVANCES = [" + ", ".join(map(str, advances)) + "] as const;\n"
    return {CPP_OUTPUT: cpp, TS_OUTPUT: ts}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail instead of rewriting stale generated files")
    args = parser.parse_args()
    for path, content in build().items():
        if args.check:
            if not path.is_file() or path.read_text(encoding="utf8") != content:
                raise SystemExit(f"Date font drift: run scripts/generate_date_font.py for {path.relative_to(ROOT)}")
        else:
            path.write_text(content, encoding="utf8")
    print(f"Date font {'checked' if args.check else 'generated'} from {FONT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
