import { FIRMWARE } from "./firmware";
import { sanitizeHiddenEntities } from "./settingsModel";
import type { Config } from "./types";
import { type Patch, Section } from "./ui";

const GROUPS = [...FIRMWARE.groups.map((group) => group.id), "Buttons", "Diagnostics"]
  .map((name) => ({ name, entities: FIRMWARE.entities.filter((entity) => entity.group === name) }))
  .filter((group) => group.entities.length > 0);

export function EntityVisibilitySection({ cfg, patch }: { cfg: Config; patch: Patch }) {
  const hidden = new Set(cfg.hiddenEntities);
  const setHidden = (ids: string[]) => patch("hiddenEntities", sanitizeHiddenEntities(ids));
  const hideOptionalControls = () => setHidden([...cfg.hiddenEntities, ...FIRMWARE.entities
    .filter((entity) => !entity.recommended && ["select", "number", "switch", "button"].includes(entity.domain))
    .map((entity) => entity.id)]);
  return <Section id="entity-visibility" title="Home Assistant visibility" className="compact-settings">
    <p className="settings-intro">Choose which entities this firmware exposes. This is <strong>YAML/firmware configuration</strong>, not a live Home Assistant UI preference. <strong>Rebuild and install</strong> to apply changes.</p>
    <div className="visibility-toolbar">
      <span role="status">{FIRMWARE.entities.length - hidden.size} of {FIRMWARE.entities.length} entities exposed</span>
      <div className="btn-row">
        <button type="button" className="btn ghost" onClick={() => setHidden([])}>Expose all entities</button>
        <button type="button" className="btn ghost" onClick={hideOptionalControls}>Hide optional controls</button>
      </div>
    </div>
    <details className="compact-help visibility-help"><summary>What hiding an entity changes</summary>
      <p>The installer sets ESPHome <code>internal: true</code> through per-entity substitutions. The object, its settings and ID still exist, so rendering, restore-defaults scripts and API actions keep working. It is not advertised to Home Assistant and is also hidden from the authenticated device web server.</p>
      <p>Diagnostics and recovery controls are exposed by default. “Hide optional controls” leaves recommended controls and your diagnostic choices unchanged. Hiding controls prevents adjusting them from Home Assistant; hidden restored preferences still take priority over first-boot values.</p>
      <p>OTA percent is exposed but disabled by default in Home Assistant; that is different from being internal. After installing, old entity-registry entries may remain unavailable until cleaned up in Home Assistant. The imported temperature sensor always stays internal. API actions stay available and are listed under Info &amp; help.</p>
    </details>
    <div className="visibility-grid">{GROUPS.map(({ name, entities }) => <details className="visibility-card" key={name}>
      <summary><span>{name}</span><span className="visibility-count">{entities.filter((entity) => !hidden.has(entity.id)).length}/{entities.length} exposed</span></summary>
      <div className="visibility-fields">{entities.map((entity) => <label className="entity-row" key={entity.id} data-entity-id={entity.id}>
        <span className="entity-label">{entity.name}
          {entity.recommended ? <small>Recommended for recovery / diagnostics</small> : entity.disabled_by_default ? <small>Disabled by default in Home Assistant</small> : null}
        </span>
        <span className="checkbox-control"><input type="checkbox" aria-label={`Expose ${entity.name} to Home Assistant`} checked={!hidden.has(entity.id)}
          onChange={(event) => setHidden(event.target.checked ? cfg.hiddenEntities.filter((id) => id !== entity.id) : [...cfg.hiddenEntities, entity.id])} />
          <span aria-hidden="true">{hidden.has(entity.id) ? "Hidden" : "Exposed"}</span>
        </span>
      </label>)}</div>
    </details>)}</div>
  </Section>;
}
