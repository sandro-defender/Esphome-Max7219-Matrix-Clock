# Pixel Clock 6x8

`PixelClock6x8.ttf` is a project-owned, generated 8-row bitmap face for
MAX7219 panels. Its six-column digits use rounded, two-column edges and a
single LED spacer, matching the compact layout commonly used by Arduino matrix
clocks while fitting `HH:MM:SS` in 48 pixels.

It contains only the clock/status glyph contract. Regenerate it with:

```text
python scripts/generate_pixel_clock_6x8_font.py
```
