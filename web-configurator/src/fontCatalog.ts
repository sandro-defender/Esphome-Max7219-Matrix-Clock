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
    id: "silkscreen-bold",
    option: "Silkscreen Bold",
    label: "Silkscreen Bold",
    family: "Silkscreen",
    firmwareId: "font_silkscreen_bold_source",
    size: 7,
    license: "SIL Open Font License 1.1",
    blurb: "Thick two-pixel strokes made for tiny screens.",
  },
  {
    id: "tiny5",
    option: "Tiny5",
    label: "Tiny5",
    family: "Tiny5",
    firmwareId: "font_tiny5_source",
    size: 10,
    license: "SIL Open Font License 1.1",
    blurb: "Narrow, tall digits with room for the seconds bar.",
  },
  {
    id: "press-start-2p",
    option: "Press Start 2P",
    label: "Press Start 2P",
    family: "Press Start 2P",
    firmwareId: "font_ps2p_source",
    size: 6,
    license: "SIL Open Font License 1.1",
    blurb: "Chunky arcade blocks using the full 48-pixel width.",
  },
  {
    id: "audiowide",
    option: "Audiowide",
    label: "Audiowide",
    family: "Audiowide",
    firmwareId: "font_audiowide_source",
    size: 8,
    license: "SIL Open Font License 1.1",
    blurb: "Wide rounded techno digits.",
  },
  {
    id: "bitcount-grid-double",
    option: "Bitcount Grid Double",
    label: "Bitcount Grid Double",
    family: "Bitcount Grid Double",
    firmwareId: "font_bitcount_grid_double_source",
    size: 10,
    license: "SIL Open Font License 1.1",
    blurb: "Double-line dot-grid display face.",
  },
  {
    id: "bitcount-grid-single",
    option: "Bitcount Grid Single",
    label: "Bitcount Grid Single",
    family: "Bitcount Grid Single",
    firmwareId: "font_bitcount_grid_single_source",
    size: 10,
    license: "SIL Open Font License 1.1",
    blurb: "Single-line dot-grid display face.",
  },
  {
    id: "bitcount-prop-double",
    option: "Bitcount Prop Double",
    label: "Bitcount Prop Double",
    family: "Bitcount Prop Double",
    firmwareId: "font_bitcount_prop_double_source",
    size: 10,
    license: "SIL Open Font License 1.1",
    blurb: "Proportional double-line digital face.",
  },
  {
    id: "bitcount-prop-single",
    option: "Bitcount Prop Single",
    label: "Bitcount Prop Single",
    family: "Bitcount Prop Single",
    firmwareId: "font_bitcount_prop_single_source",
    size: 9,
    license: "SIL Open Font License 1.1",
    blurb: "Compact proportional single-line digital face.",
  },
  {
    id: "bitcount-single",
    option: "Bitcount Single",
    label: "Bitcount Single",
    family: "Bitcount Single",
    firmwareId: "font_bitcount_single_source",
    size: 10,
    license: "SIL Open Font License 1.1",
    blurb: "Monospaced single-line digital face.",
  },
  {
    id: "bytesized",
    option: "Bytesized",
    label: "Bytesized",
    family: "Bytesized",
    firmwareId: "font_bytesized_source",
    size: 12,
    license: "SIL Open Font License 1.1",
    blurb: "Tall compact pixel digits.",
  },
  {
    id: "dotgothic16",
    option: "DotGothic16",
    label: "DotGothic16",
    family: "DotGothic16",
    firmwareId: "font_dotgothic16_source",
    size: 9,
    license: "SIL Open Font License 1.1",
    blurb: "Square bitmap-inspired Japanese display face.",
  },
  {
    id: "doto",
    option: "Doto",
    label: "Doto",
    family: "Doto",
    firmwareId: "font_doto_source",
    size: 10,
    license: "SIL Open Font License 1.1",
    blurb: "Rounded dotted display digits.",
  },
  {
    id: "electrolize",
    option: "Electrolize",
    label: "Electrolize",
    family: "Electrolize",
    firmwareId: "font_electrolize_source",
    size: 10,
    license: "SIL Open Font License 1.1",
    blurb: "Clean electronic instrument face.",
  },
  {
    id: "handjet",
    option: "Handjet",
    label: "Handjet",
    family: "Handjet",
    firmwareId: "font_handjet_source",
    size: 11,
    license: "SIL Open Font License 1.1",
    blurb: "Open modular display strokes.",
  },
  {
    id: "iceland",
    option: "Iceland",
    label: "Iceland",
    family: "Iceland",
    firmwareId: "font_iceland_source",
    size: 12,
    license: "SIL Open Font License 1.1",
    blurb: "Condensed angular digital face.",
  },
  {
    id: "jersey-10",
    option: "Jersey 10",
    label: "Jersey 10",
    family: "Jersey 10",
    firmwareId: "font_jersey_10_source",
    size: 12,
    license: "SIL Open Font License 1.1",
    blurb: "Compact retro sports pixels.",
  },
  {
    id: "jersey-15",
    option: "Jersey 15",
    label: "Jersey 15",
    family: "Jersey 15",
    firmwareId: "font_jersey_15_source",
    size: 12,
    license: "SIL Open Font License 1.1",
    blurb: "Medium retro sports pixels.",
  },
  {
    id: "jersey-20",
    option: "Jersey 20",
    label: "Jersey 20",
    family: "Jersey 20",
    firmwareId: "font_jersey_20_source",
    size: 11,
    license: "SIL Open Font License 1.1",
    blurb: "Rounded retro display pixels.",
  },
  {
    id: "jersey-25",
    option: "Jersey 25",
    label: "Jersey 25",
    family: "Jersey 25",
    firmwareId: "font_jersey_25_source",
    size: 11,
    license: "SIL Open Font License 1.1",
    blurb: "Heavy retro display pixels.",
  },
  {
    id: "major-mono-display",
    option: "Major Mono Display",
    label: "Major Mono Display",
    family: "Major Mono Display",
    firmwareId: "font_major_mono_display_source",
    size: 8,
    license: "SIL Open Font License 1.1",
    blurb: "Geometric monospaced display face.",
  },
  {
    id: "micro-5",
    option: "Micro 5",
    label: "Micro 5",
    family: "Micro 5",
    firmwareId: "font_micro_5_source",
    size: 12,
    license: "SIL Open Font License 1.1",
    blurb: "Very narrow five-column pixel face.",
  },
  {
    id: "nova-mono",
    option: "Nova Mono",
    label: "Nova Mono",
    family: "Nova Mono",
    firmwareId: "font_nova_mono_source",
    size: 9,
    license: "SIL Open Font License 1.1",
    blurb: "Readable rounded monospace digits.",
  },
  {
    id: "orbitron",
    option: "Orbitron",
    label: "Orbitron",
    family: "Orbitron",
    firmwareId: "font_orbitron_source",
    size: 8,
    license: "SIL Open Font License 1.1",
    blurb: "Futuristic geometric display face.",
  },
  {
    id: "oxanium",
    option: "Oxanium",
    label: "Oxanium",
    family: "Oxanium",
    firmwareId: "font_oxanium_source",
    size: 9,
    license: "SIL Open Font License 1.1",
    blurb: "Squared technical display face.",
  },
  {
    id: "pixelify-sans",
    option: "Pixelify Sans",
    label: "Pixelify Sans",
    family: "Pixelify Sans",
    firmwareId: "font_pixelify_sans_source",
    size: 11,
    license: "SIL Open Font License 1.1",
    blurb: "Friendly variable pixel face.",
  },
  {
    id: "quantico-bold",
    option: "Quantico Bold",
    label: "Quantico Bold",
    family: "Quantico",
    firmwareId: "font_quantico_bold_source",
    size: 9,
    license: "SIL Open Font License 1.1",
    blurb: "Bold military-style squared digits.",
  },
  {
    id: "rubik-pixels",
    option: "Rubik Pixels",
    label: "Rubik Pixels",
    family: "Rubik Pixels",
    firmwareId: "font_rubik_pixels_source",
    size: 9,
    license: "SIL Open Font License 1.1",
    blurb: "Dense block-pixel display face.",
  },
  {
    id: "share-tech-mono",
    option: "Share Tech Mono",
    label: "Share Tech Mono",
    family: "Share Tech Mono",
    firmwareId: "font_share_tech_mono_source",
    size: 10,
    license: "SIL Open Font License 1.1",
    blurb: "Clear technical monospace face.",
  },
  {
    id: "sixtyfour",
    option: "Sixtyfour",
    label: "Sixtyfour",
    family: "Sixtyfour",
    firmwareId: "font_sixtyfour_source",
    size: 6,
    license: "SIL Open Font License 1.1",
    blurb: "Detailed 8-bit sci-fi display face.",
  },
  {
    id: "vt323",
    option: "VT323",
    label: "VT323",
    family: "VT323",
    firmwareId: "font_vt323_source",
    size: 12,
    license: "SIL Open Font License 1.1",
    blurb: "Classic terminal bitmap face.",
  },
  {
    id: "wallpoet",
    option: "Wallpoet",
    label: "Wallpoet",
    family: "Wallpoet",
    firmwareId: "font_wallpoet_source",
    size: 8,
    license: "SIL Open Font License 1.1",
    blurb: "Stencil-like futuristic display face.",
  },
  {
    id: "noto-sans-georgian",
    option: "Noto Sans Georgian",
    label: "Noto Sans Georgian",
    family: "Noto Sans Georgian",
    firmwareId: "font_noto_sans_georgian_source",
    size: 8,
    license: "SIL Open Font License 1.1",
    blurb: "Georgian sans-serif with Mkhedruli and Mtavruli glyphs.",
  },
  {
    id: "noto-serif-georgian",
    option: "Noto Serif Georgian",
    label: "Noto Serif Georgian",
    family: "Noto Serif Georgian",
    firmwareId: "font_noto_serif_georgian_source",
    size: 8,
    license: "SIL Open Font License 1.1",
    blurb: "Georgian serif with Mkhedruli and Mtavruli glyphs.",
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
