import { FIRMWARE } from "./firmware";
import { CLOCK_FONTS, type ClockFont, type Config } from "./types";

export const DEFAULT_FONTS: readonly ClockFont[] = FIRMWARE.defaultFonts;
export const EXTRA_FONTS = CLOCK_FONTS.filter((id) => id !== "compact" && !DEFAULT_FONTS.includes(id));

/** Canonical order, unique known ids. The default pair cannot be removed. */
export function normalizeFonts(input: unknown): ClockFont[] {
  const values = Array.isArray(input) ? input : [];
  return [...DEFAULT_FONTS, ...EXTRA_FONTS.filter((id) => values.includes(id))];
}

export function withFonts(config: Config, input: unknown): Config {
  const fonts = normalizeFonts(input);
  const clockFont = config.clockFont === "compact" || fonts.includes(config.clockFont) ? config.clockFont : String(FIRMWARE.defaults.clockFont);
  const dateFont = config.dateFont === "compact" || fonts.includes(config.dateFont) ? config.dateFont : "compact";
  return { ...config, fonts, clockFont, dateFont };
}

export function toggleExtraFont(config: Config, font: ClockFont): Config {
  if (!EXTRA_FONTS.includes(font)) return config;
  const fonts = normalizeFonts(config.fonts);
  if (fonts.includes(font)) return withFonts(config, fonts.filter((id) => id !== font));
  return withFonts(config, [...fonts, font]);
}

/** Adds an optional face and immediately uses it in the live preview. */
export function addExtraFontAndSelect(config: Config, font: ClockFont): Config {
  const next = toggleExtraFont(config, font);
  return next !== config && !config.fonts.includes(font) && next.fonts.includes(font)
    ? { ...next, clockFont: font }
    : next;
}
