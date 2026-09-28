import { useMemo, useState } from "react";
import { LiveMark, LiveStage } from "./LiveStage";
import { LEDS } from "./leds";
import { normalizeMessage } from "./fonts";
import { deviceSlug, geometry } from "./render";
import {
  DEFAULT_CONFIG,
  PINS,
  type Alignment,
  type Config,
  type HourFormat,
  type LedName,
  type ScreenMode,
  type Wiring,
} from "./types";
import { buildYaml, entityMap, sampleAction } from "./yaml";
import { cn } from "./utils/cn";

const TABS = ["Tune", "Install YAML", "Assistant", "Wiring", "GitHub"] as const;
type Tab = (typeof TABS)[number];

const SCREENS: ScreenMode[] = [
  "Clock",
  "Date",
  "Message",
  "Module grid test",
  "Pixel checkerboard",
];

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
  { label: "6×1 · 00:00:00", chips: 6, rows: 1 },
  { label: "4×1 · 00:00", chips: 4, rows: 1 },
  { label: "8×1", chips: 8, rows: 1 },
  { label: "12×1", chips: 12, rows: 1 },
  { label: "8×2", chips: 8, rows: 2 },
  { label: "12×2", chips: 12, rows: 2 },
];

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "true");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button type="button" className={cn("toggle-row", checked && "on")} aria-pressed={checked} onClick={() => onChange(!checked)}>
      <span>
        <strong>{label}</strong>
        {hint ? <em>{hint}</em> : null}
      </span>
      <i />
    </button>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (next: number) => void;
}) {
  return (
    <label className="field">
      <span className="slider-head">
        <strong>{label}</strong>
        <b>
          {value}
          {unit ? ` ${unit}` : ""}
        </b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export default function App() {
  const [cfg, setCfg] = useState<Config>(DEFAULT_CONFIG);
  const [tab, setTab] = useState<Tab>("Tune");
  const [copied, setCopied] = useState<string | null>(null);
  const [ghUser, setGhUser] = useState("my-user");
  const [ghRepo, setGhRepo] = useState("max7219-clock");

  const patch = <K extends keyof Config>(key: K, value: Config[K]) => {
    setCfg((current) => ({ ...current, [key]: value }));
  };

  const yaml = useMemo(() => buildYaml(cfg), [cfg]);
  const ids = entityMap(cfg);
  const shown = normalizeMessage(cfg.message);
  const geo = geometry(cfg.chips, cfg.rows);
  const pinClash = new Set([cfg.clkPin, cfg.mosiPin, cfg.csPin]).size < 3;
  const bootPin = [cfg.clkPin, cfg.mosiPin, cfg.csPin].some((pin) => pin === "D3" || pin === "D4" || pin === "D8");
  const lines = yaml.split("\n").length;
  const action = sampleAction(cfg, shown || "DOOR", cfg.messageHold);

  const copy = async (text: string, id: string) => {
    const ok = await copyText(text);
    if (!ok) return;
    setCopied(id);
    window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 1600);
  };

  const download = () => {
    const blob = new Blob([yaml], { type: "text/yaml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${deviceSlug(cfg.deviceName)}.yaml`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <LiveMark />
          <div>
            <div className="brand-name">
              Clock<span>lab</span>
            </div>
            <small>Wemos D1 Mini · MAX7219</small>
          </div>
        </div>
        <div className="top-actions">
          <button
            type="button"
            className={cn("btn", tab === "GitHub" ? "primary" : "ghost")}
            onClick={() => setTab("GitHub")}
            title="Deploy and run this page on GitHub Pages"
          >
            <svg className="inline mr-1" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            GitHub
          </button>
          <button type="button" className="btn ghost" onClick={() => setTab("Install YAML")}>
            {lines} lines
          </button>
          <button type="button" className="btn primary" onClick={() => copy(yaml, "yaml")}>
            {copied === "yaml" ? "Copied" : "Copy install YAML"}
          </button>
        </div>
      </header>

      <main className="shell">
        <LiveStage cfg={cfg} onMessage={(value) => patch("message", value)} />

        <section className="deck">
          <div className="tabs" role="tablist">
            {TABS.map((name) => (
              <button key={name} type="button" className={cn("tab", tab === name && "on")} onClick={() => setTab(name)}>
                {name}
              </button>
            ))}
          </div>

          {tab === "Tune" ? (
            <div className="stack">
              <div className="panel" style={{ borderColor: "rgba(255, 30, 60, 0.4)", background: "rgba(35, 12, 14, 0.65)" }}>
                <h3 style={{ color: "#ff4d64" }}>Full-size HH:MM:SS and bundled fonts</h3>
                <div className="field">
                  <span className="field-label">Layout mode</span>
                  <div className="seg">
                    <button
                      type="button"
                      className={cn(cfg.clockLayout === "segment" && "on")}
                      onClick={() => patch("clockLayout", "segment")}
                    >
                      1 number in 1 segment (6 segments · 00:00:00)
                    </button>
                    <button
                      type="button"
                      className={cn(cfg.clockLayout === "compact" && "on")}
                      onClick={() => patch("clockLayout", "compact")}
                    >
                      Compact Proportional
                    </button>
                  </div>
                  <span className="hint">
                    {cfg.clockLayout === "segment"
                      ? "6 segments - 6 numbers: Module 0=H1, Mod 1=H2:, Mod 2=M1, Mod 3=M2:, Mod 4=S1, Mod 5=S2."
                      : "Grouped proportional clock digits."}
                  </span>
                </div>

                <div className="field">
                  <span className="field-label">Clock font</span>
                  <div className="seg">
                    <button
                      type="button"
                      className={cn(cfg.clockFont === "blood-drip" && "on")}
                      onClick={() => patch("clockFont", "blood-drip")}
                    >
                      Tiny5
                    </button>
                    <button
                      type="button"
                      className={cn(cfg.clockFont === "blood-bold" && "on")}
                      onClick={() => patch("clockFont", "blood-bold")}
                    >
                      Press Start 2P
                    </button>
                    <button
                      type="button"
                      className={cn(cfg.clockFont === "classic" && "on")}
                      onClick={() => patch("clockFont", "classic")}
                    >
                      Compact 5×7
                    </button>
                  </div>
                  <span className="hint">
                    Tiny5 and Press Start 2P are downloaded from this repository at compile time. Home Assistant switches between
                    the compiled fonts at runtime.
                  </span>
                </div>

                <Toggle
                  label="Digit slide-up animation"
                  hint="Changed digits slide upward without blocking the clock or OTA display."
                  checked={cfg.bloodDrips}
                  onChange={(v) => patch("bloodDrips", v)}
                />
              </div>

              <div className="panel">
                <h3>Screen</h3>
                <label className="field">
                  <span className="field-label">Mode</span>
                  <select value={cfg.screen} onChange={(e) => patch("screen", e.target.value as ScreenMode)}>
                    {SCREENS.map((screen) => (
                      <option key={screen}>{screen}</option>
                    ))}
                  </select>
                  <span className="hint">These are the display modes exposed by the modular firmware.</span>
                </label>
                <div className="field">
                  <span className="field-label">Alignment</span>
                  <div className="seg">
                    {(["Left", "Center", "Right"] as Alignment[]).map((item) => (
                      <button key={item} type="button" className={cn(cfg.alignment === item && "on")} onClick={() => patch("alignment", item)}>
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <span className="field-label">Hour format</span>
                  <div className="seg">
                    {(["24-hour", "12-hour"] as HourFormat[]).map((item) => (
                      <button key={item} type="button" className={cn(cfg.hourFormat === item && "on")} onClick={() => patch("hourFormat", item)}>
                        {item}
                      </button>
                    ))}
                  </div>
                  <span className="hint">12-hour mode adds a single PM dot beside the clock when there is a free pixel.</span>
                </div>
                <Slider label="Page dwell" value={cfg.pageDwell} min={2} max={30} step={1} unit="s" onChange={(v) => patch("pageDwell", v)} />
              </div>

              <div className="panel">
                <h3>Clock and second counter</h3>
                <Toggle
                  label="Show seconds"
                  hint="HH:MM:SS. Six modules fit the original 5×7 digits. Narrower chains drop to 3×5."
                  checked={cfg.showSeconds}
                  onChange={(v) => patch("showSeconds", v)}
                />
                <Toggle
                  label="Second counter bar"
                  hint="Bottom pixel row fills across the minute. A gap marks every 10 seconds."
                  checked={cfg.secondBar}
                  onChange={(v) => patch("secondBar", v)}
                />
                <Toggle label="Blink colon" hint="Colon is on for even seconds, off for odd." checked={cfg.blinkColon} onChange={(v) => patch("blinkColon", v)} />
                <Toggle label="Leading zero" checked={cfg.leadingZero} onChange={(v) => patch("leadingZero", v)} />
                <p className="hint">
                  Six modules use the original 5×7 digits for HH:MM:SS. Four modules drop to a 3×5 face so the seconds still fit.
                </p>
              </div>

              <div className="panel">
                <h3>Messages</h3>
                <Toggle
                  label="Messages enabled"
                  hint="Turns the Home Assistant text path on. The Message screen still previews text if this is off."
                  checked={cfg.messagesEnabled}
                  onChange={(v) => patch("messagesEnabled", v)}
                />
                <Toggle
                  label="Interrupt the clock"
                  hint="A new message takes the 8px row, or the bottom row if you have two. Hold 0 stays until cleared."
                  checked={cfg.interruptOnMessage}
                  onChange={(v) => patch("interruptOnMessage", v)}
                />
                <Slider label="Hold" value={cfg.messageHold} min={0} max={180} step={5} unit="s" onChange={(v) => patch("messageHold", v)} />
                <Slider label="Scroll speed" value={cfg.scrollSpeed} min={40} max={280} step={10} unit="ms" onChange={(v) => patch("scrollSpeed", v)} />
              </div>

              <div className="panel">
                <h3>Light</h3>
                <Slider label="Brightness" value={cfg.brightness} min={0} max={15} step={1} onChange={(v) => patch("brightness", v)} />
                <Toggle label="Night dimming" hint="Uses the clock hour, not the browser, once the firmware is installed." checked={cfg.nightDim} onChange={(v) => patch("nightDim", v)} />
                <Slider label="Night brightness" value={cfg.nightBrightness} min={0} max={15} step={1} onChange={(v) => patch("nightBrightness", v)} />
                <div className="two">
                  <label className="field">
                    <span className="field-label">Night starts</span>
                    <input type="number" min={0} max={23} value={cfg.nightStart} onChange={(e) => patch("nightStart", clampHour(e.target.value))} />
                  </label>
                  <label className="field">
                    <span className="field-label">Night ends</span>
                    <input type="number" min={0} max={23} value={cfg.nightEnd} onChange={(e) => patch("nightEnd", clampHour(e.target.value))} />
                  </label>
                </div>
                <p className="hint">
                  Night runs from {cfg.nightStart}:00 until {cfg.nightEnd}:00. The live preview dims when this hour is inside that window.
                </p>
                <Toggle label="Display power" checked={cfg.displayPower} onChange={(v) => patch("displayPower", v)} />
                <Toggle label="Invert" hint="Lit background, dark glyphs. Useful if a module is mounted backwards." checked={cfg.invert} onChange={(v) => patch("invert", v)} />
                <div className="field">
                  <span className="field-label">LED color · preview only</span>
                  <div className="seg">
                    {(Object.keys(LEDS) as LedName[]).map((name) => (
                      <button key={name} type="button" className={cn(cfg.led === name && "on")} onClick={() => patch("led", name)}>
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="panel">
                <h3>Hardware</h3>
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
                  <label className="field">
                    <span className="field-label">Modules</span>
                    <input type="number" min={1} max={16} value={cfg.chips} onChange={(e) => patch("chips", clamp(e.target.value, 1, 16))} />
                  </label>
                  <label className="field">
                    <span className="field-label">Rows</span>
                    <input type="number" min={1} max={4} value={cfg.rows} onChange={(e) => patch("rows", clamp(e.target.value, 1, 4))} />
                  </label>
                </div>
                <div className="field">
                  <span className="field-label">Wiring</span>
                  <div className="seg">
                    {(["snake", "zigzag"] as Wiring[]).map((item) => (
                      <button key={item} type="button" className={cn(cfg.wiring === item && "on")} onClick={() => patch("wiring", item)}>
                        {item}
                      </button>
                    ))}
                  </div>
                  <span className="hint">Numbers under the modules are chain order, not pixel order. Snake reverses every other row.</span>
                </div>
                <div className="two">
                  <PinField label="CLK" value={cfg.clkPin} onChange={(v) => patch("clkPin", v)} />
                  <PinField label="DIN / MOSI" value={cfg.mosiPin} onChange={(v) => patch("mosiPin", v)} />
                </div>
                <PinField label="CS" value={cfg.csPin} onChange={(v) => patch("csPin", v)} />
                {pinClash ? <p className="warn">CLK, DIN, and CS need three different pins.</p> : null}
                {bootPin ? (
                  <p className="hint">
                    D3, D4, and D8 are boot straps. D8 as CLK is the wiring you already have, and it is fine if the board starts.
                    If it does not, move CLK to D5.
                  </p>
                ) : null}
                <label className="field">
                  <span className="field-label">Rotate each chip</span>
                  <select value={cfg.rotateChip} onChange={(e) => patch("rotateChip", Number(e.target.value) as Config["rotateChip"])}>
                    {[0, 90, 180, 270].map((deg) => (
                      <option key={deg} value={deg}>
                        {deg}°
                      </option>
                    ))}
                  </select>
                  <span className="hint">Applied by the driver, not redrawn in the preview. Use the grid test if a module looks sideways.</span>
                </label>
                <Toggle label="Flip X" checked={cfg.flipX} onChange={(v) => patch("flipX", v)} />
              </div>

              <div className="panel">
                <h3>Home Assistant extras</h3>
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
                  <span className="hint">Home Assistant time is already local. This timezone is only for the SNTP fallback.</span>
                </label>
                <p className="hint">
                  Wi-Fi, API, OTA, fallback AP, and web-server credentials stay in your local <code>secrets.yaml</code>. The
                  configurator never asks for or stores them.
                </p>
                <Slider
                  label="Preview Wi-Fi dBm"
                  value={cfg.previewRssi}
                  min={-95}
                  max={-40}
                  step={1}
                  onChange={(v) => patch("previewRssi", v)}
                />
              </div>
            </div>
          ) : null}

          {tab === "Install YAML" ? (
            <div className="stack">
              <div className="panel">
                <div className="yaml-bar">
                  <span>
                    {deviceSlug(cfg.deviceName)}.yaml · {lines} lines
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" className="btn ghost" onClick={download}>
                      Download
                    </button>
                    <button type="button" className="btn primary" onClick={() => copy(yaml, "yaml")}>
                      {copied === "yaml" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
                <p>
                  This is the complete one-file installer. Keep it beside your existing <code>secrets.yaml</code>. ESPHome downloads
                  the version-pinned modular firmware and fonts from this repository during validation and compilation.
                </p>
                <ol>
                  <li>Download this YAML into your ESPHome configuration directory.</li>
                  <li>Confirm the six required entries exist in <code>secrets.yaml</code>.</li>
                  <li>Validate and compile with ESPHome 2026.9.0.</li>
                  <li>Install over USB first, or use encrypted OTA when the existing device credentials match.</li>
                </ol>
                {deviceSlug(cfg.deviceName) !== "max7219-clock" ? (
                  <p className="warn">The device name changed. ESPHome will treat this as a new node unless you change it back.</p>
                ) : null}
              </div>
              <pre>{yaml}</pre>
            </div>
          ) : null}

          {tab === "Assistant" ? (
            <div className="stack">
              <div className="card">
                <h3>Show a message</h3>
                <p>
                  <code>{ids.showAction}</code> displays text for the requested duration. A duration of zero uses the default
                  message duration configured in Home Assistant.
                </p>
                <div className="action-bar">
                  <span className="meta">Example using the current preview message</span>
                  <button type="button" className="btn primary" onClick={() => copy(action, "action")}>
                    {copied === "action" ? "Copied" : "Copy action"}
                  </button>
                </div>
                <pre className="code">{action}</pre>
              </div>
              <div className="card">
                <h3>Doorbell</h3>
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
              <div className="card">
                <h3>Clear or start a countdown</h3>
                <pre className="code">{`# Clear a message
action: ${ids.clearAction}

# Start a five-minute countdown
action: ${ids.countdownAction}
data:
  seconds: 300`}</pre>
                <p>
                  Confirm generated entity IDs in Home Assistant after installation; Home Assistant may adjust them when a device
                  with the same name already exists.
                </p>
              </div>
              <ul className="entity-list">
                <li>
                  Display mode <code>{ids.mode}</code>
                </li>
                <li>
                  Clock font <code>{ids.font}</code>
                </li>
                <li>
                  Screen <code>{ids.screen}</code>
                </li>
                <li>
                  Brightness <code>{ids.brightness}</code>
                </li>
                <li>
                  Message duration <code>{ids.duration}</code>
                </li>
                <li>
                  OTA state <code>{ids.ota}</code>
                </li>
              </ul>
            </div>
          ) : null}

          {tab === "Wiring" ? (
            <div className="stack">
              <div className="photo-grid">
                <figure>
                  <img src="./images/workbench.jpg" alt="Dark workbench with a row of LED matrix modules and a small ESP8266 board" />
                  <figcaption>Six modules in one row is 48×8, enough for 5×7 seconds.</figcaption>
                </figure>
                <figure>
                  <img src="./images/d1-mini.jpg" alt="Close photograph of a Wemos D1 Mini on a dark mat" />
                  <figcaption>D1 Mini. Pin labels in the YAML are D0–D8.</figcaption>
                </figure>
              </div>
              <div className="panel">
                <h3>Pins kept from your file</h3>
                <table className="pin-table">
                  <thead>
                    <tr>
                      <th>Signal</th>
                      <th>Module</th>
                      <th>D1 Mini</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Clock</td>
                      <td>CLK</td>
                      <td>{cfg.clkPin}</td>
                    </tr>
                    <tr>
                      <td>Data</td>
                      <td>DIN</td>
                      <td>{cfg.mosiPin}</td>
                    </tr>
                    <tr>
                      <td>Load</td>
                      <td>CS</td>
                      <td>{cfg.csPin}</td>
                    </tr>
                    <tr>
                      <td>Ground</td>
                      <td>GND</td>
                      <td>G</td>
                    </tr>
                    <tr>
                      <td>5 V</td>
                      <td>VCC</td>
                      <td>5V</td>
                    </tr>
                  </tbody>
                </table>
                <p>
                  The matrix wants 5 V on VCC. Logic from the D1 Mini is 3.3 V and usually works for a short chain. Past three or
                  four modules, a level shifter on CLK, DIN, and CS is the reliable fix. Chain DOUT of one module to DIN of the
                  next. Numbers on the preview are that chain order.
                </p>
                <p>
                  D5 is hardware SPI clock and D7 is hardware MOSI. Your file uses {cfg.clkPin} and {cfg.mosiPin}, so ESPHome uses
                  software SPI. Leave the wires if the clock already runs.
                </p>
              </div>
              <div className="panel">
                <h3>What the new file still tests</h3>
                <p>
                  Screen → Module grid test draws a box and a pixel in each 8×8. Checkerboard proves every LED. If a row is
                  mirrored, try snake versus zigzag, then rotate chip, then flip X, then reverse module order. One change at a
                  time.
                </p>
                <p>
                  Logical size now: {geo.valid ? `${geo.width}×${geo.height}` : "invalid"}. {cfg.chips} chips, {cfg.rows} row
                  {cfg.rows === 1 ? "" : "s"}, {cfg.wiring}.
                </p>
              </div>
            </div>
          ) : null}

          {tab === "GitHub" ? (
            <div className="stack">
              <div className="panel" style={{ borderColor: "rgba(56, 189, 248, 0.4)", background: "rgba(15, 23, 42, 0.65)" }}>
                <div className="yaml-bar">
                  <h3 style={{ color: "#38bdf8", margin: 0 }}>Run on GitHub Pages</h3>
                  <span className="seg-tag" style={{ borderColor: "rgba(56, 189, 248, 0.4)", color: "#7dd3fc" }}>
                    ✓ GitHub Pages Ready
                  </span>
                </div>
                <p style={{ marginTop: 8 }}>
                  This web app is 100% client-side React + Vite. It requires zero server backend and runs directly on GitHub Pages!
                </p>

                <div className="two" style={{ marginTop: 12 }}>
                  <label className="field" style={{ margin: 0 }}>
                    <span className="field-label">GitHub Username / Org</span>
                    <input
                      type="text"
                      spellCheck={false}
                      value={ghUser}
                      placeholder="e.g. your-username"
                      onChange={(e) => setGhUser(e.target.value.trim().toLowerCase())}
                    />
                  </label>
                  <label className="field" style={{ margin: 0 }}>
                    <span className="field-label">Repository Name</span>
                    <input
                      type="text"
                      spellCheck={false}
                      value={ghRepo}
                      placeholder="e.g. max7219-clock"
                      onChange={(e) => setGhRepo(e.target.value.trim().toLowerCase())}
                    />
                  </label>
                </div>

                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 10,
                    background: "rgba(8, 14, 26, 0.8)",
                    border: "1px solid rgba(56, 189, 248, 0.25)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "#94a3b8", display: "block", fontFamily: "var(--mono)" }}>
                      YOUR LIVE GITHUB PAGES URL:
                    </span>
                    <strong style={{ color: "#38bdf8", fontFamily: "var(--mono)", fontSize: "0.95rem" }}>
                      https://{ghUser || "username"}.github.io/{ghRepo || "repo"}/
                    </strong>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => copy(`https://${ghUser || "username"}.github.io/${ghRepo || "repo"}/`, "gh-url")}
                    >
                      {copied === "gh-url" ? "Copied" : "Copy URL"}
                    </button>
                    <a
                      href={`https://${ghUser || "username"}.github.io/${ghRepo || "repo"}/`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn ghost"
                    >
                      Open ↗
                    </a>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3>Option 1: Push Repository with GitHub Actions (Recommended)</h3>
                <p>
                  This combined repository includes <code>.github/workflows/deploy-configurator.yml</code>. It tests, type-checks,
                  builds, and deploys the app from <code>web-configurator/</code> whenever that directory changes on main.
                </p>
                <ol>
                  <li>Create a new repository on GitHub named <code>{ghRepo || "max7219-clock"}</code>.</li>
                  <li>Run the following commands in your project terminal:</li>
                </ol>
                <div className="action-bar" style={{ marginTop: 10 }}>
                  <span className="meta">Terminal commands (customized for your repo)</span>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() =>
                      copy(
                        `git init\ngit add .\ngit commit -m "Deploy MAX7219 Clocklab to GitHub Pages"\ngit branch -M main\ngit remote add origin https://github.com/${
                          ghUser || "your-username"
                        }/${ghRepo || "max7219-clock"}.git\ngit push -u origin main`,
                        "git-cmds"
                      )
                    }
                  >
                    {copied === "git-cmds" ? "Copied" : "Copy Git Commands"}
                  </button>
                </div>
                <pre className="code">{`git init
git add .
git commit -m "Deploy MAX7219 Clocklab to GitHub Pages"
git branch -M main
git remote add origin https://github.com/${ghUser || "your-username"}/${ghRepo || "max7219-clock"}.git
git push -u origin main`}</pre>
                <ol start={3} style={{ marginTop: 10 }}>
                  <li>
                    In your GitHub repo: go to <strong>Settings</strong> → <strong>Pages</strong>.
                  </li>
                  <li>
                    Under <strong>Build and deployment</strong> → <strong>Source</strong>, select <strong>GitHub Actions</strong>.
                  </li>
                  <li>
                    The workflow runs immediately and your site will be live at{" "}
                    <code>https://{ghUser || "username"}.github.io/{ghRepo || "repo"}/</code>!
                  </li>
                </ol>
              </div>

              <div className="card">
                <h3>Option 2: Standalone Single-File index.html (Zero-Build)</h3>
                <p>
                  This project uses <code>vite-plugin-singlefile</code>. When built, all JavaScript, CSS, SVGs, and fonts are compiled
                  directly into a <strong>single standalone `index.html` file</strong>.
                </p>
                <p>
                  You can upload <code>dist/index.html</code> directly into any GitHub repository or <code>gh-pages</code> branch. In
                  GitHub Pages settings, select <strong>Deploy from a branch</strong>, choose <code>main</code> (/root), and hit
                  Save. No build steps needed on GitHub!
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => {
                      const htmlContent = document.documentElement.outerHTML;
                      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "index.html";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download Standalone index.html
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="yaml-bar">
                  <h3>Standalone configurator workflow example</h3>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() =>
                      copy(
                        `name: Deploy to GitHub Pages

on:
  push:
    branches: ["main", "master"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Build project
        run: npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: "./dist"

  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4`,
                        "gh-workflow"
                      )
                    }
                  >
                    {copied === "gh-workflow" ? "Copied" : "Copy Workflow YAML"}
                  </button>
                </div>
                <pre className="code">{`name: Deploy to GitHub Pages

on:
  push:
    branches: ["main", "master"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Build project
        run: npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: "./dist"

  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4`}</pre>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function clamp(value: string, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}
function clampHour(value: string): number {
  return clamp(value, 0, 23);
}

function PinField({ label, value, onChange }: { label: string; value: string; onChange: (next: string) => void }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {PINS.map((pin) => (
          <option key={pin}>{pin}</option>
        ))}
      </select>
    </label>
  );
}
