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
  /** Width of "HH:MM:SS" in pixels, the 48 px panel budget. */
  clockWidth: number;
  /** Tallest digit, in pixels. */
  maxDigitHeight: number;
  glyphs: Record<string, GeneratedGlyph>;
}

export const GENERATED_FONTS: Record<string, GeneratedFont> = {
  font_tiny5_source: {
    file: "fonts/tiny5/Tiny5-Regular.ttf",
    size: 10,
    inkHeight: 6,
    inkTop: 3,
    clockWidth: 46,
    maxDigitHeight: 6,
    glyphs: {
      "0": { w: 5, h: 6, top: 3, advance: 5, rows: [12, 22, 22, 22, 22, 12] },
      "1": { w: 5, h: 6, top: 3, advance: 5, rows: [12, 28, 12, 12, 12, 12] },
      "2": { w: 5, h: 6, top: 3, advance: 5, rows: [28, 6, 12, 16, 16, 30] },
      "3": { w: 5, h: 6, top: 3, advance: 5, rows: [28, 6, 12, 0, 6, 28] },
      "4": { w: 5, h: 6, top: 3, advance: 5, rows: [6, 14, 22, 22, 30, 6] },
      "5": { w: 5, h: 6, top: 3, advance: 5, rows: [30, 16, 28, 0, 6, 28] },
      "6": { w: 5, h: 6, top: 3, advance: 5, rows: [14, 16, 28, 16, 22, 12] },
      "7": { w: 5, h: 6, top: 3, advance: 5, rows: [30, 6, 12, 12, 12, 12] },
      "8": { w: 5, h: 6, top: 3, advance: 5, rows: [12, 22, 12, 0, 22, 12] },
      "9": { w: 5, h: 6, top: 3, advance: 5, rows: [12, 22, 14, 6, 6, 28] },
      ":": { w: 3, h: 5, top: 4, advance: 3, rows: [4, 0, 0, 0, 4] },
      ".": { w: 3, h: 2, top: 7, advance: 3, rows: [4, 0] },
      "-": { w: 5, h: 5, top: 4, advance: 5, rows: [30, 0, 0, 0, 0] },
      "/": { w: 4, h: 6, top: 3, advance: 4, rows: [6, 6, 14, 8, 8, 8] },
      "%": { w: 6, h: 6, top: 3, advance: 6, rows: [34, 12, 24, 0, 34, 0] },
      "!": { w: 3, h: 6, top: 3, advance: 3, rows: [4, 4, 4, 4, 0, 4] },
      "?": { w: 5, h: 6, top: 3, advance: 5, rows: [28, 6, 12, 0, 0, 12] },
      "+": { w: 5, h: 5, top: 4, advance: 5, rows: [12, 12, 30, 12, 0] },
      "space": { w: 3, h: 0, top: 0, advance: 3, rows: [] },
      "A": { w: 6, h: 6, top: 3, advance: 6, rows: [28, 34, 62, 34, 34, 34] },
      "B": { w: 6, h: 6, top: 3, advance: 6, rows: [60, 34, 60, 32, 34, 60] },
      "C": { w: 6, h: 6, top: 3, advance: 6, rows: [28, 34, 32, 32, 34, 28] },
      "D": { w: 6, h: 6, top: 3, advance: 6, rows: [60, 34, 34, 34, 34, 60] },
      "E": { w: 6, h: 6, top: 3, advance: 6, rows: [62, 32, 60, 32, 32, 62] },
      "F": { w: 6, h: 6, top: 3, advance: 6, rows: [62, 32, 60, 32, 32, 32] },
      "G": { w: 6, h: 6, top: 3, advance: 6, rows: [30, 32, 46, 34, 34, 30] },
      "H": { w: 6, h: 6, top: 3, advance: 6, rows: [34, 34, 62, 34, 34, 34] },
      "I": { w: 3, h: 6, top: 3, advance: 3, rows: [4, 4, 4, 4, 4, 4] },
      "J": { w: 5, h: 6, top: 3, advance: 5, rows: [6, 6, 6, 6, 22, 12] },
      "K": { w: 6, h: 6, top: 3, advance: 6, rows: [34, 44, 56, 32, 44, 34] },
      "L": { w: 5, h: 6, top: 3, advance: 5, rows: [16, 16, 16, 16, 16, 30] },
      "M": { w: 8, h: 6, top: 3, advance: 8, rows: [132, 236, 180, 132, 132, 132] },
      "N": { w: 6, h: 6, top: 3, advance: 6, rows: [34, 58, 46, 34, 34, 34] },
      "O": { w: 6, h: 6, top: 3, advance: 6, rows: [28, 34, 34, 34, 34, 28] },
      "P": { w: 6, h: 6, top: 3, advance: 6, rows: [60, 34, 60, 32, 32, 32] },
      "Q": { w: 6, h: 6, top: 3, advance: 6, rows: [28, 34, 34, 34, 44, 26] },
      "R": { w: 6, h: 6, top: 3, advance: 6, rows: [60, 34, 60, 34, 34, 34] },
      "S": { w: 6, h: 6, top: 3, advance: 6, rows: [30, 32, 28, 0, 2, 60] },
      "T": { w: 5, h: 6, top: 3, advance: 5, rows: [30, 12, 12, 12, 12, 12] },
      "U": { w: 6, h: 6, top: 3, advance: 6, rows: [34, 34, 34, 34, 34, 28] },
      "V": { w: 5, h: 6, top: 3, advance: 5, rows: [22, 22, 22, 30, 12, 12] },
      "W": { w: 8, h: 6, top: 3, advance: 8, rows: [180, 180, 180, 252, 104, 104] },
      "X": { w: 5, h: 6, top: 3, advance: 5, rows: [22, 22, 30, 22, 22, 22] },
      "Y": { w: 5, h: 6, top: 3, advance: 5, rows: [22, 22, 30, 12, 12, 12] },
      "Z": { w: 5, h: 6, top: 3, advance: 5, rows: [30, 6, 12, 16, 16, 30] },
    },
  },
  font_ps2p_source: {
    file: "fonts/press-start-2p/PressStart2P-Regular.ttf",
    size: 6,
    inkHeight: 7,
    inkTop: -1,
    clockWidth: 48,
    maxDigitHeight: 7,
    glyphs: {
      "0": { w: 6, h: 7, top: -1, advance: 6, rows: [28, 22, 50, 50, 50, 28, 0] },
      "1": { w: 6, h: 7, top: -1, advance: 6, rows: [12, 28, 12, 12, 12, 30, 0] },
      "2": { w: 6, h: 7, top: -1, advance: 6, rows: [30, 50, 6, 30, 28, 62, 0] },
      "3": { w: 6, h: 7, top: -1, advance: 6, rows: [30, 6, 12, 18, 50, 30, 0] },
      "4": { w: 6, h: 7, top: -1, advance: 6, rows: [14, 30, 22, 62, 6, 6, 0] },
      "5": { w: 6, h: 7, top: -1, advance: 6, rows: [62, 48, 62, 2, 50, 30, 0] },
      "6": { w: 6, h: 7, top: -1, advance: 6, rows: [30, 16, 48, 62, 50, 30, 0] },
      "7": { w: 6, h: 7, top: -1, advance: 6, rows: [62, 50, 6, 28, 24, 24, 0] },
      "8": { w: 6, h: 7, top: -1, advance: 6, rows: [28, 50, 50, 62, 46, 30, 0] },
      "9": { w: 6, h: 7, top: -1, advance: 6, rows: [30, 50, 50, 30, 6, 28, 0] },
      ":": { w: 6, h: 6, top: 0, advance: 6, rows: [24, 24, 24, 24, 0, 0] },
      ".": { w: 6, h: 3, top: 3, advance: 6, rows: [24, 24, 0] },
      "-": { w: 6, h: 4, top: 2, advance: 6, rows: [30, 0, 0, 0] },
      "/": { w: 6, h: 7, top: -1, advance: 6, rows: [2, 2, 4, 24, 16, 32, 0] },
      "%": { w: 6, h: 7, top: -1, advance: 6, rows: [18, 50, 52, 26, 22, 38, 0] },
      "!": { w: 6, h: 7, top: -1, advance: 6, rows: [28, 28, 28, 24, 0, 24, 0] },
      "?": { w: 6, h: 7, top: -1, advance: 6, rows: [30, 62, 50, 28, 0, 28, 0] },
      "+": { w: 6, h: 6, top: 0, advance: 6, rows: [12, 30, 12, 12, 0, 0] },
      "space": { w: 6, h: 0, top: 0, advance: 6, rows: [] },
      "A": { w: 6, h: 7, top: -1, advance: 6, rows: [28, 22, 50, 62, 50, 50, 0] },
      "B": { w: 6, h: 7, top: -1, advance: 6, rows: [62, 50, 50, 62, 50, 62, 0] },
      "C": { w: 6, h: 7, top: -1, advance: 6, rows: [30, 18, 48, 48, 50, 30, 0] },
      "D": { w: 6, h: 7, top: -1, advance: 6, rows: [60, 54, 50, 50, 50, 60, 0] },
      "E": { w: 6, h: 7, top: -1, advance: 6, rows: [62, 48, 48, 62, 48, 62, 0] },
      "F": { w: 6, h: 7, top: -1, advance: 6, rows: [62, 48, 48, 62, 48, 48, 0] },
      "G": { w: 6, h: 7, top: -1, advance: 6, rows: [30, 16, 48, 54, 50, 30, 0] },
      "H": { w: 6, h: 7, top: -1, advance: 6, rows: [50, 50, 50, 62, 50, 50, 0] },
      "I": { w: 6, h: 7, top: -1, advance: 6, rows: [30, 12, 12, 12, 12, 30, 0] },
      "J": { w: 6, h: 7, top: -1, advance: 6, rows: [2, 2, 2, 2, 50, 30, 0] },
      "K": { w: 6, h: 7, top: -1, advance: 6, rows: [50, 54, 60, 56, 60, 54, 0] },
      "L": { w: 6, h: 7, top: -1, advance: 6, rows: [16, 16, 16, 16, 16, 30, 0] },
      "M": { w: 6, h: 7, top: -1, advance: 6, rows: [50, 54, 62, 58, 58, 50, 0] },
      "N": { w: 6, h: 7, top: -1, advance: 6, rows: [50, 50, 58, 62, 54, 50, 0] },
      "O": { w: 6, h: 7, top: -1, advance: 6, rows: [30, 50, 50, 50, 50, 30, 0] },
      "P": { w: 6, h: 7, top: -1, advance: 6, rows: [62, 50, 50, 62, 48, 48, 0] },
      "Q": { w: 6, h: 7, top: -1, advance: 6, rows: [30, 50, 50, 62, 54, 30, 0] },
      "R": { w: 6, h: 7, top: -1, advance: 6, rows: [62, 50, 54, 60, 62, 54, 0] },
      "S": { w: 6, h: 7, top: -1, advance: 6, rows: [30, 50, 48, 14, 50, 30, 0] },
      "T": { w: 6, h: 7, top: -1, advance: 6, rows: [30, 12, 12, 12, 12, 12, 0] },
      "U": { w: 6, h: 7, top: -1, advance: 6, rows: [50, 50, 50, 50, 50, 30, 0] },
      "V": { w: 6, h: 7, top: -1, advance: 6, rows: [50, 50, 54, 30, 28, 8, 0] },
      "W": { w: 6, h: 7, top: -1, advance: 6, rows: [58, 58, 58, 62, 54, 18, 0] },
      "X": { w: 6, h: 7, top: -1, advance: 6, rows: [50, 50, 22, 28, 54, 50, 0] },
      "Y": { w: 6, h: 7, top: -1, advance: 6, rows: [18, 18, 18, 30, 12, 12, 0] },
      "Z": { w: 6, h: 7, top: -1, advance: 6, rows: [62, 6, 14, 28, 24, 62, 0] },
    },
  },
  font_silkscreen_bold_source: {
    file: "fonts/silkscreen/Silkscreen-Bold.ttf",
    size: 7,
    inkHeight: 5,
    inkTop: 3,
    clockWidth: 46,
    maxDigitHeight: 5,
    glyphs: {
      "0": { w: 6, h: 5, top: 3, advance: 6, rows: [12, 30, 30, 30, 12] },
      "1": { w: 5, h: 5, top: 3, advance: 5, rows: [14, 6, 6, 6, 14] },
      "2": { w: 6, h: 5, top: 3, advance: 6, rows: [28, 6, 12, 24, 30] },
      "3": { w: 6, h: 5, top: 3, advance: 6, rows: [28, 6, 12, 6, 28] },
      "4": { w: 6, h: 5, top: 3, advance: 6, rows: [28, 28, 30, 4, 4] },
      "5": { w: 6, h: 5, top: 3, advance: 6, rows: [30, 24, 28, 6, 28] },
      "6": { w: 6, h: 5, top: 3, advance: 6, rows: [12, 24, 28, 30, 12] },
      "7": { w: 6, h: 5, top: 3, advance: 6, rows: [30, 6, 4, 12, 12] },
      "8": { w: 6, h: 5, top: 3, advance: 6, rows: [12, 30, 12, 30, 12] },
      "9": { w: 6, h: 5, top: 3, advance: 6, rows: [12, 30, 14, 6, 12] },
      ":": { w: 4, h: 4, top: 4, advance: 4, rows: [6, 0, 6, 0] },
      ".": { w: 4, h: 2, top: 6, advance: 4, rows: [6, 0] },
      "-": { w: 5, h: 3, top: 5, advance: 5, rows: [14, 0, 0] },
      "/": { w: 5, h: 5, top: 3, advance: 5, rows: [2, 2, 6, 12, 12] },
      "%": { w: 7, h: 5, top: 3, advance: 7, rows: [60, 60, 8, 30, 30] },
      "!": { w: 4, h: 5, top: 3, advance: 4, rows: [6, 6, 6, 0, 6] },
      "?": { w: 6, h: 5, top: 3, advance: 6, rows: [28, 6, 12, 0, 12] },
      "+": { w: 7, h: 5, top: 3, advance: 7, rows: [8, 8, 62, 8, 8] },
      "space": { w: 4, h: 0, top: 0, advance: 4, rows: [] },
      "A": { w: 6, h: 5, top: 3, advance: 6, rows: [12, 30, 30, 30, 30] },
      "B": { w: 6, h: 5, top: 3, advance: 6, rows: [28, 30, 30, 30, 28] },
      "C": { w: 6, h: 5, top: 3, advance: 6, rows: [12, 30, 24, 30, 12] },
      "D": { w: 6, h: 5, top: 3, advance: 6, rows: [28, 30, 30, 30, 28] },
      "E": { w: 5, h: 5, top: 3, advance: 5, rows: [14, 12, 14, 12, 14] },
      "F": { w: 5, h: 5, top: 3, advance: 5, rows: [14, 12, 14, 12, 12] },
      "G": { w: 6, h: 5, top: 3, advance: 6, rows: [14, 24, 30, 30, 12] },
      "H": { w: 6, h: 5, top: 3, advance: 6, rows: [30, 30, 30, 30, 30] },
      "I": { w: 4, h: 5, top: 3, advance: 4, rows: [6, 6, 6, 6, 6] },
      "J": { w: 6, h: 5, top: 3, advance: 6, rows: [6, 6, 6, 30, 12] },
      "K": { w: 6, h: 5, top: 3, advance: 6, rows: [30, 28, 28, 28, 30] },
      "L": { w: 5, h: 5, top: 3, advance: 5, rows: [12, 12, 12, 12, 14] },
      "M": { w: 7, h: 5, top: 3, advance: 7, rows: [54, 62, 62, 54, 54] },
      "N": { w: 7, h: 5, top: 3, advance: 7, rows: [54, 62, 62, 62, 54] },
      "O": { w: 6, h: 5, top: 3, advance: 6, rows: [12, 30, 30, 30, 12] },
      "P": { w: 6, h: 5, top: 3, advance: 6, rows: [28, 30, 28, 24, 24] },
      "Q": { w: 6, h: 7, top: 3, advance: 6, rows: [12, 30, 30, 30, 12, 6, 0] },
      "R": { w: 6, h: 5, top: 3, advance: 6, rows: [28, 30, 28, 28, 30] },
      "S": { w: 6, h: 5, top: 3, advance: 6, rows: [14, 24, 12, 6, 28] },
      "T": { w: 5, h: 5, top: 3, advance: 5, rows: [14, 6, 6, 6, 6] },
      "U": { w: 6, h: 5, top: 3, advance: 6, rows: [30, 30, 30, 30, 12] },
      "V": { w: 7, h: 5, top: 3, advance: 7, rows: [54, 54, 28, 28, 8] },
      "W": { w: 7, h: 5, top: 3, advance: 7, rows: [54, 62, 62, 62, 28] },
      "X": { w: 7, h: 5, top: 3, advance: 7, rows: [54, 28, 8, 28, 54] },
      "Y": { w: 7, h: 5, top: 3, advance: 7, rows: [54, 28, 8, 8, 8] },
      "Z": { w: 5, h: 5, top: 3, advance: 5, rows: [14, 2, 6, 12, 14] },
    },
  },
};
