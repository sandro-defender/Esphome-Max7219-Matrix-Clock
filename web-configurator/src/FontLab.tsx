import { GlyphStrip } from "./GlyphStrip";
import { FONT_CATALOG, PREVIEW_CANDIDATES, fitForPanel, fontSpec, previewFont, widthWarning } from "./fontCatalog";
import { generatedFont } from "./fonts";
import { DEFAULT_FONTS, EXTRA_FONTS, addExtraFontAndSelect, toggleExtraFont } from "./fontSelection";
import type { Config } from "./types";
import { cn } from "./utils/cn";
import { Section } from "./ui";

interface FontLabProps {
  cfg: Config;
  setCfg: (update: (current: Config) => Config) => void;
  panelWidth: number;
  panelHeight: number;
}

/**
 * The two-tier font workbench.
 *
 * Group one compiles: every checkbox maps to a package file in the generated
 * installer and checking it immediately selects the face in the live preview.
 * Group two is measurement only: those faces are never compiled and never
 * written into the installer YAML.
 */
export function FontLab({ cfg, setCfg, panelWidth, panelHeight }: FontLabProps) {
  const selected = fontSpec(cfg.clockFont);
  const selectedFont = previewFont(cfg.clockFont);
  const selectedFit = fitForPanel(selectedFont, panelWidth, panelHeight);
  const warning = widthWarning(selected.label, selectedFit, panelWidth);

  return (
    <Section
      id="font-lab"
      title="Font Lab"
      lead={
        <>
          Every bundled face is available here. Pick an installed face for the clock; compare the preview-only faces
          below without adding anything to firmware.
        </>
      }
    >
      <fieldset className="font-group font-group-firmware">
        <legend id="fonts-included-title">Fonts included in firmware</legend>
        <p className="hint">
          Dot Matrix, Matrix 2px and Pixel Clock 6×8 ship in every build. Compact 5×7 is always compiled as the fallback.
          <code>Clock font</code> select.
        </p>
        <ul className="font-checklist">
          {EXTRA_FONTS.map((id) => {
            const spec = fontSpec(id);
            const included = cfg.fonts.includes(id);
            return (
              <li key={id}>
                <label className="font-choice">
                  <input
                    type="checkbox"
                    checked={included}
                    onChange={(event) =>
                      setCfg((current) =>
                        event.target.checked ? addExtraFontAndSelect(current, id) : toggleExtraFont(current, id),
                      )
                    }
                  />
                  <span>
                    <strong>{spec.label}</strong>
                    <em>{included ? "included — shown in the live preview" : "adds a package and switches the preview to it"}</em>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="font-grid">
          {FONT_CATALOG.filter((item) => item.id === "compact" || cfg.fonts.includes(item.id)).map((item) => {
            const itemFont = previewFont(item.id);
            const itemFit = fitForPanel(itemFont, panelWidth, panelHeight);
            const active = cfg.clockFont === item.id;
            const itemWarning = widthWarning(item.label, itemFit, panelWidth);
            return (
              <button
                key={item.id}
                type="button"
                className={cn("font-card", active && "on")}
                aria-pressed={active}
                onClick={() => setCfg((current) => ({ ...current, clockFont: item.id }))}
              >
                <span className="font-name">
                  {item.label}
                  {item.id === "compact" ? <em>always compiled</em> : DEFAULT_FONTS.includes(item.id) ? <em>default</em> : null}
                  {active ? <em className="font-selected">selected</em> : null}
                </span>
                <GlyphStrip font={itemFont} text="0123456789" scale={2} />
                <span className="font-meta">
                  {item.firmwareId ? `size ${item.size}` : "built in"} · HH:MM:SS {itemFit.width}px · digits {itemFit.digitHeight}px tall
                </span>
                <span className="font-blurb">{item.blurb}</span>
                {itemWarning ? <span className="font-warn">⚠ {itemWarning}</span> : null}
                {itemFit.usesBottomRow ? <span className="font-warn">uses all eight rows</span> : null}
              </button>
            );
          })}
        </div>
        {warning ? (
          <p className="warn font-width-warn" role="status">
            <strong>Too wide for this panel:</strong> {warning}
          </p>
        ) : (
          <p className="hint">
            The compiled file for the selected face is <code>{selected.firmwareId ?? "built into the renderer"}</code>;
            its licence is {selected.license}.
          </p>
        )}
      </fieldset>

      <div className="font-group font-group-preview">
        <h3 id="preview-only-title">Preview-only Font Lab</h3>
        <p className="hint">
          Bundled candidates for a future release, rendered for side-by-side comparison. <strong>Preview only</strong>{" "}
          means exactly that: these faces are never compiled into the ESP8266 firmware and never appear in your installer
          YAML. Adding a face to real firmware needs a flash-size measurement first — see the roadmap.
        </p>
        <div className="font-grid">
          {PREVIEW_CANDIDATES.map((item) => {
            const itemFont = generatedFont(item.generatedId, item.label);
            if (!itemFont) return null;
            const itemFit = fitForPanel(itemFont, panelWidth, panelHeight);
            const itemWarning = widthWarning(item.label, itemFit, panelWidth);
            return (
              <div key={item.id} className="font-card font-card-static">
                <span className="font-name">
                  {item.label}
                  <em className="font-preview-tag">preview only</em>
                </span>
                <GlyphStrip font={itemFont} text="0123456789" scale={2} />
                <span className="font-meta">
                  HH:MM:SS {itemFit.width}px · digits {itemFit.digitHeight}px tall
                </span>
                <span className="font-blurb">{item.license}. Never compiled, never in the installer YAML.</span>
                {itemWarning ? <span className="font-warn">⚠ {itemWarning}</span> : null}
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
