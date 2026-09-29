import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiveMark, LiveStage } from "./LiveStage";
import { GlyphStrip } from "./GlyphStrip";
import { LEDS } from "./leds";
import { FONT_CATALOG, fitForPanel, fontSpec, previewFont } from "./fontCatalog";
import { deviceSlug } from "./device";
import { geometry } from "./render";
import { clearSavedConfig, loadConfig, saveConfig, shareUrl } from "./storage";
import {
  DEFAULT_CONFIG,
  LIMITS,
  PINS,
  SCREENS,
  clampNumber,
  type Alignment,
  type Config,
  type DateFormat,
  type HourFormat,
  type LedName,
  type MessageScroll,
  type ScreenMode,
  type SecondsMode,
  type Wiring,
} from "./types";
import { buildYaml, entityMap, installCommand, sampleAction } from "./yaml";
import { cn } from "./utils/cn";

const TABS = ["Tune", "Install YAML", "Assistant", "Wiring", "GitHub"] as const;
type Tab = (typeof TABS)[number];

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

const GITHUB_WORKFLOW = `name: Deploy to GitHub Pages

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
        uses: actions/deploy-pages@v4`;

const GIT_COMMANDS = (user: string, repo: string) =>
  [
    "git init",
    "git add .",
    'git commit -m "Deploy MAX7219 Clocklab to GitHub Pages"',
    "git branch -M main",
    `git remote add origin https://github.com/${user}/${repo}.git`,
    "git push -u origin main",
  ].join("\n");

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

function Segmented<T extends string>({
  label,
  value,
  options,
  hint,
  onChange,
}: {
  label?: string;
  value: T;
  options: readonly T[];
  hint?: string;
  onChange: (next: T) => void;
}) {
  return (
    <div className="field">
      {label ? <span className="field-label">{label}</span> : null}
      <div className="seg" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={cn(value === option && "on")}
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(clampNumber(Number(event.target.value), min, max))}
      />
    </label>
  );
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

export default function App() {
  const initial = useRef(loadConfig()).current;
  const [cfg, setCfg] = useState<Config>(initial.config);
  const [tab, setTab] = useState<Tab>("Tune");
  const [copied, setCopied] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(initial.from === "link" ? "Settings loaded from the shared link." : null);
  const [ghUser, setGhUser] = useState("my-user");
  const [ghRepo, setGhRepo] = useState("max7219-clock");

  useEffect(() => {
    saveConfig(cfg);
  }, [cfg]);

  // A shared link is adopted once: the settings are stored locally and the
  // fragment is dropped, so later edits are not overwritten on reload.
  useEffect(() => {
    if (initial.from !== "link" || typeof window === "undefined") return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, [initial.from]);

  const patch = useCallback(<K extends keyof Config>(key: K, value: Config[K]) => {
    setCfg((current) => ({ ...current, [key]: value }));
  }, []);

  const yaml = useMemo(() => buildYaml(cfg), [cfg]);
  const ids = useMemo(() => entityMap(cfg), [cfg]);
  const geo = useMemo(() => geometry(cfg.chips, cfg.rows), [cfg.chips, cfg.rows]);
  const lines = useMemo(() => yaml.split("\n").length, [yaml]);
  const action = useMemo(() => sampleAction(cfg, cfg.message || "DOOR", cfg.messageHold), [cfg]);
  const spec = fontSpec(cfg.clockFont);
  const font = previewFont(cfg.clockFont);
  const fit = useMemo(() => fitForPanel(font, geo.width, Math.min(8, geo.height)), [font, geo.width, geo.height]);
  const pinClash = new Set([cfg.clkPin, cfg.mosiPin, cfg.csPin]).size < 3;
  const bootPin = [cfg.clkPin, cfg.mosiPin, cfg.csPin].some((pin) => pin === "D3" || pin === "D4" || pin === "D8");
  const renames = deviceSlug(cfg.deviceName) !== "max7219-clock";

  const copy = useCallback(async (text: string, id: string) => {
    if (!(await copyText(text))) return;
    setCopied(id);
    window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 1600);
  }, []);

  const download = () => {
    const blob = new Blob([yaml], { type: "text/yaml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${deviceSlug(cfg.deviceName)}.yaml`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const share = async () => {
    const url = shareUrl(cfg, window.location.href.split("#")[0]);
    window.history.replaceState(null, "", `#${url.split("#")[1]}`);
    await copy(url, "share");
  };

  const reset = () => {
    clearSavedConfig();
    setCfg({ ...DEFAULT_CONFIG });
    setNotice("Settings reset to the factory preview.");
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
            <svg className="inline mr-1" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            GitHub
          </button>
          <button type="button" className="btn ghost" onClick={share} title="Copy a link that reopens the configurator with these settings">
            {copied === "share" ? "Link copied" : "Share"}
          </button>
          <button type="button" className="btn ghost" onClick={reset} title="Forget the saved settings">
            Reset
          </button>
          <button type="button" className="btn primary" onClick={() => copy(yaml, "yaml")}>
            {copied === "yaml" ? "Copied" : "Copy install YAML"}
          </button>
        </div>
      </header>

      <main className="shell">
        <LiveStage cfg={cfg} onMessage={(value) => patch("message", value)} onPreviewTime={(value) => patch("previewTime", value)} />

        <section className="deck">
          <div className="tabs" role="tablist" aria-label="Configurator sections">
            {TABS.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={tab === name}
                className={cn("tab", tab === name && "on")}
                onClick={() => setTab(name)}
              >
                {name}
              </button>
            ))}
          </div>

          {notice ? (
            <p className="toast" role="status">
              {notice}
              <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
                ×
              </button>
            </p>
          ) : null}

          {tab === "Tune" ? (
            <div className="stack">
              <div className="panel panel-font">
                <h3>Clock face</h3>
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
                <span className="field-label">Clock font</span>
                <div className="font-grid">
                  {FONT_CATALOG.map((item) => {
                    const itemFont = previewFont(item.id);
                    const itemFit = fitForPanel(itemFont, geo.width, Math.min(8, geo.height));
                    const active = cfg.clockFont === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={cn("font-card", active && "on")}
                        aria-pressed={active}
                        onClick={() => patch("clockFont", item.id)}
                      >
                        <span className="font-name">
                          {item.label}
                          {active ? <em>selected</em> : null}
                        </span>
                        <GlyphStrip font={itemFont} text="0123456789" scale={2} />
                        <span className="font-meta">
                          {item.firmwareId ? `size ${item.size}` : "built in"} · {itemFit.width}px · {itemFit.digitHeight}px tall
                        </span>
                        <span className="font-blurb">{item.blurb}</span>
                        {itemFit.dropsSeconds ? <span className="font-warn">too wide for {geo.width}px with seconds</span> : null}
                        {itemFit.usesBottomRow ? <span className="font-warn">uses the bottom row</span> : null}
                      </button>
                    );
                  })}
                </div>
                <p className="hint">
                  Every face is rasterised from the very file the firmware downloads, at the very size it compiles. Home
                  Assistant switches between them at runtime through the <code>Clock font</code> select.
                </p>
                <ul className="entity-list font-facts">
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
              </div>

              <div className="panel">
                <h3>Screen</h3>
                <label className="field">
                  <span className="field-label">Screen select</span>
                  <select value={cfg.screen} onChange={(event) => patch("screen", event.target.value as ScreenMode)}>
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
              </div>

              <div className="panel">
                <h3>Messages</h3>
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
                <p className="hint">
                  The preview keeps the message on the matrix for as long as the firmware would, then falls back to the
                  selected screen.
                </p>
              </div>

              <div className="panel">
                <h3>Light</h3>
                <Slider
                  label="Brightness"
                  value={cfg.brightness}
                  min={LIMITS.brightness.min}
                  max={LIMITS.brightness.max}
                  step={1}
                  onChange={(value) => patch("brightness", value)}
                />
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
                  Night runs from {cfg.nightStart}:00 until {cfg.nightEnd}:00. The preview dims while the local hour is inside
                  that window.
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
                  options={Object.keys(LEDS) as LedName[]}
                  onChange={(value) => patch("led", value)}
                />
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
                  <NumberField
                    label="Modules"
                    value={cfg.chips}
                    min={LIMITS.chips.min}
                    max={LIMITS.chips.max}
                    onChange={(value) => patch("chips", value)}
                  />
                  <NumberField
                    label="Rows"
                    value={cfg.rows}
                    min={LIMITS.rows.min}
                    max={LIMITS.rows.max}
                    onChange={(value) => patch("rows", value)}
                  />
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
                    D3, D4, and D8 are boot straps. D8 as CLK is the wiring most builds already have and it is fine if the
                    board starts. If it does not, move CLK to D5.
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
              </div>

              <div className="panel">
                <h3>Device</h3>
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
                  This is the complete one-file installer. Keep it beside your existing <code>secrets.yaml</code>. ESPHome
                  downloads the version-pinned modular firmware and the seven default fonts from this repository during
                  validation and compilation.
                </p>
                <ol>
                  <li>Download this YAML into your ESPHome configuration directory.</li>
                  <li>Confirm the six required entries exist in <code>secrets.yaml</code>.</li>
                  <li>Validate it with <code>esphome config {deviceSlug(cfg.deviceName)}.yaml</code>.</li>
                  <li>Flash over USB first, then use encrypted OTA once the node is adopted.</li>
                </ol>
                <div className="action-bar">
                  <span className="meta">Install command</span>
                  <button type="button" className="btn primary" onClick={() => copy(installCommand(cfg), "run")}>
                    {copied === "run" ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="code">{installCommand(cfg)}</pre>
                {renames ? (
                  <p className="warn">
                    The device name is <code>{deviceSlug(cfg.deviceName)}</code>. ESPHome treats that as a new node unless you
                    set it back to max7219-clock.
                  </p>
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
                  <code>{ids.showAction}</code> displays text for the requested duration. A duration of zero keeps the message
                  until it is cleared.
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
                  Confirm the generated entity IDs in Home Assistant after installation; it may adjust them when a device with
                  the same name already exists.
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
                  Seconds <code>{ids.seconds}</code>
                </li>
                <li>
                  Date format <code>{ids.dateFormat}</code>
                </li>
                <li>
                  Message scrolling <code>{ids.scroll}</code>
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
                  <figcaption>Six modules in one row are 48×8, the full-size HH:MM:SS layout.</figcaption>
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
                  next. The numbers on the preview are that chain order.
                </p>
                <p>
                  D5 is hardware SPI clock and D7 is hardware MOSI. This file uses {cfg.clkPin} and {cfg.mosiPin}, so ESPHome
                  uses software SPI. Leave the wires if the clock already runs.
                </p>
              </div>
              <div className="panel">
                <h3>Test patterns the firmware still has</h3>
                <p>
                  <strong>Module grid test</strong> draws a box and one pixel in every 8×8. <strong>Pixel checkerboard</strong>{" "}
                  proves every LED. If a row is mirrored, try snake versus zigzag, then rotate chip, then flip X, then reverse
                  the module order — one change at a time.
                </p>
                <p>
                  Logical size now: {geo.valid ? `${geo.width}×${geo.height}` : "invalid"}. {cfg.chips} modules in{" "}
                  {cfg.rows} row{cfg.rows === 1 ? "" : "s"}, wired {cfg.wiring}.
                </p>
                <p>
                  At {geo.width} px the current font needs {fit.width} px for HH:MM:SS
                  {fit.dropsSeconds ? ", so the firmware shows HH:MM and the seconds become a bar." : "."}
                </p>
              </div>
            </div>
          ) : null}

          {tab === "GitHub" ? (
            <div className="stack">
              <div className="panel panel-github">
                <div className="yaml-bar">
                  <h3>Run on GitHub Pages</h3>
                  <span className="seg-tag tag-ok">✓ GitHub Pages ready</span>
                </div>
                <p style={{ marginTop: 8 }}>
                  This web app is 100% client-side React + Vite. It needs no server backend and runs directly on GitHub Pages.
                </p>

                <div className="two" style={{ marginTop: 12 }}>
                  <label className="field" style={{ margin: 0 }}>
                    <span className="field-label">GitHub username / org</span>
                    <input
                      type="text"
                      spellCheck={false}
                      value={ghUser}
                      placeholder="e.g. your-username"
                      onChange={(e) => setGhUser(e.target.value.trim().toLowerCase())}
                    />
                  </label>
                  <label className="field" style={{ margin: 0 }}>
                    <span className="field-label">Repository name</span>
                    <input
                      type="text"
                      spellCheck={false}
                      value={ghRepo}
                      placeholder="e.g. max7219-clock"
                      onChange={(e) => setGhRepo(e.target.value.trim().toLowerCase())}
                    />
                  </label>
                </div>

                <div className="url-box">
                  <div>
                    <span className="url-label">Your live GitHub Pages URL</span>
                    <strong>
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
                    <a href={`https://${ghUser || "username"}.github.io/${ghRepo || "repo"}/`} target="_blank" rel="noreferrer" className="btn ghost">
                      Open ↗
                    </a>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3>Option 1: push the repository with GitHub Actions (recommended)</h3>
                <p>
                  This repository includes <code>.github/workflows/deploy-configurator.yml</code>. It tests, type-checks,
                  builds, and deploys the app from <code>web-configurator/</code> whenever that directory changes on main.
                </p>
                <ol>
                  <li>Create a repository on GitHub named <code>{ghRepo || "max7219-clock"}</code>.</li>
                  <li>Run these commands in your project terminal:</li>
                </ol>
                <div className="action-bar" style={{ marginTop: 10 }}>
                  <span className="meta">Terminal commands (customized for your repo)</span>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => copy(GIT_COMMANDS(ghUser || "your-username", ghRepo || "max7219-clock"), "git-cmds")}
                  >
                    {copied === "git-cmds" ? "Copied" : "Copy Git commands"}
                  </button>
                </div>
                <pre className="code">{GIT_COMMANDS(ghUser || "your-username", ghRepo || "max7219-clock")}</pre>
                <ol start={3} style={{ marginTop: 10 }}>
                  <li>
                    In your GitHub repo: go to <strong>Settings</strong> → <strong>Pages</strong>.
                  </li>
                  <li>
                    Under <strong>Build and deployment</strong> → <strong>Source</strong>, select <strong>GitHub Actions</strong>.
                    Keep it there: switching back to <strong>Deploy from a branch</strong> makes GitHub serve the repository root
                    (README.md) instead of the configurator.
                  </li>
                  <li>
                    The workflow runs immediately and your site is live at <code>https://{ghUser || "username"}.github.io/{ghRepo || "repo"}/</code>.
                  </li>
                </ol>
              </div>

              <div className="card">
                <h3>Option 2: standalone single-file index.html</h3>
                <p>
                  The production build uses <code>vite-plugin-singlefile</code>, so all JavaScript and CSS are compiled into a
                  single <code>index.html</code>.
                </p>
                <p>
                  The three wiring photos stay separate files under <code>dist/images/</code>, so upload the whole{" "}
                  <code>dist</code> folder, or drop the photos into an <code>images/</code> folder next to the file if you host
                  it yourself.
                </p>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    const html = "<!doctype html>\n" + document.documentElement.outerHTML;
                    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "index.html";
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download standalone index.html
                </button>
              </div>

              <div className="card">
                <div className="yaml-bar">
                  <h3>Standalone workflow example</h3>
                  <button type="button" className="btn primary" onClick={() => copy(GITHUB_WORKFLOW, "gh-workflow")}>
                    {copied === "gh-workflow" ? "Copied" : "Copy workflow YAML"}
                  </button>
                </div>
                <pre className="code">{GITHUB_WORKFLOW}</pre>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
