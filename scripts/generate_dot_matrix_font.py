#!/usr/bin/env python3
"""Generate the original 6x8 Dot Matrix clock font.

Each # is one physical MAX7219 LED. Digits occupy a 6x8 cell and advance by
seven columns, while the colon advances by three. Consequently, ``HH:MM`` is
31 pixels wide and fits a 32x8 (four-module) clock without clipping.

    python scripts/generate_dot_matrix_font.py
    python scripts/generate_dot_matrix_font.py --check
"""

from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUTPUT = REPO / "fonts" / "dot-matrix" / "DotMatrix.ttf"

# Six columns, eight rows. The isolated pixels intentionally let the round LED
# lenses create the same dotted appearance as the supplied reference photo.
GLYPHS: dict[str, tuple[str, ...]] = {
    "0": (".####.", "##..##", "##..##", "##..##", "##..##", "##..##", "##..##", ".####."),
    "1": ("...##.", ".####.", "...##.", "...##.", "...##.", "...##.", "...##.", ".#####"),
    "2": (".####.", "##..##", "....##", "...##.", "..##..", ".##...", "##....", "######"),
    "3": (".####.", "##..##", "....##", "..###.", "....##", "....##", "##..##", ".####."),
    "4": ("...##.", "..###.", ".#.##.", "##.##.", "######", "...##.", "...##.", "...##."),
    "5": ("######", "##....", "#####.", "....##", "....##", "....##", "##..##", ".####."),
    "6": (".####.", "##..##", "##....", "#####.", "##..##", "##..##", "##..##", ".####."),
    "7": ("######", "....##", "...##.", "...##.", "..##..", "..##..", ".##...", ".##..."),
    "8": (".####.", "##..##", "##..##", ".####.", "##..##", "##..##", "##..##", ".####."),
    "9": (".####.", "##..##", "##..##", "##..##", ".#####", "....##", "##..##", ".####."),
    ":": ("...", "...", ".#.", "...", "...", ".#.", "...", "..."),
    ".": ("...", "...", "...", "...", "...", "...", ".#.", ".#."),
    "-": (".....", ".....", ".....", ".###.", ".###.", ".....", ".....", "....."),
    "/": ("......", "....#.", "...#..", "...#..", "..#...", ".#....", ".#....", "......"),
    "%": ("##...#", "##..#.", "...#..", "..#...", ".#....", "#....#", "....##", "...##."),
    "!": (".#.", ".#.", ".#.", ".#.", ".#.", "...", ".#.", ".#."),
    "?": (".####.", "##..##", "....##", "...##.", "..##..", "......", "..##..", "..##.."),
    "+": ("...#...", "...#...", "...#...", ".#####.", ".#####.", "...#...", "...#...", "...#..."),
    " ": ("...",) * 8,
}

ADVANCES = {char: 7 for char in "0123456789"}
ADVANCES.update({":": 3, ".": 3, "-": 5, "/": 6, "%": 6, "!": 3, "?": 6, "+": 7, " ": 3})
POSTSCRIPT_NAMES = {"0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine", ":": "colon", ".": "period", "-": "hyphen", "/": "slash", "%": "percent", "!": "exclam", "?": "question", "+": "plus", " ": "space"}


def advance_for(char: str) -> int:
    return ADVANCES[char]


def validate_design() -> None:
    for char, rows in GLYPHS.items():
        assert len(rows) == 8, f"{char!r} must be eight rows high"
        assert len({len(row) for row in rows}) == 1, f"{char!r} rows differ in width"
        assert len(rows[0]) <= advance_for(char), f"{char!r} ink exceeds advance"
    for char in "0123456789":
        assert len(GLYPHS[char][0]) == 6, f"{char} is not six pixels wide"
        assert "#" in GLYPHS[char][0] and "#" in GLYPHS[char][-1], f"{char} does not fill the height"
    assert sum(advance_for(char) for char in "88:88") == 31


def build_font():
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen

    validate_design()
    units_per_em, pixel = 64, 8
    glyphs, advances = {".notdef": TTGlyphPen(None).glyph()}, {".notdef": 0}

    for char, rows in GLYPHS.items():
        pen = TTGlyphPen(None)
        for row_index, row in enumerate(rows):
            y1 = (8 - row_index) * pixel
            y0 = y1 - pixel
            for column, value in enumerate(row):
                if value != "#":
                    continue
                x0, x1 = column * pixel, (column + 1) * pixel
                pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()
        name = POSTSCRIPT_NAMES[char]
        glyphs[name] = pen.glyph()
        advances[name] = advance_for(char) * pixel

    fb = FontBuilder(units_per_em, isTTF=True)
    order = [".notdef", *[POSTSCRIPT_NAMES[char] for char in GLYPHS]]
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap({ord(char): POSTSCRIPT_NAMES[char] for char in GLYPHS})
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics({name: (advance, 0) for name, advance in advances.items()})
    fb.setupHorizontalHeader(ascender=64, descender=-8, lineGap=0)
    fb.setupNameTable({"familyName": "Dot Matrix", "styleName": "Regular", "uniqueFontIdentifier": "DotMatrix-Regular", "fullName": "Dot Matrix Regular", "psName": "DotMatrix-Regular", "version": "Version 1.000"})
    fb.setupOS2(sTypoAscender=64, sTypoDescender=-8, sTypoLineGap=0, usWinAscent=64, usWinDescent=8, achVendID="DMAT", sxHeight=32, sCapHeight=64, fsSelection=0x0040)
    fb.setupPost(); fb.setupHead(unitsPerEm=units_per_em, flags=0x000B, lowestRecPPEM=8, fontDirectionHint=2, created=3_800_000_000, modified=3_800_000_000)
    return fb.font


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument("--check", action="store_true")
    args = parser.parse_args(); buffer = io.BytesIO(); build_font().save(buffer); payload = buffer.getvalue()
    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_bytes() != payload:
            print("DotMatrix.ttf is out of date; run scripts/generate_dot_matrix_font.py", file=sys.stderr); return 1
        print("DotMatrix.ttf is up to date"); return 0
    OUTPUT.parent.mkdir(parents=True, exist_ok=True); OUTPUT.write_bytes(payload)
    print(f"wrote {OUTPUT.relative_to(REPO)} ({len(payload)} bytes)"); return 0


if __name__ == "__main__":
    raise SystemExit(main())
