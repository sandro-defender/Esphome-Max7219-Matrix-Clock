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

export const PREVIEW_CANDIDATES: readonly PreviewCandidate[] = [
  { id: "bitcount-single", label: "Bitcount Single", generatedId: "font_bitcount_single_preview", license: "SIL Open Font License 1.1" },
  { id: "bytesized", label: "Bytesized", generatedId: "font_bytesized_preview", license: "SIL Open Font License 1.1" },
  { id: "dotgothic16", label: "DotGothic16", generatedId: "font_dotgothic16_preview", license: "SIL Open Font License 1.1" },
  { id: "doto", label: "Doto", generatedId: "font_doto_preview", license: "SIL Open Font License 1.1" },
  { id: "electrolize", label: "Electrolize", generatedId: "font_electrolize_preview", license: "SIL Open Font License 1.1" },
  { id: "iceland", label: "Iceland", generatedId: "font_iceland_preview", license: "SIL Open Font License 1.1" },
  { id: "jersey-10", label: "Jersey 10", generatedId: "font_jersey_10_preview", license: "SIL Open Font License 1.1" },
  { id: "jersey-20", label: "Jersey 20", generatedId: "font_jersey_20_preview", license: "SIL Open Font License 1.1" },
  { id: "jersey-25", label: "Jersey 25", generatedId: "font_jersey_25_preview", license: "SIL Open Font License 1.1" },
  { id: "major-mono-display", label: "Major Mono Display", generatedId: "font_major_mono_display_preview", license: "SIL Open Font License 1.1" },
  { id: "micro-5", label: "Micro 5", generatedId: "font_micro_5_preview", license: "SIL Open Font License 1.1" },
  { id: "noto-sans-georgian", label: "Noto Sans Georgian", generatedId: "font_noto_sans_georgian_preview", license: "SIL Open Font License 1.1" },
  { id: "noto-serif-georgian", label: "Noto Serif Georgian", generatedId: "font_noto_serif_georgian_preview", license: "SIL Open Font License 1.1" },
  { id: "nova-mono", label: "Nova Mono", generatedId: "font_nova_mono_preview", license: "SIL Open Font License 1.1" },
  { id: "orbitron", label: "Orbitron", generatedId: "font_orbitron_preview", license: "SIL Open Font License 1.1" },
  { id: "pixelify-sans", label: "Pixelify Sans", generatedId: "font_pixelify_sans_preview", license: "SIL Open Font License 1.1" },
  { id: "press-start-2p", label: "Press Start 2P", generatedId: "font_press_start_2p_preview", license: "SIL Open Font License 1.1" },
  { id: "quantico", label: "Quantico", generatedId: "font_quantico_preview", license: "SIL Open Font License 1.1" },
  { id: "rubik-pixels", label: "Rubik Pixels", generatedId: "font_rubik_pixels_preview", license: "SIL Open Font License 1.1" },
  { id: "silkscreen", label: "Silkscreen", generatedId: "font_silkscreen_preview", license: "SIL Open Font License 1.1" },
  { id: "sixtyfour", label: "Sixtyfour", generatedId: "font_sixtyfour_preview", license: "SIL Open Font License 1.1" },
  { id: "tiny5", label: "Tiny5", generatedId: "font_tiny5_preview", license: "SIL Open Font License 1.1" },
  { id: "vt323", label: "VT323", generatedId: "font_vt323_preview", license: "SIL Open Font License 1.1" },
  { id: "wallpoet", label: "Wallpoet", generatedId: "font_wallpoet_preview", license: "SIL Open Font License 1.1" },
  { id: "audiowide", label: "Audiowide", generatedId: "font_audiowide_preview", license: "SIL Open Font License 1.1" },
  { id: "bitcount-grid-double", label: "Bitcount Grid Double", generatedId: "font_bitcount_grid_double_preview", license: "SIL Open Font License 1.1" },
  { id: "bitcount-grid-single", label: "Bitcount Grid Single", generatedId: "font_bitcount_grid_single_preview", license: "SIL Open Font License 1.1" },
  { id: "bitcount-prop-double", label: "Bitcount Prop Double", generatedId: "font_bitcount_prop_double_preview", license: "SIL Open Font License 1.1" },
  { id: "bitcount-prop-single", label: "Bitcount Prop Single", generatedId: "font_bitcount_prop_single_preview", license: "SIL Open Font License 1.1" },
];

export const FONT_CATALOG: readonly FontSpec[] = [
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
    id: "md-parola-numeric-7seg",
    option: "MD Parola Numeric 7-Segment",
    label: "MD Parola Numeric 7-Segment",
    family: "MD Parola",
    firmwareId: "font_md_parola_numeric_7seg_source",
    size: 8,
    license: "LGPL-2.1-or-later",
    blurb: "The bold numeric7Seg clock face from the MD Parola example: seven-row numerals, 32 px for 88:88:88.",
  },
  {
    id: "md-max72xx-system",
    option: "MD MAX72XX System",
    label: "MD MAX72XX System",
    family: "MD MAX72XX System",
    firmwareId: "font_md_max72xx_system_source",
    size: 8,
    license: "LGPL-2.1-or-later",
    blurb: "The MD_MAX72XX `_sysfont` numerals, faithful to the Arduino library: seven-row digits, 34 px for 88:88:88.",
  },
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
