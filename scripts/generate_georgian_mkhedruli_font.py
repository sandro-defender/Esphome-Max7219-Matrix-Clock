#!/usr/bin/env python3
"""Generate the project-owned Georgian Mkhedruli MAX7219 bitmap font.

The source of truth is the explicit MD_MAX72XX-style column table below:
one width byte followed by one byte per vertical column, columns left-to-right,
with bit 0 at the top LED row. The same table generates both the deterministic
TrueType file used by ESPHome/browser previews and the renderer's compact C++
bitmap fallback. No desktop font is rasterised.

Run `python scripts/generate_georgian_mkhedruli_font.py` after changing a bitmap,
or pass `--check` to verify both generated files.
"""

from __future__ import annotations

import argparse
import sys
from io import BytesIO
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUTPUT = REPO / "fonts" / "georgian-mkhedruli-8x8" / "GeorgianMkhedruli8x8.ttf"
CPP_OUTPUT = REPO / "packages" / "georgian_bitmap_font.generated.h"

GEORGIAN_LETTERS = "აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ"
CLOCK_CHARACTERS = "0123456789:.-/%!?+ "
REQUIRED_CHARACTERS = CLOCK_CHARACTERS + GEORGIAN_LETTERS

# Exact source table: (width byte, vertical column bytes). A set bit is one LED;
# bit 0 is the top row. These first glyphs follow the MD-style source example.
BITMAPS: dict[str, tuple[int, tuple[int, ...]]] = {
    "0": (5, (0x3E, 0x51, 0x49, 0x45, 0x3E)),
    "1": (3, (0x42, 0x7F, 0x40)),
    "2": (5, (0x42, 0x61, 0x51, 0x49, 0x46)),
    "3": (5, (0x41, 0x49, 0x49, 0x49, 0x36)),
    "4": (5, (0x18, 0x14, 0x12, 0x7F, 0x10)),
    "5": (5, (0x4F, 0x49, 0x49, 0x49, 0x31)),
    "6": (5, (0x3C, 0x4A, 0x49, 0x49, 0x30)),
    "7": (5, (0x01, 0x71, 0x09, 0x05, 0x03)),
    "8": (5, (0x36, 0x49, 0x49, 0x49, 0x36)),
    "9": (5, (0x46, 0x49, 0x49, 0x29, 0x1E)),
    ":": (2, (0x36, 0x36)),
    ".": (2, (0x60, 0x60)),
    "-": (3, (0x08, 0x08, 0x08)),
    "/": (5, (0x10, 0x08, 0x04, 0x02, 0x01)),
    "%": (5, (0x60, 0x13, 0x6B, 0x64, 0x03)),
    "!": (1, (0x5F,)),
    "?": (5, (0x02, 0x01, 0x51, 0x09, 0x06)),
    "+": (3, (0x08, 0x3E, 0x08)),
    " ": (3, (0x00, 0x00, 0x00)),
    "ა": (5, (0x18, 0x24, 0x14, 0x24, 0x18)),
    "ბ": (5, (0x3C, 0x24, 0x24, 0x38, 0x00)),
    "გ": (5, (0x3E, 0x41, 0x49, 0x49, 0x3A)),
    "დ": (6, (0x1C, 0x22, 0x21, 0x21, 0x21, 0xFE)),
    "ე": (5, (0x3E, 0x49, 0x49, 0x49, 0x22)),
    "ვ": (6, (0xC3, 0x24, 0x18, 0x18, 0x24, 0xC3)),
    "ზ": (5, (0x61, 0x51, 0x49, 0x45, 0x43)),
    "თ": (5, (0x08, 0xC4, 0x7F, 0x04, 0x08)),
    "ი": (3, (0x41, 0x41, 0x7F)),
    "კ": (5, (0x7F, 0x08, 0x14, 0x22, 0x41)),
    "ლ": (6, (0xE1, 0x92, 0x8C, 0x8C, 0x92, 0xE1)),
    "მ": (7, (0xFF, 0x02, 0x04, 0x08, 0x04, 0x02, 0xFF)),
    "ნ": (5, (0x7F, 0x04, 0x08, 0x10, 0x7F)),
    "ო": (5, (0x3E, 0x41, 0x41, 0x41, 0x3E)),
    "პ": (5, (0xFF, 0x01, 0x01, 0x01, 0xFF)),
    "ჟ": (7, (0x24, 0x54, 0x4F, 0x54, 0x4F, 0x54, 0x24)),
    "რ": (5, (0x7F, 0x09, 0x19, 0x29, 0x46)),
    "ს": (5, (0x46, 0x49, 0x49, 0x49, 0x31)),
    "ტ": (5, (0x01, 0x01, 0x7F, 0x01, 0x01)),
    "უ": (5, (0x1F, 0x20, 0x40, 0x20, 0x1F)),
    "ფ": (7, (0x1C, 0x22, 0xC1, 0x49, 0x41, 0x22, 0x1C)),
    "ქ": (5, (0xFF, 0x08, 0x14, 0x22, 0x41)),
    "ღ": (6, (0x3E, 0x41, 0x49, 0x59, 0xC1, 0x3E)),
    "ყ": (5, (0x01, 0x02, 0xFC, 0x02, 0x01)),
    "შ": (7, (0xFF, 0x40, 0x7C, 0x7F, 0x7C, 0x40, 0xFF)),
    "ჩ": (6, (0x0F, 0x08, 0x08, 0x08, 0x08, 0xFF)),
    "ც": (6, (0x1E, 0x21, 0x21, 0x21, 0x21, 0xF2)),
    "ძ": (6, (0x06, 0x09, 0x89, 0x49, 0x29, 0x1E)),
    "წ": (7, (0xFF, 0x10, 0x08, 0x04, 0x08, 0x10, 0xFF)),
    "ჭ": (6, (0x38, 0x44, 0x45, 0x44, 0x44, 0xF8)),
    "ხ": (5, (0x61, 0x12, 0x0C, 0x12, 0x61)),
    "ჯ": (5, (0x38, 0x40, 0x40, 0xC0, 0x3F)),
    "ჰ": (5, (0x7F, 0x08, 0x08, 0x08, 0x7F)),
}

# Width bytes describe ink columns. One empty column separates ordinary glyphs;
# narrow clock punctuation and space retain their compact MD-style advances.
ADVANCE_OVERRIDES = {" ": 3, "1": 4, ":": 3, ".": 3, "-": 4, "!": 3, "+": 4}

PUNCTUATION_NAMES = {
    " ": "space", ":": "colon", ".": "period", "-": "hyphen", "/": "slash",
    "%": "percent", "!": "exclam", "?": "question", "+": "plus",
}
DIGIT_NAMES = dict(zip("0123456789", ("zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine")))


def glyph_name(char: str) -> str:
    return DIGIT_NAMES.get(char, PUNCTUATION_NAMES.get(char, f"uni{ord(char):04X}"))


def advance_for(char: str) -> int:
    width, _ = BITMAPS[char]
    return ADVANCE_OVERRIDES.get(char, width + 1)


def validate_design() -> None:
    if len(GEORGIAN_LETTERS) != 33 or len(set(GEORGIAN_LETTERS)) != 33:
        raise ValueError("Mkhedruli coverage must be exactly 33 unique letters")
    if set(BITMAPS) != set(REQUIRED_CHARACTERS) or len(BITMAPS) != len(REQUIRED_CHARACTERS):
        raise ValueError("Bitmap source must contain exactly the clock set and all Mkhedruli letters")
    if list(BITMAPS) != list(REQUIRED_CHARACTERS):
        raise ValueError("Bitmap table order must be the required ASCII set followed by U+10D0..U+10F0")
    if GEORGIAN_LETTERS != "".join(chr(codepoint) for codepoint in range(0x10D0, 0x10F1)):
        raise ValueError("Mkhedruli code points must map directly from U+10D0 through U+10F0")
    for char, (width, columns) in BITMAPS.items():
        if width != len(columns) or width < 1 or width > 255:
            raise ValueError(f"{char!r}: width byte must match its column count")
        if any(not isinstance(column, int) or column < 0 or column > 0xFF for column in columns):
            raise ValueError(f"{char!r}: every column must be one 8-bit vertical bitmap")
        if advance_for(char) < width:
            raise ValueError(f"{char!r}: advance cannot be narrower than its bitmap")
    for char in GEORGIAN_LETTERS:
        if not any(BITMAPS[char][1]):
            raise ValueError(f"{char!r}: Georgian glyph must contain ink")


def build_font():
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen

    validate_design()
    units_per_em, pixel = 64, 8
    glyph_order = [".notdef"]
    glyphs = {".notdef": TTGlyphPen(None).glyph()}
    metrics = {".notdef": (0, 0)}
    cmap = {}

    for char in REQUIRED_CHARACTERS:
        width, columns = BITMAPS[char]
        name, pen = glyph_name(char), TTGlyphPen(None)
        # A set bit is a source LED. Expanding each bit into one exact square
        # preserves the vertical-column table without desktop-font rasterising.
        for x, column in enumerate(columns):
            for row in range(8):
                if column & (1 << row):
                    x0, x1 = x * pixel, (x + 1) * pixel
                    y0, y1 = (7 - row) * pixel, (8 - row) * pixel
                    pen.moveTo((x0, y0))
                    pen.lineTo((x0, y1))
                    pen.lineTo((x1, y1))
                    pen.lineTo((x1, y0))
                    pen.closePath()
        glyph_order.append(name)
        glyphs[name] = pen.glyph()
        metrics[name] = (advance_for(char) * pixel, 0)
        cmap[ord(char)] = name

    builder = FontBuilder(units_per_em, isTTF=True)
    builder.setupGlyphOrder(glyph_order)
    builder.setupCharacterMap(cmap)
    builder.setupGlyf(glyphs)
    builder.setupHorizontalMetrics(metrics)
    builder.setupHorizontalHeader(ascender=64, descender=-8, lineGap=0)
    builder.setupNameTable({
        "familyName": "Georgian Mkhedruli 8x8",
        "styleName": "Regular",
        "uniqueFontIdentifier": "Georgian-Mkhedruli-8x8-Regular",
        "fullName": "Georgian Mkhedruli 8x8 Regular",
        "psName": "GeorgianMkhedruli8x8-Regular",
        "version": "Version 1.000",
        "copyright": "Project-owned pixel bitmap source.",
    })
    builder.setupOS2(
        sTypoAscender=64, sTypoDescender=-8, sTypoLineGap=0,
        usWinAscent=64, usWinDescent=8, achVendID="GEO8",
        sxHeight=56, sCapHeight=64, fsSelection=0x0040,
    )
    builder.setupPost()
    builder.setupHead(
        unitsPerEm=units_per_em, flags=0x000B, lowestRecPPEM=8,
        fontDirectionHint=2, created=3_800_000_000, modified=3_800_000_000,
    )
    return builder.font


def build_cpp_header() -> str:
    validate_design()
    lines = [
        "// GENERATED from scripts/generate_georgian_mkhedruli_font.py; do not edit.",
        "#pragma once",
        "#include <stddef.h>",
        "#include <stdint.h>",
        "namespace max7219_clock { namespace georgian_bitmap {",
        "struct Glyph { uint32_t codepoint; uint8_t width; uint8_t advance; const uint8_t *columns; };",
    ]
    for char in REQUIRED_CHARACTERS:
        width, columns = BITMAPS[char]
        name = f"columns_{ord(char):04x}"
        values = ", ".join(f"0x{value:02X}" for value in columns)
        lines.append(f"static const uint8_t {name}[] = {{{values}}};")
    lines.append("static const Glyph GLYPHS[] = {")
    records = []
    for char in REQUIRED_CHARACTERS:
        width, _ = BITMAPS[char]
        records.append(
            f"  {{0x{ord(char):04X}U, {width}, {advance_for(char)}, columns_{ord(char):04x}}}"
        )
    lines.append(",\n".join(records))
    lines.extend([
        "};",
        f"static const size_t GLYPH_COUNT = {len(REQUIRED_CHARACTERS)}U;",
        f"static const size_t CLOCK_GLYPH_COUNT = {len(CLOCK_CHARACTERS)}U;",
        "inline const Glyph *find(uint32_t codepoint) {",
        "  if (codepoint >= 0x10D0U && codepoint <= 0x10F0U)",
        "    return &GLYPHS[CLOCK_GLYPH_COUNT + (codepoint - 0x10D0U)];",
        "  for (size_t index = 0; index < CLOCK_GLYPH_COUNT; index++)",
        "    if (GLYPHS[index].codepoint == codepoint) return &GLYPHS[index];",
        "  return nullptr;",
        "}",
        "inline uint8_t ink_height(const Glyph &glyph) {",
        "  int first = 8, last = -1;",
        "  for (int row = 0; row < 8; row++) {",
        "    for (int column = 0; column < glyph.width; column++) {",
        "      if (glyph.columns[column] & (1U << row)) {",
        "        if (row < first) first = row;",
        "        if (row > last) last = row;",
        "      }",
        "    }",
        "  }",
        "  return last < first ? 0 : static_cast<uint8_t>(last - first + 1);",
        "}",
        "}}  // namespace max7219_clock::georgian_bitmap",
        "",
    ])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    validate_design()

    output = BytesIO()
    build_font().save(output)
    font_payload = output.getvalue()
    cpp_payload = build_cpp_header()

    if args.check:
        stale = []
        if not OUTPUT.is_file() or OUTPUT.read_bytes() != font_payload:
            stale.append("GeorgianMkhedruli8x8.ttf")
        if not CPP_OUTPUT.is_file() or CPP_OUTPUT.read_text(encoding="utf-8") != cpp_payload:
            stale.append("georgian_bitmap_font.generated.h")
        if stale:
            print("Generated Georgian font files are out of date; run this generator: " + ", ".join(stale), file=sys.stderr)
            return 1
        print("Georgian Mkhedruli TTF and renderer bitmap are up to date")
        return 0

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(font_payload)
    CPP_OUTPUT.write_text(cpp_payload, encoding="utf-8")
    print(f"wrote {OUTPUT.relative_to(REPO)} ({len(font_payload)} bytes)")
    print(f"wrote {CPP_OUTPUT.relative_to(REPO)} ({len(cpp_payload)} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
