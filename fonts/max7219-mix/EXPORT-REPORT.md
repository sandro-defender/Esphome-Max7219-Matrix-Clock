# MAX7219 Matrix Clock export report — max7219-georgian

**Status:** PASS

- Label: max7219 Georgian
- Family: max7219 Georgian
- Slug: max7219-georgian
- Pixel size: 8, bpp: 1
- TTF: fonts/max7219-georgian/max7219Georgian.ttf
- TTF SHA-256: b2e13180a0a0909cb0049127cec55a260f6b33d109f721e7bceecb586d3dd361
- License: CC BY-SA

## Measurements

- Tallest digit 0-9: **7 px** (7 ascent rows + 1 descender row)
- "88:88:88" advance width: **40 px** (must be ≤ 48 px)
- Scale: the 24-unit em is drawn 8 px tall, so 1 px = 3 font units; the outlines sit on a 3-unit pixel grid (1 drawn pixel = 1 LED px)
- Measured the way ESPHome renders the font (FreeType, size 8, bpp 1); glyphs are placed the way the clock draws them (text centred on the ink of '0').

## Checks

| Check | Result | Detail |
| --- | --- | --- |
| All glyphs present in cmap | ✅ PASS | All 52 requested characters are mapped. |
| No glyph renders as empty/.notdef | ✅ PASS | No mapped glyph is empty. |
| No glyph taller than 8 px | ✅ PASS | Every glyph fits within 8 rows. |
| Tallest digit is exactly 8 px | ✅ PASS | Digits fill all 7 ascent rows above the descender row (0=7, 1=7, 2=7, 3=7, 4=7, 5=7, 6=7, 7=7, 8=7, 9=7). |
| "88:88:88" advance width ≤ 48 px | ✅ PASS | 40 px (need ≤ 48): '8' 6 px (5 ink + 1 blank) ×6, ':' 2 px (1 ink + 1 blank) ×2. |
| No glyph clipped at the top | ✅ PASS | No ink above the 8 LED rows (the clock centres text on the ink of '0', LED rows 0–6). |
| No glyph clipped at the bottom | ✅ PASS | No ink below the 8 LED rows (the clock centres text on the ink of '0', LED rows 0–6). |

## Per-glyph rasterization

| Char | Advance (px) | Ink width (px) | Height (px) | LED rows | Clipped top | Clipped bottom |
| --- | --- | --- | --- | --- | --- | --- |
| '0' (U+0030) | 6 | 5 | 7 | 0–6 | no | no |
| '1' (U+0031) | 6 | 5 | 7 | 0–6 | no | no |
| '2' (U+0032) | 6 | 5 | 7 | 0–6 | no | no |
| '3' (U+0033) | 6 | 5 | 7 | 0–6 | no | no |
| '4' (U+0034) | 6 | 5 | 7 | 0–6 | no | no |
| '5' (U+0035) | 6 | 5 | 7 | 0–6 | no | no |
| '6' (U+0036) | 6 | 5 | 7 | 0–6 | no | no |
| '7' (U+0037) | 6 | 5 | 7 | 0–6 | no | no |
| '8' (U+0038) | 6 | 5 | 7 | 0–6 | no | no |
| '9' (U+0039) | 6 | 5 | 7 | 0–6 | no | no |
| ':' (U+003A) | 2 | 1 | 6 | 1–6 | no | no |
| '.' (U+002E) | 2 | 1 | 2 | 5–6 | no | no |
| '-' (U+002D) | 6 | 5 | 1 | 4 | no | no |
| '/' (U+002F) | 6 | 5 | 7 | 0–6 | no | no |
| '%' (U+0025) | 6 | 5 | 7 | 0–6 | no | no |
| '!' (U+0021) | 2 | 1 | 7 | 0–6 | no | no |
| '?' (U+003F) | 6 | 5 | 7 | 0–6 | no | no |
| '+' (U+002B) | 6 | 5 | 5 | 2–6 | no | no |
| SPACE (U+0020) | 6 | 0 | 0 | – | no | no |
| ა (U+10D0) | 5 | 5 | 8 | 0–7 | no | no |
| ბ (U+10D1) | 5 | 5 | 8 | 0–7 | no | no |
| გ (U+10D2) | 5 | 5 | 8 | 0–7 | no | no |
| დ (U+10D3) | 5 | 5 | 8 | 0–7 | no | no |
| ე (U+10D4) | 5 | 5 | 8 | 0–7 | no | no |
| ვ (U+10D5) | 5 | 5 | 8 | 0–7 | no | no |
| ზ (U+10D6) | 5 | 5 | 7 | 0–6 | no | no |
| თ (U+10D7) | 5 | 5 | 8 | 0–7 | no | no |
| ი (U+10D8) | 5 | 5 | 8 | 0–7 | no | no |
| კ (U+10D9) | 5 | 5 | 8 | 0–7 | no | no |
| ლ (U+10DA) | 5 | 5 | 8 | 0–7 | no | no |
| მ (U+10DB) | 5 | 5 | 8 | 0–7 | no | no |
| ნ (U+10DC) | 5 | 5 | 8 | 0–7 | no | no |
| ო (U+10DD) | 5 | 5 | 8 | 0–7 | no | no |
| პ (U+10DE) | 5 | 5 | 8 | 0–7 | no | no |
| ჟ (U+10DF) | 5 | 5 | 8 | 0–7 | no | no |
| რ (U+10E0) | 5 | 5 | 8 | 0–7 | no | no |
| ს (U+10E1) | 5 | 5 | 8 | 0–7 | no | no |
| ტ (U+10E2) | 5 | 5 | 8 | 0–7 | no | no |
| უ (U+10E3) | 5 | 5 | 8 | 0–7 | no | no |
| ფ (U+10E4) | 5 | 5 | 8 | 0–7 | no | no |
| ქ (U+10E5) | 5 | 5 | 8 | 0–7 | no | no |
| ღ (U+10E6) | 5 | 5 | 8 | 0–7 | no | no |
| ყ (U+10E7) | 5 | 5 | 8 | 0–7 | no | no |
| შ (U+10E8) | 5 | 5 | 8 | 0–7 | no | no |
| ჩ (U+10E9) | 5 | 5 | 8 | 0–7 | no | no |
| ც (U+10EA) | 5 | 5 | 8 | 0–7 | no | no |
| ძ (U+10EB) | 5 | 5 | 8 | 0–7 | no | no |
| წ (U+10EC) | 5 | 5 | 8 | 0–7 | no | no |
| ჭ (U+10ED) | 5 | 5 | 8 | 0–7 | no | no |
| ხ (U+10EE) | 5 | 5 | 8 | 0–7 | no | no |
| ჯ (U+10EF) | 5 | 5 | 8 | 0–7 | no | no |
| ჰ (U+10F0) | 5 | 5 | 8 | 0–7 | no | no |
