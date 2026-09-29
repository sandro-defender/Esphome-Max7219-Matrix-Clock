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

export const FONT_CATALOG: readonly FontSpec[] = [
  {
    id: "jersey-15",
    option: "Jersey 15",
    label: "Jersey 15",
    family: "Jersey 15",
    firmwareId: "font_jersey_15_source",
    size: 15,
    license: "SIL Open Font License 1.1",
    blurb: "Large blocky eight-row digits using the full 48-pixel panel.",
  },
  {
    id: "teko",
    option: "Teko",
    label: "Teko",
    family: "Teko",
    firmwareId: "font_teko_source",
    size: 12,
    license: "SIL Open Font License 1.1",
    blurb: "Tall condensed eight-row digits with generous horizontal spacing.",
  },
  {
    id: "rajdhani-bold",
    option: "Rajdhani Bold",
    label: "Rajdhani Bold",
    family: "Rajdhani",
    firmwareId: "font_rajdhani_bold_source",
    size: 12,
    license: "SIL Open Font License 1.1",
    blurb: "Bold squared digits with two pixels of horizontal headroom.",
  },
  {
    id: "kdam-thmor-pro",
    option: "Kdam Thmor Pro",
    label: "Kdam Thmor Pro",
    family: "Kdam Thmor Pro",
    firmwareId: "font_kdam_thmor_pro_source",
    size: 9,
    license: "SIL Open Font License 1.1",
    blurb: "Heavy compact digits with clear counters at eight rows.",
  },
  {
    id: "rationale",
    option: "Rationale",
    label: "Rationale",
    family: "Rationale",
    firmwareId: "font_rationale_source",
    size: 12,
    license: "SIL Open Font License 1.1",
    blurb: "Tall condensed eight-row digits with maximum breathing room.",
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
    id: "handjet",
    option: "Handjet",
    label: "Handjet",
    family: "Handjet",
    firmwareId: "font_handjet_source",
    size: 12,
    license: "SIL Open Font License 1.1",
    blurb: "Tall technical digits with generous space on the panel.",
  },
  {
    id: "oxanium",
    option: "Oxanium",
    label: "Oxanium",
    family: "Oxanium",
    firmwareId: "font_oxanium_source",
    size: 11,
    license: "SIL Open Font License 1.1",
    blurb: "Angular sci-fi digits that leave six pixels of horizontal headroom.",
  },
  {
    id: "share-tech-mono",
    option: "Share Tech Mono",
    label: "Share Tech Mono",
    family: "Share Tech Mono",
    firmwareId: "font_share_tech_mono_source",
    size: 12,
    license: "SIL Open Font License 1.1",
    blurb: "Monospaced technical digits using the full 48-pixel clock width.",
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
