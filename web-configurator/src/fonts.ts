import { FIRMWARE } from "./firmware";
import { GENERATED_FONTS, BUILTIN_GLYPHS, BUILTIN_ADVANCES, BUILTIN_METRICS, type GeneratedFont } from "./glyphs.generated";

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

function builtinRows(ch: string): number[] {
  return BUILTIN_GLYPHS[ch.replace(/[a-z]/g, (char) => char.toUpperCase())] ?? BUILTIN_GLYPHS[" "];
}
function builtinAdvance(ch: string): number { return BUILTIN_ADVANCES[ch] ?? BUILTIN_METRICS.defaultAdvance; }

function isMkhedruli(ch: string): boolean {
  const codepoint = ch.codePointAt(0) ?? 0;
  return codepoint >= 0x10d0 && codepoint <= 0x10f0;
}

/** Firmware text walks UTF-8 by Unicode code point, not by encoded byte. */
export function textCells(text: string): string[] {
  return [...text];
}

class BuiltinPreviewFont implements PreviewFont {
  readonly id: string = "builtin";
  readonly label: string = "Compact 5x7";
  readonly builtin: boolean = true;
  readonly inkHeight = BUILTIN_METRICS.inkHeight;
  readonly inkTop = BUILTIN_METRICS.inkTop;
  readonly clockWidth = BUILTIN_METRICS.clockWidth;
  readonly maxDigitHeight = BUILTIN_METRICS.maxDigitHeight;

  glyph(ch: string): Glyph | null {
    if (isMkhedruli(ch)) return null;
    return { w: 5, h: 7, rows: builtinRows(ch), top: 0, advance: builtinAdvance(ch) };
  }

  advance(ch: string): number {
    return isMkhedruli(ch) ? 0 : builtinAdvance(ch);
  }

  measure(text: string): number | null {
    let width = 0;
    for (const ch of textCells(text)) {
      const advance = this.advance(ch);
      if (advance === 0) return null;
      width += advance;
    }
    return width;
  }

  boxTop(bandHeight: number): number {
    return Math.floor((bandHeight - this.inkHeight) / 2) - this.inkTop;
  }

  drawGlyph(target: PixelTarget, ch: string, x: number, boxTop: number): void {
    const glyph = this.glyph(ch);
    if (glyph) drawGlyphRows(target, glyph, x, boxTop);
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
    return { w: entry.w, h: entry.h, rows: entry.rows, left: entry.left, top: entry.top, advance: entry.advance };
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
    drawGlyphRows(target, glyph, x + (glyph.left ?? 0), boxTop + glyph.top);
  }
}


const GEORGIAN_FONT_ID = "font_georgian_mkhedruli_8x8_source";

/**
 * The generated source-table face handles every clock glyph and Mkhedruli
 * letter. Compact 5x7 supplies Latin for mixed free-text messages.
 */
class GeorgianBitmapPreviewFont extends BuiltinPreviewFont {
  readonly id = "georgian-mkhedruli-8x8";
  readonly label = "Georgian Mkhedruli 8x8";
  readonly builtin = false;
  readonly inkHeight = 8;
  readonly maxDigitHeight = 8;
  private readonly source = new GeneratedPreviewFont(
    GEORGIAN_FONT_ID,
    "Georgian Mkhedruli 8x8",
    GENERATED_FONTS[GEORGIAN_FONT_ID],
  );

  glyph(ch: string): Glyph | null {
    return this.source.glyph(ch) ?? super.glyph(ch);
  }

  advance(ch: string): number {
    return this.source.advance(ch) || super.advance(ch);
  }

  measure(text: string): number | null {
    let width = 0;
    for (const ch of textCells(text)) {
      const advance = this.advance(ch);
      if (advance === 0) return null;
      width += advance;
    }
    return width;
  }

  drawGlyph(target: PixelTarget, ch: string, x: number, boxTop: number): void {
    if (this.source.glyph(ch)) this.source.drawGlyph(target, ch, x, boxTop);
    else super.drawGlyph(target, ch, x, boxTop);
  }
}

const cache = new Map<string, PreviewFont>();

/** Built-in 5x7 fallback font; never missing, never downloads anything. */
export const BUILTIN_FONT: PreviewFont = new BuiltinPreviewFont();

/** Matches the firmware's larger Georgian weekday and month lettering. */
export const GEORGIAN_DATE_FONT: PreviewFont = new GeorgianBitmapPreviewFont();

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
