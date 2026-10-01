# MD Parola Numeric 7-Segment

This optional 8-pixel clock face faithfully converts the `numeric7Seg` digits,
colon, and period from MD Parola's `Parola_Zone_TimeMsg` example. Its seven
segment numerals are visibly heavier and more geometric than the MD_MAX72XX
system face. The companion `numeric7SegDouble` example needs two stacked 8x8
matrix rows (16 pixels) and cannot fit this project's one-row matrix.

The generated TTF includes only the clock/status glyph set. The original table
does not define the remaining status punctuation, so `-/%!?+` uses compatible
MD_MAX72XX system-glyph shapes. This keeps the renderer's clock glyph contract
complete without inventing new numeral designs.

Source: `MD_Parola/examples/Parola_Zone_TimeMsg/Font_Data.h`, copyright
© 2012–14 Marco Colli. MD Parola is LGPL-2.1-or-later. The complete license is
retained in this repository at [`../md-max72xx-system/LICENSE.txt`](../md-max72xx-system/LICENSE.txt).
Regenerate `MDParolaNumeric7Seg.ttf` with
`python scripts/generate_md_parola_numeric_7seg_font.py`.
