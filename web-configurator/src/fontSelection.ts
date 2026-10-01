import { CLOCK_FONTS, type ClockFont, type Config } from "./types";

export const DEFAULT_FONTS: readonly ClockFont[] = ["pixel-clock-6x8"];
export const MAX_EXTRA_FONTS = Infinity;
export const EXTRA_FONTS = CLOCK_FONTS.filter((id) => id !== "compact" && !DEFAULT_FONTS.includes(id));

/** Canonical order, unique known ids. Pixel Clock 6x8 cannot be removed. */
export function normalizeFonts(input: unknown): ClockFont[] {
  const values = Array.isArray(input) ? input : [];
  return [...DEFAULT_FONTS, ...EXTRA_FONTS.filter((id) => values.includes(id))];
}

export function withFonts(config: Config, input: unknown): Config {
  const fonts = normalizeFonts(input);
  const clockFont = config.clockFont === "compact" || fonts.includes(config.clockFont) ? config.clockFont : "pixel-clock-6x8";
  return { ...config, fonts, clockFont };
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
