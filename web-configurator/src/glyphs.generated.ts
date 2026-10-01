// GENERATED FILE - do not edit by hand.
//
// Source of truth: packages/fonts_local.yaml plus the TTF/OTF files in fonts/.
// Regenerate with:  python3 scripts/generate_glyphs.py
//
// Rows are bit masks, most significant bit = leftmost pixel. `top` is the
// distance from the text box top to the first ink row, which is the value
// ESPHome stores as glyph.offset_y and the renderer uses for centring.

export interface GeneratedGlyph {
  w: number;
  h: number;
  top: number;
  advance: number;
  rows: number[];
}

export interface GeneratedFont {
  file: string;
  size: number;
  /** Ink height of the digit 0; the renderer centres on it. */
  inkHeight: number;
  /** Offset of the digit 0 ink from the text box top. */
  inkTop: number;
  /** Width of worst-case "88:88:88" in pixels, the 48 px panel budget. */
  clockWidth: number;
  /** Tallest digit, in pixels. */
  maxDigitHeight: number;
  glyphs: Record<string, GeneratedGlyph>;
}

export const GENERATED_FONTS: Record<string, GeneratedFont> = {
  font_pixel_clock_6x8_source: {
    file: "fonts/pixel-clock-6x8/PixelClock6x8.ttf",
    size: 8,
    inkHeight: 8,
    inkTop: 0,
    clockWidth: 48,
    maxDigitHeight: 8,
    glyphs: {
      "0": { w: 7, h: 8, top: 0, advance: 7, rows: [60, 102, 102, 102, 102, 102, 102, 60] },
      "1": { w: 7, h: 8, top: 0, advance: 7, rows: [48, 112, 48, 48, 48, 48, 48, 120] },
      "2": { w: 7, h: 8, top: 0, advance: 7, rows: [60, 102, 6, 12, 24, 48, 96, 126] },
      "3": { w: 7, h: 8, top: 0, advance: 7, rows: [60, 102, 6, 28, 6, 6, 102, 60] },
      "4": { w: 7, h: 8, top: 0, advance: 7, rows: [14, 30, 54, 102, 102, 126, 6, 6] },
      "5": { w: 7, h: 8, top: 0, advance: 7, rows: [126, 96, 96, 124, 6, 6, 102, 60] },
      "6": { w: 7, h: 8, top: 0, advance: 7, rows: [60, 102, 96, 124, 102, 102, 102, 60] },
      "7": { w: 7, h: 8, top: 0, advance: 7, rows: [126, 6, 6, 12, 24, 24, 24, 24] },
      "8": { w: 7, h: 8, top: 0, advance: 7, rows: [60, 102, 102, 60, 102, 102, 102, 60] },
      "9": { w: 7, h: 8, top: 0, advance: 7, rows: [60, 102, 102, 102, 62, 6, 102, 60] },
      ":": { w: 3, h: 6, top: 2, advance: 3, rows: [4, 0, 0, 4, 0, 0] },
      ".": { w: 3, h: 2, top: 6, advance: 3, rows: [4, 0] },
      "-": { w: 5, h: 5, top: 3, advance: 5, rows: [30, 0, 0, 0, 0] },
      "/": { w: 6, h: 8, top: 0, advance: 6, rows: [2, 2, 4, 8, 16, 32, 32, 0] },
      "%": { w: 6, h: 8, top: 0, advance: 6, rows: [50, 50, 4, 8, 16, 38, 38, 0] },
      "!": { w: 3, h: 8, top: 0, advance: 3, rows: [4, 4, 4, 4, 4, 0, 4, 0] },
      "?": { w: 6, h: 8, top: 0, advance: 6, rows: [60, 2, 2, 28, 16, 0, 16, 0] },
      "+": { w: 6, h: 7, top: 1, advance: 6, rows: [8, 8, 62, 8, 8, 0, 0] },
      "space": { w: 3, h: 0, top: 0, advance: 3, rows: [] },
    },
  },
  font_md_parola_numeric_7seg_source: {
    file: "fonts/md-parola-numeric-7seg/MDParolaNumeric7Seg.ttf",
    size: 8,
    inkHeight: 8,
    inkTop: 0,
    clockWidth: 32,
    maxDigitHeight: 8,
    glyphs: {
      "0": { w: 5, h: 8, top: 0, advance: 5, rows: [31, 17, 17, 17, 17, 17, 31, 0] },
      "1": { w: 5, h: 8, top: 0, advance: 5, rows: [16, 16, 16, 16, 16, 16, 16, 0] },
      "2": { w: 5, h: 8, top: 0, advance: 5, rows: [31, 1, 1, 31, 16, 16, 31, 0] },
      "3": { w: 5, h: 8, top: 0, advance: 5, rows: [31, 1, 1, 31, 1, 1, 31, 0] },
      "4": { w: 5, h: 8, top: 0, advance: 5, rows: [17, 17, 17, 31, 1, 1, 1, 0] },
      "5": { w: 5, h: 8, top: 0, advance: 5, rows: [31, 16, 16, 31, 1, 1, 31, 0] },
      "6": { w: 5, h: 8, top: 0, advance: 5, rows: [31, 16, 16, 31, 17, 17, 31, 0] },
      "7": { w: 5, h: 8, top: 0, advance: 5, rows: [31, 1, 1, 1, 1, 1, 1, 0] },
      "8": { w: 5, h: 8, top: 0, advance: 5, rows: [31, 17, 17, 31, 17, 17, 31, 0] },
      "9": { w: 5, h: 8, top: 0, advance: 5, rows: [31, 17, 17, 31, 1, 1, 31, 0] },
      ":": { w: 1, h: 6, top: 2, advance: 1, rows: [1, 0, 1, 0, 0, 0] },
      ".": { w: 1, h: 2, top: 6, advance: 1, rows: [1, 0] },
      "-": { w: 4, h: 5, top: 3, advance: 4, rows: [15, 0, 0, 0, 0] },
      "/": { w: 5, h: 8, top: 0, advance: 5, rows: [1, 1, 2, 4, 8, 16, 16, 0] },
      "%": { w: 5, h: 8, top: 0, advance: 5, rows: [25, 25, 2, 4, 8, 19, 19, 0] },
      "!": { w: 1, h: 8, top: 0, advance: 1, rows: [1, 1, 1, 1, 1, 0, 1, 0] },
      "?": { w: 5, h: 8, top: 0, advance: 5, rows: [30, 1, 1, 14, 8, 0, 8, 0] },
      "+": { w: 5, h: 7, top: 1, advance: 5, rows: [4, 4, 31, 4, 4, 0, 0] },
      "space": { w: 1, h: 0, top: 0, advance: 1, rows: [] },
    },
  },
  font_matrix_2px_source: {
    file: "fonts/matrix-2px/Matrix2px.ttf",
    size: 8,
    inkHeight: 8,
    inkTop: 0,
    clockWidth: 48,
    maxDigitHeight: 8,
    glyphs: {
      "0": { w: 7, h: 8, top: 0, advance: 7, rows: [6, 6, 102, 102, 102, 102, 126, 126] },
      "1": { w: 7, h: 8, top: 0, advance: 7, rows: [30, 30, 6, 6, 6, 6, 6, 6] },
      "2": { w: 7, h: 8, top: 0, advance: 7, rows: [126, 126, 6, 126, 126, 96, 126, 126] },
      "3": { w: 7, h: 8, top: 0, advance: 7, rows: [126, 126, 6, 126, 126, 6, 126, 126] },
      "4": { w: 7, h: 8, top: 0, advance: 7, rows: [102, 102, 102, 126, 126, 6, 6, 6] },
      "5": { w: 7, h: 8, top: 0, advance: 7, rows: [126, 126, 96, 126, 126, 6, 126, 126] },
      "6": { w: 7, h: 8, top: 0, advance: 7, rows: [126, 126, 96, 126, 126, 102, 126, 126] },
      "7": { w: 7, h: 8, top: 0, advance: 7, rows: [126, 126, 6, 6, 6, 6, 6, 6] },
      "8": { w: 7, h: 8, top: 0, advance: 7, rows: [126, 126, 102, 126, 126, 102, 126, 126] },
      "9": { w: 7, h: 8, top: 0, advance: 7, rows: [126, 126, 102, 126, 126, 6, 126, 126] },
      ":": { w: 3, h: 7, top: 1, advance: 3, rows: [6, 6, 0, 0, 6, 6, 0] },
      ".": { w: 3, h: 2, top: 6, advance: 3, rows: [6, 6] },
      "-": { w: 5, h: 5, top: 3, advance: 5, rows: [30, 30, 0, 0, 0] },
      "/": { w: 7, h: 7, top: 1, advance: 7, rows: [6, 6, 12, 12, 48, 48, 0] },
      "%": { w: 7, h: 8, top: 0, advance: 7, rows: [96, 99, 6, 12, 12, 96, 99, 3] },
      "!": { w: 4, h: 8, top: 0, advance: 4, rows: [6, 6, 6, 6, 6, 0, 6, 6] },
      "?": { w: 7, h: 8, top: 0, advance: 7, rows: [126, 126, 6, 6, 24, 0, 24, 24] },
      "+": { w: 7, h: 8, top: 0, advance: 7, rows: [24, 24, 24, 126, 126, 24, 24, 24] },
      "space": { w: 3, h: 0, top: 0, advance: 3, rows: [] },
    },
  },
  font_dot_matrix_source: {
    file: "fonts/dot-matrix/DotMatrix.ttf",
    size: 8,
    inkHeight: 8,
    inkTop: 0,
    clockWidth: 48,
    maxDigitHeight: 8,
    glyphs: {
      "0": { w: 7, h: 8, top: 0, advance: 7, rows: [60, 102, 102, 102, 102, 102, 102, 60] },
      "1": { w: 7, h: 8, top: 0, advance: 7, rows: [24, 120, 24, 24, 24, 24, 24, 124] },
      "2": { w: 7, h: 8, top: 0, advance: 7, rows: [60, 102, 6, 12, 24, 48, 96, 126] },
      "3": { w: 7, h: 8, top: 0, advance: 7, rows: [60, 102, 6, 28, 6, 6, 102, 60] },
      "4": { w: 7, h: 8, top: 0, advance: 7, rows: [12, 28, 44, 108, 126, 12, 12, 12] },
      "5": { w: 7, h: 8, top: 0, advance: 7, rows: [126, 96, 124, 6, 6, 6, 102, 60] },
      "6": { w: 7, h: 8, top: 0, advance: 7, rows: [60, 102, 96, 124, 102, 102, 102, 60] },
      "7": { w: 7, h: 8, top: 0, advance: 7, rows: [126, 6, 12, 12, 24, 24, 48, 48] },
      "8": { w: 7, h: 8, top: 0, advance: 7, rows: [60, 102, 102, 60, 102, 102, 102, 60] },
      "9": { w: 7, h: 8, top: 0, advance: 7, rows: [60, 102, 102, 102, 62, 6, 102, 60] },
      ":": { w: 3, h: 6, top: 2, advance: 3, rows: [4, 0, 0, 4, 0, 0] },
      ".": { w: 3, h: 2, top: 6, advance: 3, rows: [4, 4] },
      "-": { w: 5, h: 5, top: 3, advance: 5, rows: [28, 28, 0, 0, 0] },
      "/": { w: 6, h: 7, top: 1, advance: 6, rows: [4, 8, 8, 16, 32, 32, 0] },
      "%": { w: 6, h: 8, top: 0, advance: 6, rows: [49, 50, 4, 8, 16, 33, 3, 6] },
      "!": { w: 3, h: 8, top: 0, advance: 3, rows: [4, 4, 4, 4, 4, 0, 4, 4] },
      "?": { w: 6, h: 8, top: 0, advance: 6, rows: [30, 51, 3, 6, 12, 0, 12, 12] },
      "+": { w: 7, h: 8, top: 0, advance: 7, rows: [16, 16, 16, 124, 124, 16, 16, 16] },
      "space": { w: 3, h: 0, top: 0, advance: 3, rows: [] },
    },
  },
};
