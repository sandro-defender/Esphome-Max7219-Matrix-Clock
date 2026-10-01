import { BUILTIN_FONT, generatedFont, type PreviewFont } from "./fonts";
import type { ClockFont } from "./types";

export interface FontSpec {
  /** Value stored in the configurator state. */
  id: ClockFont;
  /** Option string of the Home Assistant "Clock font" select. */
  option: string;
  /** Label shown in the configurator. */
  label: string;
  /** Upstream family name. */
  family: string;
  /** ESPHome font id, absent for the built-in bitmap font. */
  firmwareId?: string;
  /** Compile size in pixels, absent for the built-in font. */
  size?: number;
  /** License of the redistributed source file. */
  license: string;
  /** One line explaining when to pick this face. */
  blurb: string;
}

/** Faces rendered for comparison only; they are never included in installer YAML. */
export interface PreviewCandidate {
  id: string;
  label: string;
  generatedId: string;
  license: string;
}

export const PREVIEW_CANDIDATES: readonly PreviewCandidate[] = [];

export const FONT_CATALOG: readonly FontSpec[] = [
  {
    id: "md-parola-numeric-7seg",
    option: "MD Parola Numeric 7-Segment",
    label: "MD Parola Numeric 7-Segment",
    family: "MD Parola",
    firmwareId: "font_md_parola_numeric_7seg_source",
    size: 8,
    license: "LGPL-2.1-or-later",
    blurb: "Double-line seven-segment MAX7219 clock digits.",
  },
  {
    id: "pixel-clock-6x8",
    option: "Pixel Clock 6x8",
    label: "Pixel Clock 6×8",
    family: "Pixel Clock 6x8",
    firmwareId: "font_pixel_clock_6x8_source",
    size: 8,
    license: "project source (scripts/generate_pixel_clock_6x8_font.py)",
    blurb: "Rounded six-column matrix-clock digits with two-column edges; fits 48 px HH:MM:SS.",
  },
  {
    id: "matrix-2px",
    option: "Matrix 2px",
    label: "Matrix 2px",
    family: "Matrix 2px",
    firmwareId: "font_matrix_2px_source",
    size: 8,
    license: "project source (scripts/generate_matrix_font.py)",
    blurb: "Pixel-exact eight-row digits whose number strokes are two pixels thick.",
  },
  {
    id: "dot-matrix",
    option: "Dot Matrix",
    label: "Dot Matrix",
    family: "Dot Matrix",
    firmwareId: "font_dot_matrix_source",
    size: 8,
    license: "project source (scripts/generate_dot_matrix_font.py)",
    blurb: "Single-LED dot digits: 6x8 cells, with HH:MM fitting a 32x8 panel.",
  },
  {
    id: "compact",
    option: "Compact 5x7",
    label: "Compact 5×7",
    family: "built-in bitmap",
    license: "project source (packages/max7219_clock_renderer.h)",
    blurb: "Always compiled, never downloaded, and the firmware's fallback font.",
  },
];

const BY_ID = new Map(FONT_CATALOG.map((spec) => [spec.id, spec]));
const BY_OPTION = new Map(FONT_CATALOG.map((spec) => [spec.option, spec]));

export function fontSpec(id: ClockFont): FontSpec {
  const spec = BY_ID.get(id) ?? FONT_CATALOG[0];
  return spec;
}

/** Maps a Home Assistant "Clock font" option back to a configurator id. */
export function fontForOption(option: string): ClockFont | null {
  return BY_OPTION.get(option)?.id ?? null;
}

export function previewFont(id: ClockFont): PreviewFont {
  const spec = fontSpec(id);
  if (!spec.firmwareId) return BUILTIN_FONT;
  return generatedFont(spec.firmwareId, spec.label) ?? BUILTIN_FONT;
}

/** Measures worst-case "88:88:88" with the real font. */
export function clockWidth(font: PreviewFont): number {
  return font.measure("88:88:88") ?? font.clockWidth;
}

export interface FontFit {
  /** Width of worst-case "88:88:88" in pixels. */
  width: number;
  /** Width of "HH:MM" in pixels. */
  minutesWidth: number;
  /** Tallest digit in pixels. */
  digitHeight: number;
  /** The panel is too narrow for full-size seconds at this font size. */
  dropsSeconds: boolean;
  /** Not even the built-in fallback can show "HH:MM" on this panel. */
  tooNarrow: boolean;
  /** The digits reach the bottom row, so the seconds bar would overlap. */
  usesBottomRow: boolean;
}

/** Mirrors the fallback chain in packages/max7219_clock_renderer.h. */
export function fitForPanel(font: PreviewFont, panelWidth: number, panelHeight: number): FontFit {
  const width = clockWidth(font);
  const fallbackMinutes = BUILTIN_FONT.measure("HH:MM") ?? 33;
  const minutesWidth = font.measure("HH:MM") ?? fallbackMinutes;
  return {
    width,
    minutesWidth,
    digitHeight: font.maxDigitHeight,
    dropsSeconds: width > panelWidth && minutesWidth <= panelWidth,
    tooNarrow: fallbackMinutes > panelWidth,
    usesBottomRow: font.maxDigitHeight >= panelHeight,
  };
}

/**
 * Plain-language warning for a face that does not fit the panel, mirroring the
 * firmware's fallback chain. Null when the face fits with seconds.
 */
export function widthWarning(label: string, fit: FontFit, panelWidth: number): string | null {
  if (fit.tooNarrow) {
    return `Only ${panelWidth} px wide: not even the built-in 5×7 fallback can show HH:MM. Add modules or choose a narrower face.`;
  }
  if (fit.dropsSeconds) {
    return `${label} needs ${fit.width} px for HH:MM:SS — ${fit.width - panelWidth} px wider than this ${panelWidth} px panel. The firmware drops the seconds digits and shows HH:MM with the seconds bar.`;
  }
  return null;
}
