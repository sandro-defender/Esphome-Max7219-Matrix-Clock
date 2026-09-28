import { GENERATED_FONTS, type GeneratedFont } from "./glyphs.generated";

/**
 * Font engine for the live preview.
 *
 * The bitmaps come from the very files the firmware compiles
 * (see scripts/generate_glyphs.py), so what the browser paints is what the
 * MAX7219 shows. The built-in 5x7 font mirrors `BuiltinFont` in
 * packages/max7219_clock_renderer.h, including its per-character advances.
 */

export interface PixelTarget {
  width: number;
  height: number;
  pixels: Uint8Array;
}

export interface Glyph {
  /** Ink width in pixels. */
  w: number;
  /** Ink height in pixels. */
  h: number;
  /** Rows of ink, most significant bit = leftmost pixel. */
  rows: number[];
  /** Distance from the text box top to the first ink row. */
  top: number;
  /** Horizontal step to the next glyph, rounded up like ESPHome. */
  advance: number;
}

export interface PreviewFont {
  readonly id: string;
  readonly label: string;
  /** True for the built-in 5x7 bitmap font that is always compiled. */
  readonly builtin: boolean;
  /** Ink height of the digit 0; the renderer centres the text on it. */
  readonly inkHeight: number;
  /** Offset of the digit 0 ink from the text box top. */
  readonly inkTop: number;
  /** Width of "HH:MM:SS" in pixels, the budget of the default 48 px panel. */
  readonly clockWidth: number;
  /** Tallest digit in pixels. */
  readonly maxDigitHeight: number;
  glyph(ch: string): Glyph | null;
  advance(ch: string): number;
  /** Width of a string; `null` when a character is not compiled. */
  measure(text: string): number | null;
  /** Text box top that centres the digits inside a band, like the firmware. */
  boxTop(bandHeight: number): number;
  /** Draw one character with its text box top at `boxTop`. */
  drawGlyph(target: PixelTarget, ch: string, x: number, boxTop: number): void;
}

export function setPixel(target: PixelTarget, x: number, y: number, value = 1): void {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= target.width || py >= target.height) return;
  target.pixels[py * target.width + px] = value;
}

export function drawGlyphRows(target: PixelTarget, glyph: Glyph, x: number, y: number): void {
  for (let row = 0; row < glyph.rows.length; row++) {
    const bits = glyph.rows[row];
    if (!bits) continue;
    for (let col = 0; col < glyph.w; col++) {
      if (bits & (1 << (glyph.w - 1 - col))) setPixel(target, x + col, y + row);
    }
  }
}

// -------------------------------------------------------------------------
// Built-in 5x7 font (packages/max7219_clock_renderer.h, namespace builtin)
// -------------------------------------------------------------------------

/** 7 rows, 5 columns, bit 4 = leftmost pixel. */
export const BUILTIN_DIGITS: number[][] = [
  [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  [0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110],
  [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  [0b11111, 0b10000, 0b10000, 0b11110, 0b00001, 0b00001, 0b11110],
  [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b11100],
];

export const BUILTIN_LETTERS: number[][] = [
  [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001], // A
  [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110], // B
  [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110], // C
  [0b11100, 0b10010, 0b10001, 0b10001, 0b10001, 0b10010, 0b11100], // D
  [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111], // E
  [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000], // F
  [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110], // G
  [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001], // H
  [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110], // I
  [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100], // J
  [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001], // K
  [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111], // L
  [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001], // M
  [0b10001, 0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001], // N
  [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110], // O
  [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000], // P
  [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101], // Q
  [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001], // R
  [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110], // S
  [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100], // T
  [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110], // U
  [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100], // V
  [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001], // W
  [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001], // X
  [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100], // Y
  [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111], // Z
];

const BUILTIN_PUNCTUATION: Record<string, number[]> = {
  " ": [0, 0, 0, 0, 0, 0, 0],
  ":": [0b00000, 0b01100, 0b01100, 0b00000, 0b01100, 0b01100, 0b00000],
  ".": [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b01100, 0b01100],
  ",": [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00100, 0b01000],
  "-": [0b00000, 0b00000, 0b00000, 0b01110, 0b00000, 0b00000, 0b00000],
  _: [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000],
  "/": [0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b00000, 0b00000],
  "%": [0b01101, 0b01101, 0b00010, 0b00100, 0b01000, 0b10110, 0b10110],
  "!": [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00000, 0b00100],
  "?": [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b00000, 0b00100],
  "+": [0b00000, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0b00000],
};

function builtinRows(ch: string): number[] {
  const upper = ch.toUpperCase();
  if (upper >= "0" && upper <= "9") return BUILTIN_DIGITS[Number(upper)];
  if (upper >= "A" && upper <= "Z") return BUILTIN_LETTERS[upper.charCodeAt(0) - 65];
  return BUILTIN_PUNCTUATION[upper] ?? BUILTIN_PUNCTUATION[" "];
}

function builtinAdvance(ch: string): number {
  switch (ch) {
    case ":":
    case ".":
    case ",":
    case "!":
    case " ":
      return 3;
    default:
      return 6;
  }
}

class BuiltinPreviewFont implements PreviewFont {
  readonly id = "builtin";
  readonly label = "Compact 5x7";
  readonly builtin = true;
  readonly inkHeight = 7;
  readonly inkTop = 0;
  readonly clockWidth = 42;
  readonly maxDigitHeight = 7;

  glyph(ch: string): Glyph {
    return { w: 5, h: 7, rows: builtinRows(ch), top: 0, advance: builtinAdvance(ch) };
  }

  advance(ch: string): number {
    return builtinAdvance(ch);
  }

  measure(text: string): number {
    let width = 0;
    for (const ch of text) width += builtinAdvance(ch);
    return width;
  }

  boxTop(bandHeight: number): number {
    return Math.floor((bandHeight - this.inkHeight) / 2) - this.inkTop;
  }

  drawGlyph(target: PixelTarget, ch: string, x: number, boxTop: number): void {
    drawGlyphRows(target, this.glyph(ch), x, boxTop);
  }
}

class GeneratedPreviewFont implements PreviewFont {
  readonly builtin = false;

  constructor(
    readonly id: string,
    readonly label: string,
    private readonly font: GeneratedFont,
  ) {}

  get inkHeight(): number {
    return this.font.inkHeight;
  }

  get inkTop(): number {
    return this.font.inkTop;
  }

  get clockWidth(): number {
    return this.font.clockWidth;
  }

  get maxDigitHeight(): number {
    return this.font.maxDigitHeight;
  }

  glyph(ch: string): Glyph | null {
    // The generator stores the space under a readable key.
    const key = ch === " " ? "space" : ch;
    const entry = this.font.glyphs[key] ?? this.font.glyphs[key.toUpperCase()];
    if (!entry) return null;
    return { w: entry.w, h: entry.h, rows: entry.rows, top: entry.top, advance: entry.advance };
  }

  advance(ch: string): number {
    return this.glyph(ch)?.advance ?? 0;
  }

  measure(text: string): number | null {
    let width = 0;
    for (const ch of text) {
      const glyph = this.glyph(ch);
      if (!glyph) return null;
      width += glyph.advance;
    }
    return width;
  }

  boxTop(bandHeight: number): number {
    return Math.floor((bandHeight - this.font.inkHeight) / 2) - this.font.inkTop;
  }

  drawGlyph(target: PixelTarget, ch: string, x: number, boxTop: number): void {
    const glyph = this.glyph(ch);
    if (!glyph) return;
    drawGlyphRows(target, glyph, x, boxTop + glyph.top);
  }
}

const cache = new Map<string, PreviewFont>();

/** Built-in 5x7 fallback font; never missing, never downloads anything. */
export const BUILTIN_FONT: PreviewFont = new BuiltinPreviewFont();

/** Preview font for an ESPHome font id such as `font_tiny5_source`. */
export function generatedFont(id: string, label: string): PreviewFont | null {
  const source = GENERATED_FONTS[id];
  if (!source) return null;
  const key = `${id}::${label}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const font = new GeneratedPreviewFont(id, label, source);
  cache.set(key, font);
  return font;
}

// -------------------------------------------------------------------------
// Message text normalisation (shared with the firmware's upper-case messages)
// -------------------------------------------------------------------------

export const GLYPH_ORDER = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ .,:!?-+/#%'";

/** 3x5 glyphs, bit 2 = left pixel. Index matches GLYPH_ORDER. */
export const FONT_3X5: Record<string, number[]> = {
  "0": [0b111, 0b101, 0b101, 0b101, 0b111],
  "1": [0b010, 0b110, 0b010, 0b010, 0b111],
  "2": [0b111, 0b001, 0b111, 0b100, 0b111],
  "3": [0b111, 0b001, 0b111, 0b001, 0b111],
  "4": [0b101, 0b101, 0b111, 0b001, 0b001],
  "5": [0b111, 0b100, 0b111, 0b001, 0b111],
  "6": [0b111, 0b100, 0b111, 0b101, 0b111],
  "7": [0b111, 0b001, 0b010, 0b010, 0b010],
  "8": [0b111, 0b101, 0b111, 0b101, 0b111],
  "9": [0b111, 0b101, 0b111, 0b001, 0b111],
  A: [0b010, 0b101, 0b111, 0b101, 0b101],
  B: [0b110, 0b101, 0b110, 0b101, 0b110],
  C: [0b111, 0b100, 0b100, 0b100, 0b111],
  D: [0b110, 0b101, 0b101, 0b101, 0b110],
  E: [0b111, 0b100, 0b110, 0b100, 0b111],
  F: [0b111, 0b100, 0b110, 0b100, 0b100],
  G: [0b111, 0b100, 0b101, 0b101, 0b111],
  H: [0b101, 0b101, 0b111, 0b101, 0b101],
  I: [0b111, 0b010, 0b010, 0b010, 0b111],
  J: [0b001, 0b001, 0b001, 0b101, 0b111],
  K: [0b101, 0b110, 0b100, 0b110, 0b101],
  L: [0b100, 0b100, 0b100, 0b100, 0b111],
  M: [0b101, 0b111, 0b111, 0b101, 0b101],
  N: [0b110, 0b101, 0b101, 0b101, 0b101],
  O: [0b111, 0b101, 0b101, 0b101, 0b111],
  P: [0b111, 0b101, 0b111, 0b100, 0b100],
  Q: [0b111, 0b101, 0b101, 0b111, 0b001],
  R: [0b111, 0b101, 0b110, 0b101, 0b101],
  S: [0b011, 0b100, 0b010, 0b001, 0b110],
  T: [0b111, 0b010, 0b010, 0b010, 0b010],
  U: [0b101, 0b101, 0b101, 0b101, 0b111],
  V: [0b101, 0b101, 0b101, 0b101, 0b010],
  W: [0b101, 0b101, 0b111, 0b111, 0b101],
  X: [0b101, 0b101, 0b010, 0b101, 0b101],
  Y: [0b101, 0b101, 0b010, 0b010, 0b010],
  Z: [0b111, 0b001, 0b010, 0b100, 0b111],
  " ": [0b000, 0b000, 0b000, 0b000, 0b000],
  ".": [0b000, 0b000, 0b000, 0b000, 0b010],
  ",": [0b000, 0b000, 0b000, 0b010, 0b100],
  ":": [0b000, 0b010, 0b000, 0b010, 0b000],
  "!": [0b010, 0b010, 0b010, 0b000, 0b010],
  "?": [0b111, 0b001, 0b011, 0b000, 0b010],
  "-": [0b000, 0b000, 0b111, 0b000, 0b000],
  "+": [0b000, 0b010, 0b111, 0b010, 0b000],
  "/": [0b001, 0b001, 0b010, 0b100, 0b100],
  "#": [0b101, 0b111, 0b101, 0b111, 0b101],
  "%": [0b101, 0b001, 0b010, 0b100, 0b101],
  "'": [0b010, 0b010, 0b000, 0b000, 0b000],
};

export function glyphIndex(ch: string): number {
  return GLYPH_ORDER.indexOf(ch >= "a" && ch <= "z" ? ch.toUpperCase() : ch);
}

/** Upper-case, collapse spaces and drop anything the firmware cannot print. */
export function normalizeMessage(raw: string): string {
  const upper = raw.toUpperCase().replace(/[\r\n\t]+/g, " ");
  let out = "";
  let space = false;
  for (const ch of upper) {
    if (ch === " ") {
      if (space || out.length === 0) continue;
      space = true;
      out += ch;
      continue;
    }
    if (glyphIndex(ch) >= 0) {
      space = false;
      out += ch;
    }
  }
  return out.replace(/ $/, "");
}

// -------------------------------------------------------------------------
// Shared text drawing, mirroring the firmware's draw_line()/draw_free_text()
// -------------------------------------------------------------------------

export function alignStart(alignment: "Left" | "Center" | "Right", textWidth: number, panelWidth: number): number {
  if (alignment === "Left") return 0;
  if (alignment === "Right") return panelWidth - textWidth;
  return Math.floor((panelWidth - textWidth) / 2);
}

export function drawTextLine(
  target: PixelTarget,
  font: PreviewFont,
  text: string,
  x: number,
  boxTop: number,
): void {
  let cursor = x;
  for (const ch of text) {
    font.drawGlyph(target, ch, cursor, boxTop);
    cursor += font.advance(ch);
  }
}
