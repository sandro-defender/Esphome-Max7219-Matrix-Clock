#!/usr/bin/env python3
"""Generate the project-owned Pixel Clock 6x8 MAX7219 bitmap font.

The face is intentionally an eight-row, six-column clock design: it has the
rounded, two-column edge treatment preferred for a matrix clock, rather than
the straight one-pixel strokes of a seven-segment face.  Only the project's
bounded clock/status glyph set is built into the output.
"""

from __future__ import annotations

import argparse
import sys
from io import BytesIO
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

REPO = Path(__file__).resolve().parent.parent
OUTPUT = REPO / "fonts" / "pixel-clock-6x8" / "PixelClock6x8.ttf"

# Columns are stored left-to-right with bit 0 at the top LED row.  Digits are
# six LEDs wide; their advance is seven LEDs so the full HH:MM:SS layout fits
# a 48x8, six-module panel.
GLYPHS: dict[str, tuple[int, tuple[int, ...]]] = {
    " ": (3, (0x00, 0x00, 0x00)),
    ".": (3, (0x00, 0x40, 0x00)),
    "0": (7, (0x7E, 0xFF, 0x81, 0x81, 0xFF, 0x7E, 0x00)),
    "1": (7, (0x00, 0x82, 0xFF, 0xFF, 0x80, 0x00, 0x00)),
    "2": (7, (0xC2, 0xE3, 0xB1, 0x99, 0x8F, 0x86, 0x00)),
    "3": (7, (0x42, 0xC3, 0x89, 0x89, 0xFF, 0x76, 0x00)),
    "4": (7, (0x38, 0x3C, 0x26, 0x23, 0xFF, 0xFF, 0x00)),
    "5": (7, (0x4F, 0xCF, 0x89, 0x89, 0xF9, 0x71, 0x00)),
    "6": (7, (0x7E, 0xFF, 0x89, 0x89, 0xFB, 0x72, 0x00)),
    "7": (7, (0x01, 0x01, 0xF1, 0xF9, 0x0F, 0x07, 0x00)),
    "8": (7, (0x76, 0xFF, 0x89, 0x89, 0xFF, 0x76, 0x00)),
    "9": (7, (0x4E, 0xDF, 0x91, 0x91, 0xFF, 0x7E, 0x00)),
    ":": (3, (0x00, 0x24, 0x00)),
    "!": (3, (0x00, 0x5F, 0x00)), "%": (6, (0x63, 0x13, 0x08, 0x64, 0x63, 0x00)),
    "+": (6, (0x08, 0x08, 0x3E, 0x08, 0x08, 0x00)), "-": (5, (0x08, 0x08, 0x08, 0x08, 0x00)),
    "/": (6, (0x60, 0x10, 0x08, 0x04, 0x03, 0x00)), "?": (6, (0x01, 0x59, 0x09, 0x09, 0x06, 0x00)),
}

NAMES = {" ": "space", "!": "exclam", "%": "percent", "+": "plus", "-": "hyphen", ".": "period", "/": "slash", ":": "colon", "?": "question", **{str(i): ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"][i] for i in range(10)}}


def build_font():
    units_per_em, pixel = 64, 8
    order, glyphs, metrics, cmap = [".notdef"], {".notdef": TTGlyphPen(None).glyph()}, {".notdef": (0, 0)}, {}
    for char, (advance, columns) in GLYPHS.items():
        if advance < len(columns):
            raise ValueError(f"{char!r} advance cannot be narrower than its columns")
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
    fb.setupNameTable({"familyName": "Pixel Clock 6x8", "styleName": "Regular", "uniqueFontIdentifier": "Pixel-Clock-6x8-Regular", "fullName": "Pixel Clock 6x8 Regular", "psName": "PixelClock6x8-Regular", "version": "Version 1.000", "copyright": "Pixel Clock 6x8 project source."})
    fb.setupOS2(sTypoAscender=64, sTypoDescender=-8, sTypoLineGap=0, usWinAscent=64, usWinDescent=8, achVendID="M721", sxHeight=64, sCapHeight=64, fsSelection=0x0040)
    fb.setupPost(); fb.setupHead(unitsPerEm=units_per_em, flags=0x000B, lowestRecPPEM=8, fontDirectionHint=2, created=3_800_000_000, modified=3_800_000_000)
    return fb.font


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument("--check", action="store_true")
    args = parser.parse_args(); output = BytesIO(); build_font().save(output); payload = output.getvalue()
    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_bytes() != payload:
            print("PixelClock6x8.ttf is out of date; run its generator", file=sys.stderr); return 1
        print("PixelClock6x8.ttf is up to date"); return 0
    OUTPUT.parent.mkdir(parents=True, exist_ok=True); OUTPUT.write_bytes(payload)
    print(f"wrote {OUTPUT.relative_to(REPO)} ({len(payload)} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
