#!/usr/bin/env python3
"""Generate the ESPHome-ready MD_MAX72XX System clock font.

This is a faithful outline conversion of the clock glyphs in
MD_MAX72XX/src/MD_MAX72xx_font.cpp (the library's `_sysfont` table).
The original stores glyphs as one byte per column, with bit 0 at the top.
Only the project clock glyph set is converted, keeping ESP8266 firmware use
bounded.  The original library is LGPL-2.1-or-later; see the adjacent LICENSE.

Run `python scripts/generate_md_max72xx_system_font.py` after editing this
table, or pass `--check` in validation.
"""

from __future__ import annotations

import argparse
import sys
from io import BytesIO
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUTPUT = REPO / "fonts" / "md-max72xx-system" / "MDMax72xxSystem.ttf"

# Exact width byte and column bytes from MD_MAX72xx_font.cpp, `_sysfont`.
GLYPHS: dict[str, tuple[int, tuple[int, ...]]] = {
    " ": (2, (0x00, 0x00)),
    "!": (1, (0x5F,)),
    "%": (5, (0x63, 0x13, 0x08, 0x64, 0x63)),
    "+": (5, (0x08, 0x08, 0x3E, 0x08, 0x08)),
    "-": (4, (0x08, 0x08, 0x08, 0x08)),
    ".": (2, (0x60, 0x60)),
    "/": (5, (0x60, 0x10, 0x08, 0x04, 0x03)),
    "0": (5, (0x3E, 0x51, 0x49, 0x45, 0x3E)),
    "1": (3, (0x04, 0x02, 0x7F)),
    "2": (5, (0x71, 0x49, 0x49, 0x49, 0x46)),
    "3": (5, (0x41, 0x49, 0x49, 0x49, 0x36)),
    "4": (5, (0x0F, 0x08, 0x08, 0x08, 0x7F)),
    "5": (5, (0x4F, 0x49, 0x49, 0x49, 0x31)),
    "6": (5, (0x3E, 0x49, 0x49, 0x49, 0x30)),
    "7": (5, (0x03, 0x01, 0x01, 0x01, 0x7F)),
    "8": (5, (0x36, 0x49, 0x49, 0x49, 0x36)),
    "9": (5, (0x06, 0x49, 0x49, 0x49, 0x3E)),
    ":": (2, (0x6C, 0x6C)),
    "?": (5, (0x01, 0x59, 0x09, 0x09, 0x06)),
}

NAMES = {
    " ": "space", "!": "exclam", "%": "percent", "+": "plus",
    "-": "hyphen", ".": "period", "/": "slash", ":": "colon",
    "?": "question", **{str(i): ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"][i] for i in range(10)},
}


def build_font():
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen

    units_per_em = 64
    pixel = 8
    glyph_order = [".notdef"]
    glyphs = {".notdef": TTGlyphPen(None).glyph()}
    metrics = {".notdef": (0, 0)}
    cmap = {}

    for char, (advance, columns) in GLYPHS.items():
        if advance != len(columns):
            raise ValueError(f"{char!r} width does not match its columns")
        name = NAMES[char]
        glyph_order.append(name)
        pen = TTGlyphPen(None)
        # A set bit is one illuminated LED cell.  Consecutive pixels are left
        # as separate rectangles deliberately: this mirrors the source grid.
        for x, column in enumerate(columns):
            for row in range(8):
                if column & (1 << row):
                    x0, x1 = x * pixel, (x + 1) * pixel
                    y1, y0 = (8 - row) * pixel, (7 - row) * pixel
                    pen.moveTo((x0, y0))
                    pen.lineTo((x0, y1))
                    pen.lineTo((x1, y1))
                    pen.lineTo((x1, y0))
                    pen.closePath()
        glyphs[name] = pen.glyph()
        metrics[name] = (advance * pixel, 0)
        cmap[ord(char)] = name

    fb = FontBuilder(units_per_em, isTTF=True)
    fb.setupGlyphOrder(glyph_order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascender=64, descender=-8, lineGap=0)
    fb.setupNameTable({
        "familyName": "MD MAX72XX System", "styleName": "Regular",
        "uniqueFontIdentifier": "MD-MAX72XX-System-Regular",
        "fullName": "MD MAX72XX System Regular",
        "psName": "MDMAX72xxSystem-Regular", "version": "Version 1.000",
        "copyright": "Copyright (C) 2012-14 Marco Colli; LGPL-2.1-or-later.",
    })
    fb.setupOS2(sTypoAscender=64, sTypoDescender=-8, sTypoLineGap=0,
                usWinAscent=64, usWinDescent=8, achVendID="MDMX",
                sxHeight=56, sCapHeight=64, fsSelection=0x0040)
    fb.setupPost()
    fb.setupHead(unitsPerEm=units_per_em, flags=0x000B, lowestRecPPEM=8,
                 fontDirectionHint=2, created=3_800_000_000,
                 modified=3_800_000_000)
    return fb.font


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    buffer = BytesIO()
    build_font().save(buffer)
    payload = buffer.getvalue()
    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_bytes() != payload:
            print("MDMax72xxSystem.ttf is out of date; run its generator", file=sys.stderr)
            return 1
        print("MDMax72xxSystem.ttf is up to date")
        return 0
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(payload)
    print(f"wrote {OUTPUT.relative_to(REPO)} ({len(payload)} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
