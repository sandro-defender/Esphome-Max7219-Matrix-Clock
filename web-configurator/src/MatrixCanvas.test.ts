import { describe, expect, it } from "vitest";

import { isLedVisuallyOn, ledGlowRadius } from "./MatrixCanvas";

describe("MatrixCanvas LED optics", () => {
  it("inverts individual LED dots instead of illuminating the whole module face", () => {
    expect(isLedVisuallyOn(0, true, false)).toBe(false);
    expect(isLedVisuallyOn(1, true, false)).toBe(true);
    expect(isLedVisuallyOn(0, true, true)).toBe(true);
    expect(isLedVisuallyOn(1, true, true)).toBe(false);
    expect(isLedVisuallyOn(1, false, true)).toBe(false);
  });

  it("keeps each LED glow inside its own pixel pitch", () => {
    expect(ledGlowRadius(11, 13)).toBeLessThanOrEqual(6.5);
    expect(ledGlowRadius(4, 5)).toBeLessThanOrEqual(2.5);
  });
});
