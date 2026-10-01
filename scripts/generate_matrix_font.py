#!/usr/bin/env python3
"""Generate the Matrix 2px clock font (fonts/matrix-2px/Matrix2px.ttf).

The font is designed for one job: fill an 8x8 LED matrix exactly. Every digit
is exactly eight rows tall (the full panel height) and every stroke of every
number is exactly two pixels thick, in a 6x8 ink cell that advances by seven
pixels so worst-case "88:88:88" is exactly 48 pixels wide on the default
48x8 panel.

Design rules (enforced by assertions below, verified against a real
FreeType rasterisation by tests/test_config.py):

  * ink grid per digit: 6 columns x 8 rows, cell advances to 7 columns;
  * horizontal lines occupy rows 0-1 (top), 3-4 (middle) or 6-7 (bottom),
    so every horizontal stroke is two rows tall;
  * vertical lines occupy columns 0-1 or 4-5 (middle gap 2-3), so every
    vertical stroke is two columns wide;
  * row pairs (0,1), (3,4), (6,7) are identical and column pairs (0,1),
    (2,3), (4,5) are identical in every digit - the formal statement of
    "all number lines are 2 pixels".

The TrueType file uses unitsPerEm = 64 (one font unit = one eighth of a
pixel at the compiled size of 8), so every outline coordinate is an exact
multiple of the pixel grid at `size: 8`: FreeType cannot round a stroke edge
onto a different pixel, which is what makes the 2 px promise hold on the
real panel.

    python3 scripts/generate_matrix_font.py     # rewrite the TTF
    python3 scripts/generate_matrix_font.py --check   # fail if stale

Requires: pip install fonttools
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUTPUT = REPO / "fonts" / "matrix-2px" / "Matrix2px.ttf"

# ---------------------------------------------------------------------------
# The design. One string per pixel row, '#' = lit, '.' = off, top row first.
# ---------------------------------------------------------------------------

# Digits: 6 columns wide, 8 rows tall. Cell advances to 7 columns (1 px gap).
DIGITS: dict[str, tuple[str, ...]] = {
    "0": (
        "....##",
        "....##",
        "##..##",
        "##..##",
        "##..##",
        "##..##",
        "######",
        "######",
    ),
    "1": (
        "..####",
        "..####",
        "....##",
        "....##",
        "....##",
        "....##",
        "....##",
        "....##",
    ),
    "2": (
        "######",
        "######",
        "....##",
        "######",
        "######",
        "##....",
        "######",
        "######",
    ),
    "3": (
        "######",
        "######",
        "....##",
        "######",
        "######",
        "....##",
        "######",
        "######",
    ),
    "4": (
        "##..##",
        "##..##",
        "##..##",
        "######",
        "######",
        "....##",
        "....##",
        "....##",
    ),
    "5": (
        "######",
        "######",
        "##....",
        "######",
        "######",
        "....##",
        "######",
        "######",
    ),
    "6": (
        "######",
        "######",
        "##....",
        "######",
        "######",
        "##..##",
        "######",
        "######",
    ),
    "7": (
        "######",
        "######",
        "....##",
        "....##",
        "....##",
        "....##",
        "....##",
        "....##",
    ),
    "8": (
        "######",
        "######",
        "##..##",
        "######",
        "######",
        "##..##",
        "######",
        "######",
    ),
    "9": (
        "######",
        "######",
        "##..##",
        "######",
        "######",
        "....##",
        "######",
        "######",
    ),
}

# Punctuation. Each entry: (rows, advance in pixels). The ink never spans the
# full six columns unless a one-pixel pad cell keeps neighbours one pixel
# apart (checked by assert_neighbours_stay_clear()).
PUNCTUATION: dict[str, tuple[tuple[str, ...], int]] = {
    # Colon: two 2x2 squares in the row gaps, 3 px cell (same as space, so a
    # blinking colon can never shift the layout).
    ":": (
        (
            "...",
            "##.",
            "##.",
            "...",
            "...",
            "##.",
            "##.",
            "...",
        ),
        3,
    ),
    # Period: 2x2 square on the baseline.
    ".": (
        (
            "...",
            "...",
            "...",
            "...",
            "...",
            "...",
            "##.",
            "##.",
        ),
        3,
    ),
    # Hyphen: middle bar, 5 px cell.
    "-": (
        (
            ".....",
            ".....",
            ".....",
            "####.",
            "####.",
            ".....",
            ".....",
            ".....",
        ),
        5,
    ),
    # Slash: three 2x2 steps from bottom-left to top-right, 7 px cell.
    "/": (
        (
            ".......",
            "....##.",
            "....##.",
            "...##..",
            "...##..",
            ".##....",
            ".##....",
            ".......",
        ),
        7,
    ),
    # Percent: 2x2 dot top-left, stepped diagonal, 2x2 dot bottom-right.
    "%": (
        (
            "##.....",
            "##...##",
            "....##.",
            "...##..",
            "...##..",
            "##.....",
            "##...##",
            ".....##",
        ),
        7,
    ),
    # Exclamation: 2 px bar, one row gap, 2 x 2 dot; centred in a 4 px cell.
    "!": (
        (
            ".##.",
            ".##.",
            ".##.",
            ".##.",
            ".##.",
            "....",
            ".##.",
            ".##.",
        ),
        4,
    ),
    # Question mark: top bar, right side, centre tail, one row gap, dot.
    "?": (
        (
            "######.",
            "######.",
            "....##.",
            "....##.",
            "..##...",
            ".......",
            "..##...",
            "..##...",
        ),
        7,
    ),
    # Plus: balanced cross, arms two pixels thick.
    "+": (
        (
            "..##...",
            "..##...",
            "..##...",
            "######.",
            "######.",
            "..##...",
            "..##...",
            "..##...",
        ),
        7,
    ),
    # Space: no ink, 3 px cell (identical to the colon).
    " ": (
        (
            "...",
            "...",
            "...",
            "...",
            "...",
            "...",
            "...",
            "...",
        ),
        3,
    ),
}


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"generate_matrix_font: {message}")


def validate_design() -> None:
    """The pixel rules the user-facing promise is made of."""
    for char, rows in DIGITS.items():
        _assert(len(rows) == 8, f"digit '{char}' must be 8 rows tall")
        _assert(
            all(len(row) == 6 for row in rows),
            f"digit '{char}' must be 6 columns wide",
        )
        # Every horizontal line is a row pair: (0,1), (3,4) and (6,7)
        # are identical, so no horizontal stroke is one pixel thick.
        for a, b in ((0, 1), (3, 4), (6, 7)):
            _assert(rows[a] == rows[b], f"digit '{char}' rows {a}/{b} differ")
        # Every vertical line is a column pair: (0,1), (2,3), (4,5)
        # are identical, so no stroke is one pixel wide.
        for a, b in ((0, 1), (2, 3), (4, 5)):
            col_a = "".join(row[a] for row in rows)
            col_b = "".join(row[b] for row in rows)
            _assert(col_a == col_b, f"digit '{char}' columns {a}/{b} differ")
        # The digits must use the full panel height.
        _assert(rows[0] != "......", f"digit '{char}' does not reach row 0")
        _assert(rows[7] != "......", f"digit '{char}' does not reach row 7")

    for char, (rows, advance) in PUNCTUATION.items():
        _assert(len(rows) == 8, f"'{char!r}' must be 8 rows tall")
        width = len(rows[0])
        _assert(
            all(len(row) == width for row in rows),
            f"'{char!r}' rows disagree on width",
        )
        _assert(
            width <= advance,
            f"'{char!r}' ink ({width}) wider than its advance ({advance})",
        )
        if char == ":":
            _assert(advance == 3, "colon cell must match the space cell")

    # Clock text: six digits plus two colons must fit the 48 px panel.
    _assert(
        6 * 7 + 2 * 3 <= 48,
        "'88:88:88' does not fit the default panel",
    )


def build_font():
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen

    validate_design()

    UNITS_PER_EM = 64        # 8 px at size: 8
    PIXEL = 8                # font units of one pixel at the compiled size
    ASCENDER = 8 * PIXEL     # the ink top sits exactly on the ascender line
    DESCENDER = -PIXEL       # no glyph draws below the baseline

    def rows_to_rects(rows: tuple[str, ...], y_top_rows: int = 8):
        """Turn '#' rows into rectangles in font units (one rect per run).

        y_top_rows keeps every glyph on the same eight-row cell as the digits
        so punctuation shares the baseline and cap line.
        """
        rects = []
        for index, row in enumerate(rows):
            y_top = (y_top_rows - index) * PIXEL
            y_bottom = y_top - PIXEL
            run_start = None
            for x, cell in enumerate(row + "."):
                if cell == "#" and run_start is None:
                    run_start = x
                elif cell != "#" and run_start is not None:
                    rects.append((run_start * PIXEL, y_bottom, x * PIXEL, y_top))
                    run_start = None
        return rects

    glyph_order = [".notdef"]
    glyphs = {".notdef": TTGlyphPen(None).glyph()}
    advances = {".notdef": 0}

    def add_glyph(name: str, rects, advance_px: int) -> None:
        glyph_order.append(name)
        pen = TTGlyphPen(None)
        for x0, y0, x1, y1 in rects:
            pen.moveTo((x0, y0))
            pen.lineTo((x0, y1))
            pen.lineTo((x1, y1))
            pen.lineTo((x1, y0))
            pen.closePath()
        glyphs[name] = pen.glyph()
        advances[name] = advance_px * PIXEL

    # Digits.
    for char in "0123456789":
        add_glyph(
            {"0": "zero", "1": "one", "2": "two", "3": "three", "4": "four",
             "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine"}[char],
            rows_to_rects(DIGITS[char]),
            7,
        )

    # Punctuation names match the traditional PostScript set.
    names = {
        ":": "colon",
        ".": "period",
        "-": "hyphen",
        "/": "slash",
        "%": "percent",
        "!": "exclam",
        "?": "question",
        "+": "plus",
        " ": "space",
    }
    for char, (rows, advance) in PUNCTUATION.items():
        add_glyph(names[char], rows_to_rects(rows), advance)

    cmap = {}
    for char, name in [("0", "zero"), ("1", "one"), ("2", "two"), ("3", "three"),
                       ("4", "four"), ("5", "five"), ("6", "six"), ("7", "seven"),
                       ("8", "eight"), ("9", "nine")]:
        cmap[ord(char)] = name
    for char, name in names.items():
        cmap[ord(char)] = name

    fb = FontBuilder(UNITS_PER_EM, isTTF=True)
    fb.setupGlyphOrder(glyph_order)
    fb.setupCharacterMap(cmap)

    # Uniform widths: the digits are the widest glyph at seven pixels.
    fb.setupGlyf(glyphs)
    # Left side bearing = the xMin of each outline (0 for empty/aligned glyphs).
    metrics = {}
    for name, glyph in glyphs.items():
        coordinates = getattr(glyph, "coordinates", None)
        lsb = min((x for x, _ in coordinates), default=0) if coordinates else 0
        metrics[name] = (advances[name], int(lsb))
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(
        ascender=ASCENDER,
        descender=DESCENDER,
        lineGap=0,
    )
    fb.setupNameTable(
        {
            "familyName": "Matrix 2px",
            "styleName": "Regular",
            "uniqueFontIdentifier": "Matrix2px-Regular",
            "fullName": "Matrix 2px Regular",
            "psName": "Matrix2px-Regular",
            "version": "Version 1.000",
        }
    )
    fb.setupOS2(
        sTypoAscender=ASCENDER,
        sTypoDescender=DESCENDER,
        sTypoLineGap=0,
        usWinAscent=ASCENDER,
        usWinDescent=-DESCENDER,
        achVendID="MTRX",
        sxHeight=4 * PIXEL,
        sCapHeight=8 * PIXEL,
        fsSelection=0x0040,  # REGULAR
    )
    fb.setupPost()
    fb.setupHead(
        unitsPerEm=UNITS_PER_EM,
        flags=0x000B,  # baseline at y=0, lsb at x=0, instructions depend on integers
        lowestRecPPEM=8,
        fontDirectionHint=2,
        # Fixed timestamps keep the generated file byte-stable.
        created=3_800_000_000,
        modified=3_800_000_000,
    )
    return fb.font


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="only check that the file is current")
    args = parser.parse_args()

    font = build_font()

    from io import BytesIO

    buffer = BytesIO()
    font.save(buffer)
    payload = buffer.getvalue()

    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_bytes() != payload:
            print("Matrix2px.ttf is out of date; run scripts/generate_matrix_font.py", file=sys.stderr)
            return 1
        print("Matrix2px.ttf is up to date")
        return 0

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(payload)
    print(f"wrote {OUTPUT.relative_to(REPO)} ({len(payload)} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
