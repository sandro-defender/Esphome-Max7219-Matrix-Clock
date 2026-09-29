import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import App from "./App";
import { FONT_CATALOG } from "./fontCatalog";

/**
 * Smoke test: the whole app must render without a DOM, which catches broken
 * imports, undefined config keys and crashes in component bodies.
 */
describe("App", () => {
  const markup = renderToStaticMarkup(<App />);

  it("renders the configurator shell", () => {
    expect(markup).toContain("Clock<span>lab</span>");
    expect(markup).toContain("MAX7219");
    expect(markup).toContain("Copy install YAML");
  });

  it("offers every catalogued font in the picker", () => {
    for (const spec of FONT_CATALOG) {
      expect(markup, spec.label).toContain(spec.label);

    }
  });

  it("lists every configurator section", () => {
    for (const tab of ["Tune", "Install YAML", "Assistant", "Wiring", "GitHub"]) {
      expect(markup, tab).toContain(tab);
    }
  });

  it("groups Tune in native disclosures with required settings expanded", () => {
    for (const name of ["Clock face", "Screen", "Messages", "Light", "Hardware", "Device"]) {
      expect(markup).toContain(`<summary>${name}</summary>`);
    }
    for (const name of ["Clock face", "Hardware", "Device"]) {
      expect(markup).toMatch(new RegExp(`<details[^>]* open=""><summary>${name}</summary>`));
    }
    expect(markup).toMatch(/<details[^>]*><summary>Messages<\/summary>/);
  });

  it("explains the preview layout choice", () => {
    expect(markup).toContain("Preview layout");
    expect(markup).toContain("the same fallback rules");
  });

  it("offers the optional module boundary guides", () => {
    expect(markup).toContain("Module boundary guides");
    expect(markup).toContain("Dashed guides on the seam between two 8×8 boards");
  });
});
