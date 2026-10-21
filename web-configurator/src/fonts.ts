import { FIRMWARE } from "./firmware";
import { GENERATED_FONTS, BUILTIN_GLYPHS, BUILTIN_ADVANCES, BUILTIN_METRICS, type GeneratedFont } from "./glyphs.generated";
import {
  MAX7219_CUSTOM_BIG_DIGIT_ADVANCES,
  MAX7219_CUSTOM_BIG_DIGIT_ROWS,
  MAX7219_GEORGIAN_ADVANCES,
  MAX7219_GEORGIAN_CODEPOINTS,
  MAX7219_GEORGIAN_ROWS,
  MAX7219_MKHEDRULI_ADVANCES,
  MAX7219_MKHEDRULI_ROWS,
} from "./date_font.generated";
import type { DigitStyle, LetterStyle } from "./types";

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
  clip?: { x: number; y: number; width: number; height: number };
  /** Optional local view into a larger row-major frame. */
  offsetX?: number;
  offsetY?: number;
  stride?: number;
}

export interface Glyph {
  /** Ink width in pixels. */
  w: number;
  left?: number;
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
  if (target.clip && (px < target.clip.x || py < target.clip.y || px >= target.clip.x + target.clip.width || py >= target.clip.y + target.clip.height)) return;
  const absoluteX = (target.offsetX ?? 0) + px;
  const absoluteY = (target.offsetY ?? 0) + py;
  const stride = target.stride ?? target.width;
  if (absoluteX < 0 || absoluteY < 0 || absoluteX >= stride) return;
  const index = absoluteY * stride + absoluteX;
  if (index < 0 || index >= target.pixels.length) return;
  target.pixels[index] = value;
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

/** The C++ source is authoritative, including fallback punctuation. */
export const BUILTIN_DIGITS = Array.from({ length: 10 }, (_, i) => BUILTIN_GLYPHS[String(i)]);
export const BUILTIN_LETTERS = Array.from({ length: 26 }, (_, i) => BUILTIN_GLYPHS[String.fromCharCode(65 + i)]);

const GEORGIAN_GLYPHS: Record<string, number[]> = {
  "\x80": [0b00110,0b00001,0b00100,0b00001,0b10001,0b10001,0b01100], "\x81": [0b00110,0b10001,0b00001,0b00100,0b00001,0b10001,0b01100],
  "\x82": [0b00110,0b10001,0b10001,0b10001,0b10001,0b00000,0b00000], "\x83": [0b01011,0b10101,0b10101,0b10001,0b10001,0b00000,0b00000],
  "\x84": [0b00111,0b11000,0b11011,0b10101,0b10101,0b10000,0b10000], "\x85": [0b10110,0b01010,0b01110,0b10001,0b10001,0b10001,0b01100],
  "\x86": [0b10000,0b10000,0b10100,0b10010,0b10010,0b10010,0b01100], "\x87": [0b01000,0b00100,0b10010,0b10010,0b01100,0b00000,0b00000],
  "\x88": [0b00110,0b10001,0b01110,0b10001,0b10001,0b10001,0b01100], "\x89": [0b01101,0b10010,0b10010,0b10010,0b10010,0b01101,0b00000],
  "\x8A": [0b10000,0b10000,0b11100,0b10010,0b10010,0b10010,0b01100], "\x8B": [0b10110,0b01010,0b01010,0b00010,0b10010,0b10010,0b01100],
  "\x8C": [0b01000,0b00110,0b00001,0b00100,0b00001,0b10001,0b11100], "\x8D": [0b01000,0b00100,0b11100,0b10010,0b10010,0b10010,0b01100],
  "\x8E": [0b11100,0b10000,0b11100,0b10010,0b10010,0b10010,0b01100], "\x8F": [0b00110,0b10001,0b10001,0b00001,0b10001,0b10001,0b01100],
  "\x90": [0b11011,0b10100,0b10100,0b10100,0b10110,0b00100,0b01010], "\x91": [0b01110,0b01010,0b00100,0b11010,0b10001,0b10001,0b01100],
  "\x92": [0b11011,0b10101,0b10101,0b10101,0b10001,0b00100,0b01100], "\x93": [0b00001,0b00001,0b11110,0b10001,0b10001,0b00001,0b01100],
  "\x94": [0b10010,0b10001,0b10110,0b10001,0b10001,0b11001,0b01110],
};
function builtinRows(ch: string): number[] { return GEORGIAN_GLYPHS[ch] ?? BUILTIN_GLYPHS[ch.replace(/[a-z]/g, (char) => char.toUpperCase())] ?? BUILTIN_GLYPHS[" "]; }
function builtinAdvance(ch: string): number { return BUILTIN_ADVANCES[ch] ?? BUILTIN_METRICS.defaultAdvance; }

const LATIN_TO_GEORGIAN_MAP: readonly number[] = [
  0x10D0, 0x10D1, 0x10EA, 0x10D3, 0x10D4, 0x10E4, 0x10D2, 0x10F0, 0x10D8,
  0x10EF, 0x10D9, 0x10DA, 0x10DB, 0x10DC, 0x10DD, 0x10DE, 0x10E7, 0x10E0,
  0x10E1, 0x10E2, 0x10E3, 0x10D5, 0x10EC, 0x10EE, 0x10E6, 0x10D6,
];

export function latinToGeorgianChar(ch: string): string {
  const lower = ch.toLowerCase();
  const code = lower.charCodeAt(0);
  if (code >= 97 && code <= 122) return String.fromCodePoint(LATIN_TO_GEORGIAN_MAP[code - 97]);
  return ch;
}

/** Matches C++ `next_utf8_codepoint` + single-byte 0x80..0x94 date tokens. */
export function textCells(text: string): string[] {
  return [...text];
}

class BuiltinPreviewFont implements PreviewFont {
  readonly id: string = "builtin";
  readonly label: string = "Compact 5x7";
  readonly builtin = true;
  readonly inkHeight: number = BUILTIN_METRICS.inkHeight;
  readonly inkTop: number = BUILTIN_METRICS.inkTop;
  readonly clockWidth: number = BUILTIN_METRICS.clockWidth;
  readonly maxDigitHeight: number = BUILTIN_METRICS.maxDigitHeight;

  glyph(ch: string): Glyph {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0xE000 && cp <= 0xE009) {
      return {
        w: 8,
        h: 8,
        top: 0,
        rows: [...MAX7219_CUSTOM_BIG_DIGIT_ROWS[cp - 0xE000]],
        advance: MAX7219_CUSTOM_BIG_DIGIT_ADVANCES[cp - 0xE000],
      };
    }
    if (cp >= 0x10D0 && cp <= 0x10F0) {
      return {
        w: 8,
        h: 8,
        top: 0,
        rows: [...MAX7219_MKHEDRULI_ROWS[cp - 0x10D0]],
        advance: MAX7219_MKHEDRULI_ADVANCES[cp - 0x10D0],
      };
    }
    return { w: 5, h: 7, rows: builtinRows(ch), top: 0, advance: builtinAdvance(ch) };
  }

  advance(ch: string): number {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0xE000 && cp <= 0xE009) return MAX7219_CUSTOM_BIG_DIGIT_ADVANCES[cp - 0xE000];
    if (cp >= 0x10D0 && cp <= 0x10F0) return MAX7219_MKHEDRULI_ADVANCES[cp - 0x10D0];
    return builtinAdvance(ch);
  }

  measure(text: string): number {
    let width = 0;
    for (const ch of textCells(text)) width += this.advance(ch);
    return width;
  }

  boxTop(bandHeight: number): number {
    return Math.floor((bandHeight - this.inkHeight) / 2) - this.inkTop;
  }

  drawGlyph(target: PixelTarget, ch: string, x: number, boxTop: number): void {
    drawGlyphRows(target, this.glyph(ch), x, boxTop);
  }
}

class GeorgianDatePreviewFont extends BuiltinPreviewFont {
  readonly id = "georgian-date";
  readonly label = "Georgian date";
  readonly inkHeight = 8;
  readonly maxDigitHeight = 8;

  glyph(ch: string): Glyph {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x80 && code < 0x80 + 21) {
      return {
        w: 8,
        h: 8,
        top: 0,
        rows: [...MAX7219_GEORGIAN_ROWS[code - 0x80]],
        advance: MAX7219_GEORGIAN_ADVANCES[code - 0x80],
      };
    }
    const dateIdx = MAX7219_GEORGIAN_CODEPOINTS.indexOf(code as typeof MAX7219_GEORGIAN_CODEPOINTS[number]);
    if (dateIdx >= 0) {
      return {
        w: 8,
        h: 8,
        top: 0,
        rows: [...MAX7219_GEORGIAN_ROWS[dateIdx]],
        advance: MAX7219_GEORGIAN_ADVANCES[dateIdx],
      };
    }
    return super.glyph(ch);
  }

  advance(ch: string): number {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x80 && code < 0x80 + 21) return MAX7219_GEORGIAN_ADVANCES[code - 0x80];
    const dateIdx = MAX7219_GEORGIAN_CODEPOINTS.indexOf(code as typeof MAX7219_GEORGIAN_CODEPOINTS[number]);
    if (dateIdx >= 0) return MAX7219_GEORGIAN_ADVANCES[dateIdx];
    return super.advance(ch);
  }

  measure(text: string): number {
    let width = 0;
    for (const ch of textCells(text)) width += this.advance(ch);
    return width;
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
    const code = ch.codePointAt(0) ?? 0;
    let lookup = ch;
    if (code >= 0x80 && code < 0x80 + 21) {
      lookup = String.fromCodePoint(MAX7219_GEORGIAN_CODEPOINTS[code - 0x80]);
    }
    // The generator stores the space under a readable key.
    const key = lookup === " " ? "space" : lookup;
    const entry = this.font.glyphs[key] ?? (code < 0x80 ? this.font.glyphs[key.toUpperCase()] : undefined);
    if (!entry) return null;
    return { w: entry.w, h: entry.h, rows: entry.rows, left: entry.left, top: entry.top, advance: entry.advance };
  }

  advance(ch: string): number {
    return this.glyph(ch)?.advance ?? 0;
  }

  measure(text: string): number | null {
    let width = 0;
    for (const ch of textCells(text)) {
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
    drawGlyphRows(target, glyph, x + (glyph.left ?? 0), boxTop + glyph.top);
  }
}

class StyledPreviewFont implements PreviewFont {
  constructor(
    private readonly base: PreviewFont,
    private readonly digitStyle: DigitStyle,
    private readonly letterStyle: LetterStyle,
  ) {}

  get id(): string {
    return `${this.base.id}::${this.digitStyle}::${this.letterStyle}`;
  }

  get label(): string {
    return this.base.label;
  }

  get builtin(): boolean {
    return this.base.builtin;
  }

  private get usesBigDigits(): boolean {
    return this.digitStyle === "Custom big 0-9" && this.base.advance("\uE000") > 0;
  }

  get inkHeight(): number {
    if (this.usesBigDigits) return this.base.glyph("\uE000")?.h ?? 8;
    return this.base.inkHeight;
  }

  get inkTop(): number {
    if (this.usesBigDigits) return this.base.glyph("\uE000")?.top ?? 0;
    return this.base.inkTop;
  }

  get clockWidth(): number {
    return this.measure("88:88:88") ?? this.base.clockWidth;
  }

  get maxDigitHeight(): number {
    if (this.usesBigDigits) return 8;
    return this.base.maxDigitHeight;
  }

  private mapChar(ch: string): string {
    const cp = ch.codePointAt(0) ?? 0;
    if (this.digitStyle === "Custom big 0-9" && cp >= 48 && cp <= 57) {
      const big = String.fromCodePoint(0xE000 + (cp - 48));
      if (this.base.advance(big) > 0) return big;
    }
    if (this.letterStyle === "Georgian" && ((cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122))) {
      const ge = latinToGeorgianChar(ch);
      if (this.base.advance(ge) > 0) return ge;
    }
    return ch;
  }

  glyph(ch: string): Glyph | null {
    return this.base.glyph(this.mapChar(ch));
  }

  advance(ch: string): number {
    return this.base.advance(this.mapChar(ch));
  }

  measure(text: string): number | null {
    let width = 0;
    for (const ch of textCells(text)) {
      const step = this.advance(ch);
      if (step <= 0) return null;
      width += step;
    }
    return width;
  }

  boxTop(bandHeight: number): number {
    return Math.floor((bandHeight - this.inkHeight) / 2) - this.inkTop;
  }

  drawGlyph(target: PixelTarget, ch: string, x: number, boxTop: number): void {
    this.base.drawGlyph(target, this.mapChar(ch), x, boxTop);
  }
}

export function styledPreviewFont(
  base: PreviewFont,
  digitStyle: DigitStyle = "Standard 0-9",
  letterStyle: LetterStyle = "English",
): PreviewFont {
  if (digitStyle === "Standard 0-9" && letterStyle === "English") return base;
  return new StyledPreviewFont(base, digitStyle, letterStyle);
}

const cache = new Map<string, PreviewFont>();

/** Built-in 5x7 fallback font; never missing, never downloads anything. */
export const BUILTIN_FONT: PreviewFont = new BuiltinPreviewFont();

/** Matches the firmware's larger Georgian weekday and month lettering. */
export const GEORGIAN_DATE_FONT: PreviewFont = new GeorgianDatePreviewFont();

/** Preview font for an ESPHome font id such as `font_max7219_source`. */
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

/** Match copy_utf8_truncated() and upper_ascii(): preserve spaces/unknowns. */
export function normalizeMessage(raw: string, maxBytes = FIRMWARE.renderer.messageMaxBytes): string {
  const bytes = new TextEncoder().encode(raw);
  let end = Math.min(bytes.length, maxBytes);
  if (bytes.length > end) while (end > 0 && (bytes[end] & 0xc0) === 0x80) end--;
  const text = new TextDecoder().decode(bytes.slice(0, end));
  return text.replace(/[a-z]/g, (char) => char.toUpperCase());
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
  for (const ch of textCells(text)) {
    font.drawGlyph(target, ch, cursor, boxTop);
    cursor += font.advance(ch);
  }
}
