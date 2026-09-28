import type { LedName } from "./types";

export interface LedPreset {
  name: LedName;
  core: string;
  mid: string;
  glow: string;
  label?: string;
}

export const LEDS: Record<LedName, LedPreset> = {
  Blood: { name: "Blood", core: "#fff0f2", mid: "#ff0838", glow: "#ba0018", label: "Blood Red (Deep Crimson)" },
  Amber: { name: "Amber", core: "#fff4d2", mid: "#ffb000", glow: "#ff7a00", label: "Amber Glow" },
  Red: { name: "Red", core: "#ffe1da", mid: "#ff3b30", glow: "#c41414", label: "Standard Red" },
  Green: { name: "Green", core: "#f0ffe4", mid: "#3ee066", glow: "#14913a", label: "Matrix Green" },
  Ice: { name: "Ice", core: "#f2fbff", mid: "#8ad8ff", glow: "#3a78ff", label: "Ice Blue" },
  White: { name: "White", core: "#ffffff", mid: "#f3efe6", glow: "#d9cbb8", label: "Warm White" },
};
