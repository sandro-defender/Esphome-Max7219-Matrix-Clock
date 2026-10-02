import type { Config, LedName } from "./types";
import { FIRMWARE, limitsFor, type FirmwareSetting } from "./firmware";
import { fontSpec } from "./fontCatalog";
import { HARDWARE_TARGETS, pinNamesFor, settingOptions, targetSpec, targetSummary } from "./hardware";
import { LEDS } from "./leds";
import type { Geometry } from "./render";
import { enabledSetting, SETTINGS_GROUPS, textLimit } from "./settingsModel";
import { Field, NumberField, type Patch, Section, Slider, Toggle } from "./ui";

/** Every generated binding gets one widget; no second hand-maintained list. */
function FirmwareField({ item, cfg, patch }: { item: FirmwareSetting; cfg: Config; patch: Patch }) {
  const value = cfg[item.key];
  const id = `setting-${item.key}`;
  const disabled = !enabledSetting(item, cfg);
  if (item.input === "boolean") return <Toggle label={item.label} checked={Boolean(value)} disabled={disabled}
    onChange={(next) => patch(item.key, next)} />;
  const options = item.input === "pin" ? pinNamesFor(cfg.target, cfg.board) :
    item.key === "clockFont" ? FIRMWARE.fonts.filter((font) => font.id === "compact" || cfg.fonts.includes(font.id)).map((font) => font.id) : settingOptions(item, cfg.target);
  if (options) return <Field id={id} label={item.label}>
    <select id={id} value={String(value)} disabled={disabled} onChange={(event) => {
      const next = typeof item.default === "number" ? Number(event.target.value) : event.target.value;
      patch(item.key, next);
      if (item.key === "rotateChip") patch("reverseEnable", next === 180);
    }}>
      {!options.map(String).includes(String(value)) ? <option value={String(value)}>Select a valid {item.input === "pin" ? "pin" : "option"}</option> : null}
      {options.map((option) => <option key={String(option)} value={String(option)}>{item.key === "clockFont" ? fontSpec(String(option)).label : String(option)}</option>)}
    </select>
  </Field>;
  if (typeof item.default === "number") {
    const range = limitsFor(item.key);
    return item.input === "range" ? <Slider label={item.label} value={Number(value)} {...range} unit={item.unit} disabled={disabled} onChange={(next) => patch(item.key, next)} /> :
      <NumberField label={item.label + (item.unit ? ` (${item.unit})` : "")} value={Number(value)} {...range} disabled={disabled} onChange={(next) => patch(item.key, next)} />;
  }
  return <Field id={id} label={item.label}>
    <input id={id} type="text" value={String(value)} maxLength={textLimit(item.key)} disabled={disabled}
      readOnly={item.key === "timezone" && cfg.automaticTimezone}
      aria-describedby={item.key === "timezone" ? "timezone-hint" : undefined}
      autoCapitalize="none" spellCheck={false} onChange={(event) => patch(item.key, event.target.value)} />
  </Field>;
}

/** Native radios give hardware selection normal Tab/arrow-key behavior. */
function HardwareTargetPicker({ cfg, onTarget }: { cfg: Config; onTarget: (id: string) => void }) {
  const current = targetSpec(cfg.target);
  return <fieldset className="control-group target-picker">
    <legend>Hardware target</legend>
    <div className="target-options" role="radiogroup" aria-label="Hardware target">
      {HARDWARE_TARGETS.map((target) => <label key={target.id} className={cfg.target === target.id ? "target-option on" : "target-option"}>
        <input type="radio" name="hardware-target" value={target.id} checked={cfg.target === target.id} onChange={() => onTarget(target.id)} />
        <span><strong>{target.label}</strong><em>{targetSummary(target.id)}</em></span>
      </label>)}
    </div>
    <details className="compact-help"><summary>Board and pin rules</summary>
      <p>Installer uses <code>{current.basePackage}</code>. Switching target resets its board, pins, OTA port and device comment; display choices stay intact. Board and pin choices follow the selected target.</p>
    </details>
  </fieldset>;
}

export function TuneSection({ cfg, patch, geo, detected = null, onTarget }: {
  cfg: Config; patch: Patch; geo: Geometry; detected?: string | null; onTarget?: (id: string) => void;
}) {
  return <Section id="tune" title="Settings" className="compact-settings">
    <p className="settings-intro">Changes update the preview and installer together. Firmware preferences are first-boot defaults; values already saved on the clock take priority.</p>
    <HardwareTargetPicker cfg={cfg} onTarget={onTarget ?? ((id) => patch("target", id))} />
    <div className="tune-grid">{SETTINGS_GROUPS.map((group) => <fieldset className="control-group settings-card" key={group.id} data-settings-group={group.id}>
      <legend>{group.id}</legend>
      {group.settings.map((item) => <div key={item.key} data-setting-key={item.key}>
        {item.key === "timezone" ? <div data-configurator-key="automaticTimezone">
          <Toggle label="Automatic timezone" checked={cfg.automaticTimezone} onChange={(value) => patch("automaticTimezone", value)} />
        </div> : null}
        <FirmwareField item={item} cfg={cfg} patch={patch} />
        {item.key === "timezone" ? <p id="timezone-hint" className="field-note" role="status">
          {cfg.automaticTimezone ? "Follows this browser on load and tab return. Turn off to enter a manual zone." : "Manual override is saved and shared; browser changes will not replace it."}
          {detected ? <> Browser: <code>{detected}</code>.</> : " Detection unavailable; keeping the current zone. Turn off automatic mode to edit it."}
        </p> : null}
      </div>)}
      <details className="compact-help"><summary>About {group.id.toLowerCase()}</summary><p>{group.description}</p></details>
    </fieldset>)}</div>
    <fieldset className="control-group settings-card preview-settings"><legend>Preview only</legend>
      <Field id="preview-led" label="LED colour"><select id="preview-led" value={cfg.led} onChange={(event) => patch("led", event.target.value as LedName)}>
        {Object.entries(LEDS).map(([key, led]) => <option key={key} value={key}>{led.label}</option>)}
      </select></Field>
      <Toggle label="Module boundaries" checked={cfg.showModuleBoundaries} onChange={(value) => patch("showModuleBoundaries", value)} />
      <p className="field-note">Colour, guides, frozen time and the message demo above are browser-only. They are never written to the installer.</p>
    </fieldset>
    {!geo.valid ? <p className="warn" role="alert">Module count must divide evenly into rows.</p> : null}
  </Section>;
}
