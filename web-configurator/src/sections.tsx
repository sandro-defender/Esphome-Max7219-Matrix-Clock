import {
  LIMITS,
  SCREENS,
  type Alignment,
  type Config,
  type DateFormat,
  type HourFormat,
  type MessageScroll,
  type SecondsMode,
  type Wiring,
} from "./types";
import { LEDS } from "./leds";
import { deviceSlug } from "./device";
import { fitForPanel, fontSpec, previewFont } from "./fontCatalog";
import { geometry, type Geometry } from "./render";
import { cn } from "./utils/cn";
import { CopyButton, NumberField, Patch, PinField, Section, Segmented, Slider, Toggle } from "./ui";
import { MAX_EXTRA_FONTS } from "./fontSelection";
import { INSTALLER_READY, entityMap, installCommand, sampleAction } from "./yaml";

const ZONES = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const PRESETS: { label: string; chips: number; rows: number }[] = [
  { label: "6×1 · 48×8", chips: 6, rows: 1 },
  { label: "4×1 · 32×8", chips: 4, rows: 1 },
  { label: "8×1 · 64×8", chips: 8, rows: 1 },
  { label: "12×1 · 96×8", chips: 12, rows: 1 },
  { label: "8×2 · 64×16", chips: 8, rows: 2 },
  { label: "12×2 · 96×16", chips: 12, rows: 2 },
];

export const PROJECT = {
  repo: "https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock",
  readme: "https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/blob/main/README.md",
  validation: "https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/blob/main/VALIDATION.md",
  roadmap: "https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/blob/main/ROADMAP.md",
  issues: "https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/issues",
  live: "https://sandro-defender.github.io/Esphome-Max7219-Matrix-Clock/",
  ref: "0.4.0",
  esphome: "2026.9.0",
};

/* ------------------------------------------------------------------ *
 * Tune — the live controls
 * ------------------------------------------------------------------ */

export function TuneSection({ cfg, patch, setCfg, geo }: { cfg: Config; patch: Patch; setCfg: (update: (current: Config) => Config) => void; geo: Geometry }) {
  const spec = fontSpec(cfg.clockFont);
  const font = previewFont(cfg.clockFont);
  const fit = fitForPanel(font, geo.width, Math.min(8, geo.height));
  const pinClash = new Set([cfg.clkPin, cfg.mosiPin, cfg.csPin]).size < 3;
  const bootPin = [cfg.clkPin, cfg.mosiPin, cfg.csPin].some((pin) => pin === "D3" || pin === "D4" || pin === "D8");

  return (
    <Section
      id="tune"
      title="Tune"
      lead={
        <>
          Every control here changes the live preview above and the generated installer below. Groups use native
          collapsible panels — Clock face, Hardware and Device start open.
        </>
      }
    >
      <details className="panel tune-section" open>
        <summary>Clock face</summary>
        <Segmented
          label="Preview layout"
          value={cfg.layoutPreview}
          options={["firmware", "modules"] as const}
          onChange={(value) => patch("layoutPreview", value)}
          hint={
            cfg.layoutPreview === "firmware"
              ? "What the firmware draws: the selected font, centred, with the same fallback rules."
              : "Illustration only: one digit per 8×8 module. The installed firmware draws the clock proportionally."
          }
        />
        <Toggle
          label="Module boundary guides · preview overlay"
          hint={
            geo.modulesX * geo.modulesY > 1
              ? "Dashed guides on the seam between two 8×8 boards. They are an overlay, so no pixel moves."
              : "Shown as soon as the panel has more than one 8×8 module."
          }
          checked={cfg.showModuleBoundaries}
          onChange={(value) => patch("showModuleBoundaries", value)}
        />
        <p className="hint">
          The installed faces live in <a href="#font-lab">Font Lab</a>: {cfg.fonts.length} external{" "}
          {cfg.fonts.length === 1 ? "face" : "faces"} compiled plus the built-in Compact 5×7 fallback, out of{" "}
          {MAX_EXTRA_FONTS} optional candidates. Checking a face there switches this preview immediately.
        </p>
        <ul className="entity-list font-facts">
          <li>
            Selected face <code>{spec.label}</code>
          </li>
          <li>
            Compiled file <code>{spec.firmwareId ?? "builtin"}</code>
          </li>
          <li>
            HH:MM:SS <code>{fit.width} px of {geo.width} px</code>
          </li>
          <li>
            Tallest digit <code>{fit.digitHeight} px</code>
          </li>
          <li>
            License <code>{spec.license}</code>
          </li>
        </ul>
      </details>

      <details className="panel tune-section">
        <summary>Screen</summary>
        <label className="field">
          <span className="field-label">Screen select</span>
          <select value={cfg.screen} onChange={(event) => patch("screen", event.target.value as Config["screen"])}>
            {SCREENS.map((screen) => (
              <option key={screen}>{screen}</option>
            ))}
          </select>
          <span className="hint">The five options the firmware exposes in Home Assistant.</span>
        </label>
        <Toggle
          label="Automatic screen cycling"
          hint="Switches between the clock and the date on its own. The screen select above is used on the first pass."
          checked={cfg.autoCycle}
          onChange={(value) => patch("autoCycle", value)}
        />
        <Slider
          label="Cycle interval"
          value={cfg.cycleInterval}
          min={LIMITS.cycleInterval.min}
          max={LIMITS.cycleInterval.max}
          step={5}
          unit="s"
          onChange={(value) => patch("cycleInterval", value)}
        />
        <Segmented
          label="Alignment"
          value={cfg.alignment}
          options={["Left", "Center", "Right"] as const}
          onChange={(value) => patch("alignment", value as Alignment)}
        />
        <Segmented
          label="Hour format"
          value={cfg.hourFormat}
          options={["24-hour", "12-hour"] as const}
          onChange={(value) => patch("hourFormat", value as HourFormat)}
          hint="12-hour mode blanks the leading digit below 10, exactly like the firmware."
        />
        <Segmented
          label="Date format"
          value={cfg.dateFormat}
          options={["DD.MM", "MM/DD", "DD/MM"] as const}
          onChange={(value) => patch("dateFormat", value as DateFormat)}
        />
        <Segmented
          label="Seconds display"
          value={cfg.secondsMode}
          options={["Off", "Digits", "Bar"] as const}
          onChange={(value) => patch("secondsMode", value as SecondsMode)}
          hint="Bar draws a full-width progress line on the bottom row instead of the seconds digits."
        />
        <Toggle
          label="Blink colon"
          hint="The separator disappears on odd seconds."
          checked={cfg.blinkColon}
          onChange={(value) => patch("blinkColon", value)}
        />
        <Toggle
          label="Digit slide-up animation"
          hint="Only the digits that changed slide, and never while the firmware shows OTA progress."
          checked={cfg.digitAnimation}
          onChange={(value) => patch("digitAnimation", value)}
        />
        <Slider
          label="Animation duration"
          value={cfg.animationMs}
          min={LIMITS.animationMs.min}
          max={LIMITS.animationMs.max}
          step={10}
          unit="ms"
          onChange={(value) => patch("animationMs", value)}
        />
      </details>

      <details className="panel tune-section">
        <summary>Messages</summary>
        <Slider
          label="Default hold"
          value={cfg.messageHold}
          min={LIMITS.messageHold.min}
          max={LIMITS.messageHold.max}
          step={5}
          unit="s"
          onChange={(value) => patch("messageHold", value)}
        />
        <span className="hint">
          {cfg.messageHold === 0
            ? "A message stays on the matrix until it is cleared or replaced."
            : `A message takes the whole display for ${cfg.messageHold} s, then the clock returns.`}
        </span>
        <Segmented
          label="Long messages"
          value={cfg.scrollMode}
          options={["Scroll", "Static"] as const}
          onChange={(value) => patch("scrollMode", value as MessageScroll)}
          hint="Scroll loops the text, Static shows the part that fits."
        />
        <Slider
          label="Scroll speed"
          value={cfg.scrollSpeed}
          min={LIMITS.scrollSpeed.min}
          max={LIMITS.scrollSpeed.max}
          step={5}
          unit="ms/px"
          onChange={(value) => patch("scrollSpeed", value)}
        />
        <p className="hint">The preview keeps the message on the matrix for as long as the firmware would, then falls back to the selected screen.</p>
      </details>

      <details className="panel tune-section">
        <summary>Light</summary>
        <Slider label="Brightness" value={cfg.brightness} min={LIMITS.brightness.min} max={LIMITS.brightness.max} step={1} onChange={(value) => patch("brightness", value)} />
        <Toggle
          label="Night dimming"
          hint="Uses the clock hour on the device, not the browser."
          checked={cfg.nightDim}
          onChange={(value) => patch("nightDim", value)}
        />
        <Slider
          label="Night brightness"
          value={cfg.nightBrightness}
          min={LIMITS.brightness.min}
          max={LIMITS.brightness.max}
          step={1}
          onChange={(value) => patch("nightBrightness", value)}
        />
        <div className="two">
          <NumberField label="Night starts" value={cfg.nightStart} min={0} max={23} onChange={(value) => patch("nightStart", value)} />
          <NumberField label="Night ends" value={cfg.nightEnd} min={0} max={23} onChange={(value) => patch("nightEnd", value)} />
        </div>
        <p className="hint">
          Night runs from {cfg.nightStart}:00 until {cfg.nightEnd}:00. The preview dims while the local hour is inside that window.
        </p>
        <Toggle label="Display power" checked={cfg.displayPower} onChange={(value) => patch("displayPower", value)} />
        <Toggle
          label="Invert"
          hint="Lit background, dark glyphs. Useful if a module is mounted backwards."
          checked={cfg.invert}
          onChange={(value) => patch("invert", value)}
        />
        <Segmented
          label="LED colour · preview only"
          value={cfg.led}
          options={Object.keys(LEDS) as Config["led"][]}
          onChange={(value) => patch("led", value)}
        />
      </details>

      <details className="panel tune-section" open>
        <summary>Hardware</summary>
        <div className="preset-row">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={cn("chip", cfg.chips === preset.chips && cfg.rows === preset.rows && "on")}
              onClick={() => setCfg((current) => ({ ...current, chips: preset.chips, rows: preset.rows }))}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="two">
          <NumberField label="Modules" value={cfg.chips} min={LIMITS.chips.min} max={LIMITS.chips.max} onChange={(value) => patch("chips", value)} />
          <NumberField label="Rows" value={cfg.rows} min={LIMITS.rows.min} max={LIMITS.rows.max} onChange={(value) => patch("rows", value)} />
        </div>
        <Segmented
          label="Wiring"
          value={cfg.wiring}
          options={["snake", "zigzag"] as const}
          onChange={(value) => patch("wiring", value as Wiring)}
          hint="Numbers under the modules are chain order, not pixel order. Snake reverses every other row."
        />
        <div className="two">
          <PinField label="CLK" value={cfg.clkPin} onChange={(value) => patch("clkPin", value)} />
          <PinField label="DIN / MOSI" value={cfg.mosiPin} onChange={(value) => patch("mosiPin", value)} />
        </div>
        <PinField label="CS" value={cfg.csPin} onChange={(value) => patch("csPin", value)} />
        {pinClash ? <p className="warn">CLK, DIN, and CS need three different pins.</p> : null}
        {bootPin ? (
          <p className="hint">
            D3, D4, and D8 are boot straps. D8 as CLK is the wiring most builds already have and it is fine if the board
            starts. If it does not, move CLK to D5.
          </p>
        ) : null}
        <label className="field">
          <span className="field-label">Rotate each chip</span>
          <select value={cfg.rotateChip} onChange={(event) => patch("rotateChip", Number(event.target.value) as Config["rotateChip"])}>
            {[0, 90, 180, 270].map((deg) => (
              <option key={deg} value={deg}>
                {deg}°
              </option>
            ))}
          </select>
          <span className="hint">Applied by the driver, not redrawn in the preview. Use the grid test if a module looks sideways.</span>
        </label>
        <Toggle label="Flip X" checked={cfg.flipX} onChange={(value) => patch("flipX", value)} />
      </details>

      <details className="panel tune-section" open>
        <summary>Device</summary>
        <label className="field">
          <span className="field-label">Device name</span>
          <input type="text" value={cfg.deviceName} spellCheck={false} onChange={(e) => patch("deviceName", e.target.value)} />
          <span className="hint">Installs as {deviceSlug(cfg.deviceName)}. Keep max7219-clock if this device is already adopted.</span>
        </label>
        <label className="field">
          <span className="field-label">Friendly name</span>
          <input type="text" value={cfg.friendlyName} onChange={(e) => patch("friendlyName", e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">SNTP timezone</span>
          <input list="zones" value={cfg.timezone} onChange={(e) => patch("timezone", e.target.value)} />
          <datalist id="zones">
            {ZONES.map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
          <span className="hint">Home Assistant time is already local; this is only the SNTP fallback.</span>
        </label>
        <p className="hint">
          Wi-Fi, API, OTA, fallback AP, and web-server credentials stay in your local <code>secrets.yaml</code>. The
          configurator never asks for or stores them.
        </p>
      </details>
    </Section>
  );
}

/* ------------------------------------------------------------------ *
 * Hardware & Wiring
 * ------------------------------------------------------------------ */

export function HardwareSection({ cfg, geo }: { cfg: Config; geo: Geometry }) {
  const softwareSpi = cfg.clkPin !== "D5" || (cfg.mosiPin !== "D7" && cfg.mosiPin !== "D6");
  return (
    <Section
      id="hardware"
      title="Hardware and Wiring"
      lead={<>The default build is a Wemos D1 Mini driving six MAX7219 modules in one row — a 48×8 panel wired with three data lines and shared 5 V power.</>}
    >
      <div className="panel">
        <h3>Default wiring</h3>
        <div className="table-scroll">
        <table className="pin-table">
          <thead>
            <tr>
              <th>Signal</th>
              <th>Module pin</th>
              <th>D1 Mini</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Clock</td>
              <td>CLK</td>
              <td>{cfg.clkPin}</td>
              <td>D8 by default; D5 is the hardware SPI clock alternative</td>
            </tr>
            <tr>
              <td>Data</td>
              <td>DIN</td>
              <td>{cfg.mosiPin}</td>
              <td>D6 by default; first module only — then OUT → IN down the chain</td>
            </tr>
            <tr>
              <td>Load / chip select</td>
              <td>CS</td>
              <td>{cfg.csPin}</td>
              <td>D7 by default</td>
            </tr>
            <tr>
              <td>Ground</td>
              <td>GND</td>
              <td>G</td>
              <td>Common ground with the matrix is mandatory</td>
            </tr>
            <tr>
              <td>Supply</td>
              <td>VCC</td>
              <td>5V</td>
              <td>Matrix wants 5 V; logic from the D1 Mini is 3.3 V</td>
            </tr>
          </tbody>
        </table>
        </div>
        <p>
          Chain <strong>DOUT of one module to DIN of the next</strong>, starting at the module that gets the D1 Mini's
          three lines. The numbers under the preview are chain order. The matrix wants 5 V on VCC; 3.3 V logic usually
          clocks a short chain fine. Past three or four modules, a level shifter on CLK, DIN, and CS is the reliable fix.
          Keep the total current in mind: at full brightness a six-module panel can draw more than half an ampere, so
          power it from a proper 5 V supply rather than a laptop USB port.
        </p>
        {softwareSpi ? (
          <p>
            D5 is hardware SPI clock and D7 is hardware MOSI on a D1 Mini. This configuration uses {cfg.clkPin} and{" "}
            {cfg.mosiPin}, so ESPHome uses software SPI — flexible pinning at a small CPU cost. Leave the wires where
            they are if the clock already runs.
          </p>
        ) : (
          <p>CLK and DIN sit on the hardware SPI pins (D5/D7 or D6), so ESPHome drives the chain over hardware SPI.</p>
        )}
      </div>

      <div className="panel">
        <h3>Test patterns built into the firmware</h3>
        <p>
          <strong>Module grid test</strong> draws a box and one pixel in every 8×8 board. <strong>Pixel checkerboard</strong>{" "}
          proves every LED. Pick either from the Screen select in Tune, or call the buttons Home Assistant exposes. If a
          row is mirrored, change one thing at a time: wiring style (snake ↔ zigzag), rotate chip, flip X, then reverse
          the module order.
        </p>
        <p>
          Current panel: {geo.valid ? `${geo.width}×${geo.height}` : "invalid"} px — {cfg.chips} module
          {cfg.chips === 1 ? "" : "s"} in {cfg.rows} row{cfg.rows === 1 ? "" : "s"}, wired {cfg.wiring}, rotate{" "}
          {cfg.rotateChip}°, flip X {cfg.flipX ? "on" : "off"}.
        </p>
      </div>

      <div className="panel">
        <h3>Changing the hardware shape</h3>
        <p>
          Everything physical is a substitution in the generated YAML, so you never edit the firmware packages: module
          count and rows (Tune → Hardware), wiring style, per-chip rotation, X flip, the three pins, the board id, and
          the timezone. See the full substitution table in{" "}
          <a href={PROJECT.readme} target="_blank" rel="noreferrer">
            README.md
          </a>
          .
        </p>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ *
 * Install YAML
 * ------------------------------------------------------------------ */

export function InstallSection({ cfg, yaml }: { cfg: Config; yaml: string }) {
  const slug = deviceSlug(cfg.deviceName);
  const renames = slug !== "max7219-clock";
  const ids = entityMap(cfg);
  const lines = yaml.split("\n").length;
  const download = () => {
    if (!INSTALLER_READY) return;
    const blob = new Blob([yaml], { type: "text/yaml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slug}.yaml`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Section
      id="install"
      title="Install YAML"
      lead={
        <>
          One small file installs everything. Copy or download it into your ESPHome configuration directory,{" "}
          <strong>beside your existing <code>secrets.yaml</code></strong> — ESPHome downloads the version-pinned firmware
          packages and the selected fonts straight from the project repository during validation and compilation, so
          nothing else has to be copied.
        </>
      }
    >
      <div className="panel">
        <h3>Install in five steps</h3>
        <ol className="install-steps">
          <li>Tune the settings above until the preview matches your panel.</li>
          <li>
            Copy or download <code>{slug}.yaml</code> below into your ESPHome configuration directory, next to your{" "}
            <code>secrets.yaml</code>.
          </li>
          <li>
            Make sure the six entries exist in <code>secrets.yaml</code>: <code>wifi_ssid</code>,{" "}
            <code>wifi_password</code>, <code>api_encryption_key</code>, <code>fallback_ap_password</code>,{" "}
            <code>web_server_username</code>, <code>web_server_password</code>. The file never leaves your machine and
            the generated YAML only references the names with <code>!secret</code>.
          </li>
          <li>
            Validate: <code>esphome config {slug}.yaml</code> must report <em>Configuration is valid!</em> See{" "}
            <a href={PROJECT.validation} target="_blank" rel="noreferrer">
              VALIDATION.md
            </a>{" "}
            for the full offline procedure.
          </li>
          <li>
            Flash over USB once: <code>esphome run {slug}.yaml</code>. After the node is adopted in Home Assistant,
            update it over encrypted native OTA — there is no plaintext web upload.
          </li>
        </ol>
        <div className="action-bar">
          <span className="meta">Install command</span>
          <CopyButton text={installCommand(cfg)} id="run" label="Copy" copiedLabel="Copied" className="ghost" />
        </div>
        <pre className="code">{installCommand(cfg)}</pre>
        {renames ? (
          <p className="warn">
            The device name is <code>{slug}</code>. ESPHome treats that as a new node unless you set it back to
            max7219-clock.
          </p>
        ) : null}
      </div>

      <div className="panel">
        <h3>What the generated file sets — and where to change it</h3>
        <p>
          These are the current values; change each one in Tune and the installer follows. Defaults come from the
          reference build: six modules, one row, D8/D6/D7, UTC.
        </p>
        <div className="table-scroll">
          <table className="pin-table">
            <thead>
              <tr>
                <th>Substitution</th>
                <th>Current value</th>
                <th>Change in</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>device_name</td>
                <td>{slug}</td>
                <td>Tune → Device</td>
              </tr>
              <tr>
                <td>friendly_name</td>
                <td>{cfg.friendlyName}</td>
                <td>Tune → Device</td>
              </tr>
              <tr>
                <td>timezone</td>
                <td>{cfg.timezone}</td>
                <td>Tune → Device</td>
              </tr>
              <tr>
                <td>board</td>
                <td>d1_mini</td>
                <td>edit the YAML (any ESP8266 board id)</td>
              </tr>
              <tr>
                <td>matrix_clk_pin / mosi / cs</td>
                <td>
                  {cfg.clkPin} / {cfg.mosiPin} / {cfg.csPin}
                </td>
                <td>Tune → Hardware</td>
              </tr>
              <tr>
                <td>matrix_chips · matrix_rows</td>
                <td>
                  {cfg.chips} · {cfg.rows} ({geoLabel(cfg)})
                </td>
                <td>Tune → Hardware</td>
              </tr>
              <tr>
                <td>matrix_wiring</td>
                <td>{cfg.wiring}</td>
                <td>Tune → Hardware</td>
              </tr>
              <tr>
                <td>matrix_rotate_chip · matrix_flip_x</td>
                <td>
                  {cfg.rotateChip}° · {String(cfg.flipX)}
                </td>
                <td>Tune → Hardware</td>
              </tr>
              <tr>
                <td>font packages</td>
                <td>
                  {cfg.fonts.length} external face{cfg.fonts.length === 1 ? "" : "s"} + Compact 5×7 fallback
                </td>
                <td>Font Lab</td>
              </tr>
              <tr>
                <td>project_ref / ref</td>
                <td>{PROJECT.ref} (immutable release tag)</td>
                <td>fixed by the release</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="hint">
          Home Assistant entities are named after the device, e.g. <code>{ids.font}</code> — the full map is in the{" "}
          <a href="#assistant">Home Assistant section</a>.
        </p>
      </div>

      <div className="panel">
        <div className="yaml-bar">
          <h3>
            {slug}.yaml <span className="meta">· {lines} lines</span>
          </h3>
          <div className="btn-row">
            <button type="button" className="btn ghost" disabled={!INSTALLER_READY} onClick={download}>
              Download
            </button>
            <CopyButton text={yaml} id="yaml" label="Copy install YAML" copiedLabel="Copied" />
          </div>
        </div>
        <pre>{yaml}</pre>
      </div>
    </Section>
  );
}

function geoLabel(cfg: Config): string {
  const geo = geometry(cfg.chips, cfg.rows);
  return geo.valid ? `${geo.width}×${geo.height} px` : "invalid layout";
}

/* ------------------------------------------------------------------ *
 * Home Assistant
 * ------------------------------------------------------------------ */

export function AssistantSection({ cfg }: { cfg: Config }) {
  const ids = entityMap(cfg);
  const action = sampleAction(cfg, cfg.message || "DOOR", cfg.messageHold);
  return (
    <Section
      id="assistant"
      title="Home Assistant entities and actions"
      lead={
        <>
          After the first flash, adopt the device in Home Assistant and every entity below appears through the ESPHome
          integration. IDs derive from the device name — <code>{ids.node}</code> — so the examples match your install.
        </>
      }
    >
      <div className="panel">
        <h3>Actions (Developer tools → Actions)</h3>
        <div className="action-bar">
          <span className="meta">Show a message with the current hold of {cfg.messageHold} s</span>
          <CopyButton text={action} id="action" label="Copy action" copiedLabel="Copied" />
        </div>
        <pre className="code">{action}</pre>
        <pre className="code">{`# Clear a message
action: ${ids.clearAction}

# Start a five-minute countdown
action: ${ids.countdownAction}
data:
  seconds: 300

# Short static status note
action: esphome.${ids.node}_show_status
data:
  note: "WASHING DONE"
  duration: 20`}</pre>
        <p className="hint">A duration of 0 keeps a message until it is cleared. Confirm generated IDs after adoption; Home Assistant may adjust duplicates.</p>
      </div>

      <div className="panel">
        <h3>Example automations</h3>
        <pre className="code">{`alias: Matrix clock doorbell
triggers:
  - trigger: state
    entity_id: binary_sensor.front_door
    to: "on"
actions:
  - action: ${ids.showAction}
    data:
      message: "DOOR"
      duration: 15`}</pre>
      </div>

      <div className="panel">
        <h3>Selects</h3>
        <div className="table-scroll">
          <table className="pin-table">
            <tbody>
              <tr><td>Screen</td><td>Clock, Date, Message, Module grid test, Pixel checkerboard</td></tr>
              <tr><td>Clock alignment</td><td>Left, Center, Right</td></tr>
              <tr><td>Time format</td><td>24 hour, 12 hour</td></tr>
              <tr><td>Seconds display</td><td>Off, Digits, Bar</td></tr>
              <tr><td>Date format</td><td>DD.MM, MM/DD, DD/MM</td></tr>
              <tr><td>Clock font</td><td>the faces you included in Font Lab, plus Compact 5x7</td></tr>
              <tr><td>Message scroll</td><td>Scroll, Static</td></tr>
            </tbody>
          </table>
        </div>
        <h3>Numbers, switches and buttons</h3>
        <p>
          Brightness and night brightness (0–15), animation duration (0–2000 ms), scroll speed (20–200 ms/px), message
          duration (0–3600 s), countdown (10–3599 s), cycle interval (5–300 s), night start/end hour. Switches: display
          power, blinking colon, digit animation, automatic cycling, night mode and schedule, display inversion.
          Buttons: restart, return to clock, clear message, start/cancel countdown, both test patterns, restore display
          defaults.
        </p>
        <h3>Diagnostics</h3>
        <p>
          Display mode (<code>{ids.mode}</code>), OTA state (<code>{ids.ota}</code>), countdown remaining, Wi-Fi signal,
          IP address, uptime, heap statistics, reset reason. Key IDs for automations:
        </p>
        <ul className="entity-list">
          <li>Screen <code>{ids.screen}</code></li>
          <li>Clock font <code>{ids.font}</code></li>
          <li>Brightness <code>{ids.brightness}</code></li>
          <li>Show message <code>{ids.showAction}</code></li>
        </ul>
        <p className="hint">
          ESPHome restores the Clock font <em>index</em>, not its name: after flashing a different font subset,
          re-select the face once. The renderer always keeps the Compact fallback.
        </p>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ *
 * Troubleshooting
 * ------------------------------------------------------------------ */

const TROUBLE: { term: string; lines: string[] }[] = [
  {
    term: "Blank display",
    lines: [
      "Work top to bottom: 5 V on VCC and a common ground between the matrix and the D1 Mini (a missing common ground is the classic cause), then CLK/DIN/CS on the first module's IN header, then the Matrix display switch in Home Assistant, then brightness 0–15. Run the pixel checkerboard from the Screen select — if the LEDs stay dark with valid wiring, measure the supply.",
    ],
  },
  {
    term: "Mirrored or swapped modules",
    lines: [
      "Chain order follows the wires, not the wall. Change one thing at a time: wiring style snake ↔ zigzag, then rotate chip (0/90/180/270), then flip X, then physically reverse the module order. Run the module grid test after each change — every board should draw a box with one dot in the same corner.",
    ],
  },
  {
    term: "Wrong time",
    lines: [
      "The clock follows Home Assistant time and falls back to SNTP (--:-- means no time at all yet). Check that Home Assistant's time is correct, that the device is connected, and that the timezone substitution matches yours. The preview clock on this page always uses your browser's clock.",
    ],
  },
  {
    term: "Font too wide",
    lines: [
      "The renderer never clips: full HH:MM:SS → HH:MM plus the seconds bar → built-in 5×7. Font Lab warns before you install; pick Dot Matrix, Compact 5×7 or another narrow face for small panels, or add modules.",
    ],
  },
  {
    term: "OTA updates",
    lines: [
      "Use encrypted native OTA — it reuses the API encryption key, so an already-paired device keeps working. There is deliberately no plaintext web upload endpoint (web-server OTA is disabled). First flash over USB; after adoption, update from Home Assistant or esphome run. OTA progress, 100% and errors are drawn on the matrix itself.",
    ],
  },
  {
    term: "couldn't find remote ref 0.4.0",
    lines: [
      "The ref pins a release tag that does not exist in the repository you point at — publish the tag first, or point ref at an existing one. If ESPHome cached the failed attempt, run once with refresh: 0s.",
    ],
  },
  {
    term: "Couldn't find ID 'display_mode' (or ota_state, …)",
    lines: [
      "Your files: list is missing required modules. Keep the complete package list from the generated installer; only packages/web_server.yaml may be removed.",
    ],
  },
  {
    term: "Out of flash",
    lines: [
      "ESP8266 flash is tight. Remove optional extra fonts in Font Lab and rebuild, or drop packages/web_server.yaml from the package list.",
    ],
  },
];

export function TroubleshootingSection() {
  return (
    <Section
      id="troubleshooting"
      title="Troubleshooting"
      lead={<>Symptoms first, fix second, in the order the hardware fails. Every entry maps to a control above or an entity in Home Assistant.</>}
    >
      {TROUBLE.map((item) => (
        <details key={item.term} className="panel trouble">
          <summary>{item.term}</summary>
          {item.lines.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </details>
      ))}
    </Section>
  );
}

/* ------------------------------------------------------------------ *
 * Gallery
 * ------------------------------------------------------------------ */

export interface GalleryItem {
  file: string;
  alt: string;
  caption: string;
}

export const GALLERY: GalleryItem[] = [
  {
    file: "clock-in-use.jpg",
    alt: "Close-up of the finished six-module MAX7219 matrix clock displaying 11:18:20 in glowing red-orange LED dots",
    caption: "The working clock: full-width HH:MM:SS across the 48×8 panel.",
  },
  {
    file: "wired-matrix-back.jpg",
    alt: "Back of the MAX7219 modules showing the CLK, CS, DIN, GND and VCC solder pads wired to a blue Wemos D1 Mini",
    caption: "Back-side wiring: VCC, GND, CLK, CS and DIN land on module 1's IN header, then OUT → IN down the chain.",
  },
  {
    file: "wired-matrix-end.jpg",
    alt: "End view of the Wemos D1 Mini plugged into the input end of the LED matrix chain with its USB connector facing out",
    caption: "Controller end-view: the D1 Mini mounts at the matrix input, USB port reachable for the first flash.",
  },
  {
    file: "d1-mini.jpg",
    alt: "A Wemos D1 Mini ESP8266 board with soldered header pins standing on a dark electronics work mat",
    caption: "The controller: a Wemos D1 Mini (ESP8266) — pin labels in the YAML are D0–D8.",
  },
  {
    file: "module-macro.jpg",
    alt: "Macro photograph of an 8×8 LED matrix module with a cluster of amber LEDs lit inside their dark sockets",
    caption: "One 8×8 module up close: 64 LED dots per board, six boards per clock.",
  },
  {
    file: "workbench.jpg",
    alt: "Electronics workbench with MAX7219 matrix modules in a row jumper-wired to an ESP8266 board among tools, solder and parts",
    caption: "Bench test before assembly: the chain laid out and jumper-wired on the desk.",
  },
];

export function GallerySection() {
  return (
    <Section
      id="gallery"
      title="Gallery"
      lead={<>The reference build, from bare boards on the bench to the finished clock on the wall.</>}
    >
      <div className="photo-grid">
        {GALLERY.map((item) => (
          <figure key={item.file}>
            <img src={`./images/${item.file}`} alt={item.alt} loading="lazy" />
            <figcaption>{item.caption}</figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ *
 * GitHub & documentation
 * ------------------------------------------------------------------ */

export function DocsSection() {
  return (
    <Section
      id="docs"
      title="GitHub and documentation"
      lead={<>Everything the configurator generates is documented and versioned in the project repository.</>}
    >
      <div className="panel">
        <h3>Project documentation</h3>
        <ul className="link-list">
          <li>
            <a href={PROJECT.readme} target="_blank" rel="noreferrer">
              README.md
            </a>{" "}
            — features, hardware, installation, security, the full entity and action list.
          </li>
          <li>
            <a href={PROJECT.validation} target="_blank" rel="noreferrer">
              VALIDATION.md
            </a>{" "}
            — how <code>esphome config</code>, the C++ renderer tests and the offline release validation are run.
          </li>
          <li>
            <a href={PROJECT.roadmap} target="_blank" rel="noreferrer">
              ROADMAP.md
            </a>{" "}
            — the implementation contract and what is still open (including Font Lab candidates).
          </li>
          <li>
            <a href={PROJECT.issues} target="_blank" rel="noreferrer">
              GitHub Issues
            </a>{" "}
            — bug reports and font requests. Font Lab exists to audition candidates before they are measured for
            ESP8266 flash.
          </li>
          <li>
            <a href={`${PROJECT.repo}/tree/main/packages`} target="_blank" rel="noreferrer">
              packages/
            </a>{" "}
            and{" "}
            <a href={`${PROJECT.repo}/tree/main/web-configurator`} target="_blank" rel="noreferrer">
              web-configurator/
            </a>{" "}
            — the firmware modules the installer downloads, and this app's source.
          </li>
        </ul>
      </div>
      <div className="panel">
        <h3>How this page is deployed</h3>
        <p>
          The live configurator at{" "}
          <a href={PROJECT.live} target="_blank" rel="noreferrer">
            sandro-defender.github.io/Esphome-Max7219-Matrix-Clock
          </a>{" "}
          builds automatically: a GitHub Actions workflow tests, type-checks and builds <code>web-configurator/</code>{" "}
          on every change to <code>main</code> and publishes the static bundle to GitHub Pages. To run it yourself, fork
          the repository and enable the same workflow — see{" "}
          <a href={`${PROJECT.repo}/tree/main/web-configurator`} target="_blank" rel="noreferrer">
            web-configurator/README.md
          </a>
          .
        </p>
        <h3>Firmware references</h3>
        <p>
          Target is <strong>ESPHome {PROJECT.esphome}</strong>. Useful pages:{" "}
          <a href="https://esphome.io/components/display/max7219digit/" target="_blank" rel="noreferrer">
            MAX7219 Digit Display
          </a>
          ,{" "}
          <a href="https://esphome.io/components/packages/" target="_blank" rel="noreferrer">
            Packages
          </a>
          ,{" "}
          <a href="https://esphome.io/components/ota/esphome/" target="_blank" rel="noreferrer">
            OTA encryption
          </a>
          ,{" "}
          <a href="https://esphome.io/components/font/" target="_blank" rel="noreferrer">
            Font Renderer
          </a>
          .
        </p>
      </div>
    </Section>
  );
}
