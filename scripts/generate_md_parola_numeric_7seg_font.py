#!/usr/bin/env python3
"""Generate the ESPHome-ready MD Parola Numeric 7-Segment clock font.

The numeral columns are the ``numeric7Seg`` table from
MD_Parola/examples/Parola_Zone_TimeMsg/Font_Data.h.  The original table has
only digits, a colon, and a period; the other clock/status punctuation keeps
the compatible MD_MAX72XX system-font shapes so the project renderer's bounded
glyph contract remains intact.  MD_Parola is LGPL-2.1-or-later; see the
license referenced by fonts/md-parola-numeric-7seg/README.md.
"""

from __future__ import annotations

import argparse
import sys
from io import BytesIO
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

REPO = Path(__file__).resolve().parent.parent
OUTPUT = REPO / "fonts" / "md-parola-numeric-7seg" / "MDParolaNumeric7Seg.ttf"

# Exact width byte and column bytes for numeric7Seg's clock glyphs. Bit 0 is
# the top LED row, matching the MD_MAX72XX font-table convention.
GLYPHS: dict[str, tuple[int, tuple[int, ...]]] = {
    " ": (1, (0x00,)),
    ".": (1, (0x40,)),
    "0": (5, (0x7F, 0x41, 0x41, 0x41, 0x7F)),
    "1": (5, (0x00, 0x00, 0x7F, 0x00, 0x00)),
    "2": (5, (0x79, 0x49, 0x49, 0x49, 0x4F)),
    "3": (5, (0x49, 0x49, 0x49, 0x49, 0x7F)),
    "4": (5, (0x0F, 0x08, 0x08, 0x08, 0x7F)),
    "5": (5, (0x4F, 0x49, 0x49, 0x49, 0x79)),
    "6": (5, (0x7F, 0x49, 0x49, 0x49, 0x79)),
    "7": (5, (0x01, 0x01, 0x01, 0x01, 0x7F)),
    "8": (5, (0x7F, 0x49, 0x49, 0x49, 0x7F)),
    "9": (5, (0x4F, 0x49, 0x49, 0x49, 0x7F)),
    ":": (1, (0x14,)),
    # Compatible system-font punctuation; numeric7Seg leaves these undefined.
    "!": (1, (0x5F,)), "%": (5, (0x63, 0x13, 0x08, 0x64, 0x63)),
    "+": (5, (0x08, 0x08, 0x3E, 0x08, 0x08)), "-": (4, (0x08,) * 4),
    "/": (5, (0x60, 0x10, 0x08, 0x04, 0x03)), "?": (5, (0x01, 0x59, 0x09, 0x09, 0x06)),
}

NAMES = {" ": "space", "!": "exclam", "%": "percent", "+": "plus", "-": "hyphen", ".": "period", "/": "slash", ":": "colon", "?": "question", **{str(i): ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"][i] for i in range(10)}}


def build_font():
    units_per_em, pixel = 64, 8
    order, glyphs, metrics, cmap = [".notdef"], {".notdef": TTGlyphPen(None).glyph()}, {".notdef": (0, 0)}, {}
    for char, (advance, columns) in GLYPHS.items():
        if advance != len(columns):
            raise ValueError(f"{char!r} width does not match its columns")
        name, pen = NAMES[char], TTGlyphPen(None)
        for x, column in enumerate(columns):
            for row in range(8):
                if column & (1 << row):
                    x0, x1, y0, y1 = x * pixel, (x + 1) * pixel, (7 - row) * pixel, (8 - row) * pixel
                    pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()
        order.append(name); glyphs[name] = pen.glyph(); metrics[name] = (advance * pixel, 0); cmap[ord(char)] = name

    fb = FontBuilder(units_per_em, isTTF=True)
    fb.setupGlyphOrder(order); fb.setupCharacterMap(cmap); fb.setupGlyf(glyphs); fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascender=64, descender=-8, lineGap=0)
    fb.setupNameTable({"familyName": "MD Parola Numeric 7-Segment", "styleName": "Regular", "uniqueFontIdentifier": "MD-Parola-Numeric-7Seg-Regular", "fullName": "MD Parola Numeric 7-Segment Regular", "psName": "MDParolaNumeric7Seg-Regular", "version": "Version 1.000", "copyright": "Copyright (C) 2012-14 Marco Colli; LGPL-2.1-or-later."})
    fb.setupOS2(sTypoAscender=64, sTypoDescender=-8, sTypoLineGap=0, usWinAscent=64, usWinDescent=8, achVendID="MDPR", sxHeight=56, sCapHeight=64, fsSelection=0x0040)
    fb.setupPost(); fb.setupHead(unitsPerEm=units_per_em, flags=0x000B, lowestRecPPEM=8, fontDirectionHint=2, created=3_800_000_000, modified=3_800_000_000)
    return fb.font


def main() -> int:
    check = argparse.ArgumentParser(description=__doc__).add_argument("--check", action="store_true")
    args = argparse.ArgumentParser(description=__doc__); args.add_argument("--check", action="store_true"); parsed = args.parse_args()
    output = BytesIO(); build_font().save(output); payload = output.getvalue()
    if parsed.check:
        if not OUTPUT.is_file() or OUTPUT.read_bytes() != payload:
            print("MDParolaNumeric7Seg.ttf is out of date; run its generator", file=sys.stderr); return 1
        print("MDParolaNumeric7Seg.ttf is up to date"); return 0
    OUTPUT.parent.mkdir(parents=True, exist_ok=True); OUTPUT.write_bytes(payload)
    print(f"wrote {OUTPUT.relative_to(REPO)} ({len(payload)} bytes)"); return 0


if __name__ == "__main__":
    raise SystemExit(main())
