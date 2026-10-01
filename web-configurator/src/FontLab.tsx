import { GlyphStrip } from "./GlyphStrip";
import { FONT_CATALOG, fitForPanel, fontSpec, previewFont, widthWarning } from "./fontCatalog";
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
 * Bundled firmware font workbench. Every checkbox maps to a package file in
 * the generated installer and checking it immediately selects that face.
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
    >
      <fieldset className="font-group font-group-firmware">
        <legend id="fonts-included-title">Fonts included in firmware</legend>
        <ul className="font-checklist">
          {[...DEFAULT_FONTS, ...EXTRA_FONTS].map((id) => {
            const spec = fontSpec(id);
            const included = cfg.fonts.includes(id);
            return (
              <li key={id}>
                <label className="font-choice">
                  <input
                    type="checkbox"
                    checked={included}
                    disabled={DEFAULT_FONTS.includes(id)}
                    onChange={(event) =>
                      setCfg((current) =>
                        event.target.checked ? addExtraFontAndSelect(current, id) : toggleExtraFont(current, id),
                      )
                    }
                  />
                  <span>
                    <strong>{spec.label}</strong>
                    <em>{included ? "included" : "optional"}</em>
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
                {itemWarning ? <span className="font-warn">⚠ {itemWarning}</span> : null}
                {itemFit.usesBottomRow ? <span className="font-warn">uses all eight rows</span> : null}
              </button>
            );
          })}
        </div>
        {warning ? <p className="warn font-width-warn" role="status">{warning}</p> : null}
      </fieldset>

    </Section>
  );
}
