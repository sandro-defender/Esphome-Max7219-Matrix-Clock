/** 5×7 digits, bit 4 = left pixel. Same bitmaps as the original clock lambda. */
export const DIGITS_5X7: number[][] = [
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

/** Blood Drip 5×7 digits with dripping droplets, jagged cuts, and bleeding strokes. */
export const BLOOD_DRIP_5X7: number[][] = [
  [0b01110, 0b11011, 0b10001, 0b10001, 0b11011, 0b01110, 0b10101], // 0 - dual drip drops
  [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b01110, 0b00101], // 1 - trailing drip
  [0b11110, 0b00011, 0b00110, 0b01100, 0b11000, 0b11111, 0b10010], // 2 - dripping base
  [0b11110, 0b00011, 0b01110, 0b00011, 0b00011, 0b11110, 0b00101], // 3 - lower curve drip
  [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00110], // 4 - dripping stem
  [0b11111, 0b10000, 0b11110, 0b00011, 0b00011, 0b11110, 0b10010], // 5 - loop drip
  [0b00110, 0b01000, 0b10000, 0b11110, 0b11011, 0b01110, 0b01010], // 6 - dripping base
  [0b11111, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0b01001], // 7 - angled drop
  [0b01110, 0b11011, 0b01110, 0b11011, 0b11011, 0b01110, 0b10101], // 8 - dual drips
  [0b01110, 0b11011, 0b11011, 0b01111, 0b00011, 0b11110, 0b00101], // 9 - descending drip
];

/** Blood Bold 5×7 digits: thick 2-pixel wide solid strokes filling the 8x8 segment. */
export const BLOOD_BOLD_5X7: number[][] = [
  [0b11111, 0b11011, 0b11011, 0b11011, 0b11011, 0b11011, 0b11111], // 0 - heavy box
  [0b00110, 0b01110, 0b00110, 0b00110, 0b00110, 0b00110, 0b01111], // 1 - thick stem
  [0b11110, 0b11011, 0b00011, 0b00110, 0b01100, 0b11000, 0b11111], // 2 - heavy 2
  [0b11110, 0b00011, 0b00011, 0b01110, 0b00011, 0b00011, 0b11110], // 3 - thick 3
  [0b00110, 0b01110, 0b11010, 0b11010, 0b11111, 0b00010, 0b00010], // 4 - thick fork
  [0b11111, 0b11000, 0b11110, 0b00011, 0b00011, 0b11011, 0b01110], // 5 - thick 5
  [0b01110, 0b11000, 0b11110, 0b11011, 0b11011, 0b11011, 0b01110], // 6 - heavy 6
  [0b11111, 0b00011, 0b00110, 0b01100, 0b01100, 0b01100, 0b01100], // 7 - heavy 7
  [0b01110, 0b11011, 0b11011, 0b01110, 0b11011, 0b11011, 0b01110], // 8 - heavy 8
  [0b01110, 0b11011, 0b11011, 0b01111, 0b00011, 0b00011, 0b01110], // 9 - heavy 9
];

/** 3×5 glyphs, bit 2 = left pixel. Index matches GLYPH_ORDER. */
export const GLYPH_ORDER = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ .,:!?-+/#%'";

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
  const up = ch >= "a" && ch <= "z" ? ch.toUpperCase() : ch;
  return GLYPH_ORDER.indexOf(up);
}

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
      out += ch.toUpperCase();
    }
  }
  return out.replace(/ $/, "");
}

export function textWidth3(text: string, advance = 4): number {
  let n = 0;
  for (const ch of text) if (glyphIndex(ch) >= 0) n += 1;
  if (n === 0) return 0;
  return (n - 1) * advance + 3;
}

export function cppDigitRows(): string {
  return DIGITS_5X7.map((rows, digit) => {
    const body = rows.map((b) => "0b" + b.toString(2).padStart(5, "0")).join(", ");
    return `    {${body}}, // ${digit}`;
  }).join("\n");
}

export function cppBloodDripRows(): string {
  return BLOOD_DRIP_5X7.map((rows, digit) => {
    const body = rows.map((b) => "0b" + b.toString(2).padStart(5, "0")).join(", ");
    return `    {${body}}, // ${digit}`;
  }).join("\n");
}

export function cppBloodBoldRows(): string {
  return BLOOD_BOLD_5X7.map((rows, digit) => {
    const body = rows.map((b) => "0b" + b.toString(2).padStart(5, "0")).join(", ");
    return `    {${body}}, // ${digit}`;
  }).join("\n");
}

export function cppGlyphRows(): string {
  return GLYPH_ORDER.split("").map((ch) => {
    const rows = FONT_3X5[ch] ?? [0, 0, 0, 0, 0];
    const body = rows.map((b) => "0b" + b.toString(2).padStart(3, "0")).join(", ");
    return `    {${body}}, // ${ch === " " ? "space" : ch}`;
  }).join("\n");
}

export function cGlyphIndexLiteral(): string {
  return GLYPH_ORDER.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
