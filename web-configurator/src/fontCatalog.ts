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
    id: "tiny5",
    option: "Tiny5",
    label: "Tiny5",
    family: "Tiny5",
    firmwareId: "font_tiny5_source",
    size: 10,
    license: "SIL Open Font License 1.1",
    blurb: "The default. Narrow, tall digits with room for the seconds bar.",
  },
  {
    id: "press-start-2p",
    option: "Press Start 2P",
    label: "Press Start 2P",
    family: "Press Start 2P",
    firmwareId: "font_ps2p_source",
    size: 6,
    license: "SIL Open Font License 1.1",
    blurb: "Chunky arcade blocks. Uses the full 48 px, so the seconds bar is tight.",
  },
  {
    id: "silkscreen-bold",
    option: "Silkscreen Bold",
    label: "Silkscreen Bold",
    family: "Silkscreen",
    firmwareId: "font_silkscreen_bold_source",
    size: 7,
    license: "SIL Open Font License 1.1",
    blurb: "Thick two-pixel strokes made for tiny screens, with room for full HH:MM:SS.",
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

/** Measures "HH:MM:SS" with the real font, the way the renderer budgets it. */
export function clockWidth(font: PreviewFont): number {
  return font.measure("HH:MM:SS") ?? font.clockWidth;
}

export interface FontFit {
  /** Width of "HH:MM:SS" in pixels. */
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
