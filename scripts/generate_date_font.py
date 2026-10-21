#!/usr/bin/env python3
"""Generate native 8 px Georgian and custom big digit glyphs from fonts/max7219.ttf.

The firmware keeps compact tables for built-in fallback rendering (when the
built-in Compact 5x7 font is selected or an external face lacks a glyph),
while external faces render the same glyphs directly from fonts/max7219.ttf.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import freetype

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "fonts/max7219.ttf"
CPP_OUTPUT = ROOT / "packages/max7219_date_font.generated.h"
TS_OUTPUT = ROOT / "web-configurator/src/date_font.generated.ts"
# This TTF stores each hand-drawn LED cell as a 3×3 unit square in a 24-unit em.
# Rasterising at the native em lets us collapse each square to precisely one LED.
NATIVE_GRID_PX = 24
CELL_PX = 3

# Code order 0x80..0x94, matching the existing compact Georgian date strings.
CODEPOINTS = (0x10D9, 0x10D5, 0x10D8, 0x10DD, 0x10E0, 0x10E8, 0x10E1,
              0x10D0, 0x10DB, 0x10D7, 0x10EE, 0x10E3, 0x10DE, 0x10D1,
              0x10DC, 0x10D4, 0x10D3, 0x10D2, 0x10DA, 0x10E5, 0x10E2)

# Full Georgian Mkhedruli alphabet U+10D0..U+10F0 (33 letters).
MKHEDRULI_CODEPOINTS = tuple(range(0x10D0, 0x10F1))

# Custom big digits U+E000..U+E009 (10 digits).
CUSTOM_BIG_DIGIT_CODEPOINTS = tuple(range(0xE000, 0xE00A))


def glyph_rows(face: freetype.Face, codepoint: int, bottom_align: bool = True) -> tuple[list[int], int]:
    if face.get_char_index(codepoint) == 0:
        raise ValueError(f"{FONT}: missing U+{codepoint:04X}")
    face.load_char(codepoint, freetype.FT_LOAD_RENDER | freetype.FT_LOAD_TARGET_MONO)
    glyph, bitmap = face.glyph, face.glyph.bitmap
    if bitmap.width % CELL_PX or bitmap.rows % CELL_PX:
        raise ValueError(f"{FONT}: U+{codepoint:04X} is not aligned to {CELL_PX}px hand-drawn cells")
    width, height = bitmap.width // CELL_PX, bitmap.rows // CELL_PX
    left_cells = max(0, glyph.bitmap_left // CELL_PX)
    if left_cells + width > 8 or height > 8:
        raise ValueError(f"{FONT}: U+{codepoint:04X} is {width}×{height} cells; renderer supports 8×8")
    rows = []
    for cell_y in range(height):
        row = 0
        for cell_x in range(width):
            on = any(bitmap.buffer[(cell_y * CELL_PX + py) * bitmap.pitch + (cell_x * CELL_PX + px) // 8]
                     & (0x80 >> ((cell_x * CELL_PX + px) % 8))
                     for py in range(CELL_PX) for px in range(CELL_PX))
            if on:
                row |= 1 << (7 - (left_cells + cell_x))
        rows.append(row)
    advance = (glyph.metrics.horiAdvance + 63) // 64
    if advance % CELL_PX:
        raise ValueError(f"{FONT}: U+{codepoint:04X} advance is not aligned to {CELL_PX}px hand-drawn cells")
    if bottom_align:
        # The Date screen uses one eight-row baseline: shorter letters get their
        # blank bearing above the ink, never below it.
        return ([0] * (8 - height) + rows)[:8], advance // CELL_PX
    return (rows + [0] * (8 - height))[:8], advance // CELL_PX


def build() -> dict[Path, str]:
    face = freetype.Face(str(FONT))
    face.set_pixel_sizes(NATIVE_GRID_PX, 0)
    glyphs = [glyph_rows(face, codepoint, bottom_align=True) for codepoint in CODEPOINTS]
    rows = [glyph[0] for glyph in glyphs]
    advances = [glyph[1] for glyph in glyphs]

    mkhedruli_glyphs = [glyph_rows(face, cp, bottom_align=False) for cp in MKHEDRULI_CODEPOINTS]
    mkhedruli_rows = [g[0] for g in mkhedruli_glyphs]
    mkhedruli_advances = [g[1] for g in mkhedruli_glyphs]

    big_digit_glyphs = [glyph_rows(face, cp, bottom_align=False) for cp in CUSTOM_BIG_DIGIT_CODEPOINTS]
    big_digit_rows = [g[0] for g in big_digit_glyphs]
    big_digit_advances = [g[1] for g in big_digit_glyphs]

    row_lines = ",\n    ".join("{" + ",".join(f"0x{value:02X}" for value in row) + "}" for row in rows)
    advance_line = ",".join(map(str, advances))
    codepoints_line = ",".join(f"0x{cp:04X}" for cp in CODEPOINTS)
    mkhedruli_row_lines = ",\n    ".join("{" + ",".join(f"0x{value:02X}" for value in row) + "}" for row in mkhedruli_rows)
    mkhedruli_adv_line = ",".join(map(str, mkhedruli_advances))
    big_digit_row_lines = ",\n    ".join("{" + ",".join(f"0x{value:02X}" for value in row) + "}" for row in big_digit_rows)
    big_digit_adv_line = ",".join(map(str, big_digit_advances))

    cpp = (
        "// GENERATED from native hand-drawn cells in fonts/max7219.ttf by scripts/generate_date_font.py; do not edit.\n"
        "#pragma once\n"
        "#include <stdint.h>\n\n"
        "namespace max7219_date_font {\n"
        "static constexpr uint16_t CODEPOINTS[21] = {" + codepoints_line + "};\n"
        "static constexpr uint8_t ROWS[21][8] = {\n    " + row_lines + "\n};\n"
        "static constexpr uint8_t ADVANCES[21] = {" + advance_line + "};\n"
        "static constexpr uint8_t MKHEDRULI_ROWS[33][8] = {\n    " + mkhedruli_row_lines + "\n};\n"
        "static constexpr uint8_t MKHEDRULI_ADVANCES[33] = {" + mkhedruli_adv_line + "};\n"
        "static constexpr uint8_t CUSTOM_BIG_DIGIT_ROWS[10][8] = {\n    " + big_digit_row_lines + "\n};\n"
        "static constexpr uint8_t CUSTOM_BIG_DIGIT_ADVANCES[10] = {" + big_digit_adv_line + "};\n"
        "}  // namespace max7219_date_font\n"
    )
    ts_rows = ",\n  ".join("[" + ", ".join(f"0x{value:02X}" for value in row) + "]" for row in rows)
    ts_mk_rows = ",\n  ".join("[" + ", ".join(f"0x{value:02X}" for value in row) + "]" for row in mkhedruli_rows)
    ts_big_rows = ",\n  ".join("[" + ", ".join(f"0x{value:02X}" for value in row) + "]" for row in big_digit_rows)
    ts = (
        "// GENERATED from native hand-drawn cells in fonts/max7219.ttf by scripts/generate_date_font.py; do not edit.\n"
        "export const MAX7219_GEORGIAN_CODEPOINTS = [" + ", ".join(f"0x{cp:04X}" for cp in CODEPOINTS) + "] as const;\n"
        "export const MAX7219_GEORGIAN_ROWS: readonly (readonly number[])[] = [\n  " + ts_rows + "\n];\n"
        "export const MAX7219_GEORGIAN_ADVANCES = [" + ", ".join(map(str, advances)) + "] as const;\n"
        "export const MAX7219_MKHEDRULI_ROWS: readonly (readonly number[])[] = [\n  " + ts_mk_rows + "\n];\n"
        "export const MAX7219_MKHEDRULI_ADVANCES = [" + ", ".join(map(str, mkhedruli_advances)) + "] as const;\n"
        "export const MAX7219_CUSTOM_BIG_DIGIT_ROWS: readonly (readonly number[])[] = [\n  " + ts_big_rows + "\n];\n"
        "export const MAX7219_CUSTOM_BIG_DIGIT_ADVANCES = [" + ", ".join(map(str, big_digit_advances)) + "] as const;\n"
    )
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
