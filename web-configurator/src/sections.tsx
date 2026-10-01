import type { Config, LedName } from "./types";
import { LEDS } from "./leds";
import { deviceSlug } from "./device";
import { fontSpec } from "./fontCatalog";
import { type Geometry } from "./render";
import { CopyButton, NumberField, type Patch, Section, Slider, Toggle } from "./ui";
import { entityId, entityMap, installCommand, sampleAction } from "./yaml";
import { FIRMWARE, PROJECT, limitsFor, type FirmwareSetting } from "./firmware";
export { PROJECT } from "./firmware";

/** One widget for every real firmware binding; labels/options/bounds are generated. */
function FirmwareField({ item, cfg, patch }: { item: FirmwareSetting; cfg: Config; patch: Patch }) {
  const value = cfg[item.key];
  if (item.input === "boolean") return <Toggle label={item.label} checked={Boolean(value)} onChange={(next) => patch(item.key, next)} />;
  const options = item.input === "pin" ? Object.keys(FIRMWARE.pinMappings[cfg.board] ?? {}) :
    item.key === "clockFont" ? FIRMWARE.fonts.filter((font) => font.id === "compact" || cfg.fonts.includes(font.id)).map((font) => font.id) : item.options;
  if (options) return <label className="field"><span className="field-label">{item.label}</span>
    <select value={String(value)} onChange={(event) => patch(item.key, typeof item.default === "number" ? Number(event.target.value) : event.target.value)}>
      {!options.map(String).includes(String(value)) ? <option value={String(value)}>Select a valid pin</option> : null}
      {options.map((option) => <option key={String(option)} value={String(option)}>{item.key === "clockFont" ? fontSpec(String(option)).label : String(option)}</option>)}
    </select></label>;
  if (typeof item.default === "number") {
    const range = limitsFor(item.key);
    return item.input === "range" ? <Slider label={item.label} value={Number(value)} {...range} unit={item.unit} onChange={(next) => patch(item.key, next)} /> :
      <NumberField label={item.label + (item.unit ? ` (${item.unit})` : "")} value={Number(value)} {...range} onChange={(next) => patch(item.key, next)} />;
  }
  return <label className="field"><span className="field-label">{item.label}</span>
    <input value={String(value)} maxLength={240} onChange={(event) => patch(item.key, event.target.value)} /></label>;
}

export function TuneSection({ cfg, patch, geo }: { cfg: Config; patch: Patch; geo: Geometry }) {
  const groups = [...new Set(FIRMWARE.settings.map((item) => item.group))];
  return <Section id="tune" title="Settings">
    <div className="tune-grid">{groups.map((group) => <fieldset className="control-group" key={group}>
      <legend>{group}</legend>{FIRMWARE.settings.filter((item) => item.group === group).map((item) =>
        <FirmwareField key={item.key} item={item} cfg={cfg} patch={patch} />)}
    </fieldset>)}</div>
    <fieldset className="control-group"><legend>Preview</legend>
      <label className="field"><span className="field-label">Message</span><input value={cfg.message} maxLength={FIRMWARE.renderer.messageMaxBytes} onChange={(event) => patch("message", event.target.value)} /></label>
      <label className="field"><span className="field-label">LED colour</span><select value={cfg.led} onChange={(event) => patch("led", event.target.value as LedName)}>
        {Object.entries(LEDS).map(([key, led]) => <option key={key} value={key}>{led.label}</option>)}
      </select></label>
      <Toggle label="Module boundaries" checked={cfg.showModuleBoundaries} onChange={(value) => patch("showModuleBoundaries", value)} />
    </fieldset>
    {!geo.valid ? <p className="warn" role="alert">Module count must divide evenly into rows.</p> : null}
  </Section>;
}

export function HardwareSection({ cfg, geo }: { cfg: Config; geo: Geometry }) {
  const softwareSpi = cfg.clkPin !== "D5" || (cfg.mosiPin !== "D7");
  return (
    <Section
      id="hardware"
      title="Hardware and Wiring"
      lead={<>The reference build uses {String(FIRMWARE.defaults.board)}, {String(FIRMWARE.defaults.chips)} modules and {String(FIRMWARE.defaults.rows)} row, with three data lines and shared 5 V power.</>}
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
              <td>{String(FIRMWARE.defaults.clkPin)} by default; D5 is the hardware SPI clock alternative</td>
            </tr>
            <tr>
              <td>Data</td>
              <td>DIN</td>
              <td>{cfg.mosiPin}</td>
              <td>{String(FIRMWARE.defaults.mosiPin)} by default; first module only — then OUT → IN down the chain</td>
            </tr>
            <tr>
              <td>Load / chip select</td>
              <td>CS</td>
              <td>{cfg.csPin}</td>
              <td>{String(FIRMWARE.defaults.csPin)} by default</td>
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
          <p>CLK and DIN sit on the hardware SPI pins (D5/D7), so ESPHome drives the chain over hardware SPI.</p>
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

export function InstallSection({ cfg, yaml, ready = false, releaseTag, getInstaller }: { cfg: Config; yaml: string; ready?: boolean; releaseTag?: string | null; getInstaller?: () => Promise<string | null> }) {
  const slug = deviceSlug(cfg.deviceName);
  return <Section id="install" title="Install YAML" lead={<>One file installs the complete modular firmware and only the fonts selected in Font Lab. Keep it beside your local secrets.yaml.</>}>
    <div className="panel"><h3>Install in five steps</h3><ol className="install-steps">
      <li>Adjust settings and fonts on Configure.</li>
      <li>Wait for the newest published release to be verified. Copy the installer below into <code>{slug}.yaml</code>.</li>
      <li>Keep these keys in your own <code>secrets.yaml</code>: {Object.values(FIRMWARE.secrets).map((key, index) => <span key={key}>{index ? ", " : ""}<code>{key}</code></span>)}. No credential is entered into, stored by, or sent from this page.</li>
      <li>Use ESPHome <strong>{FIRMWARE.esphomeVersion}</strong>. Run <code>esphome config {slug}.yaml</code> and require “Configuration is valid!”.</li>
      <li>Flash over USB once with <code>{installCommand(cfg)}</code>, adopt in Home Assistant, then use encrypted native OTA. ESP8266 may need a physical reset after the initial serial flash before OTA works.</li>
    </ol><CopyButton text={installCommand(cfg)} id="run" label="Copy install command" className="ghost" />
      <pre className="code">{installCommand(cfg)}</pre></div>
    <div className="panel"><h3>Current package contract</h3>
      <p>Published release: <strong>{releaseTag ?? "checking"}</strong>. All packages and font assets use that same immutable tag, never main. Downloads stay disabled while the release or matching source contract is unverified.</p>
      <div className="table-scroll"><table className="pin-table"><thead><tr><th>Substitution / entity</th><th>Current value</th><th>Configure group</th></tr></thead><tbody>
        {FIRMWARE.settings.map((item) => <tr key={item.key}><td>{item.target}</td><td>{String(cfg[item.key])}</td><td>{item.group}</td></tr>)}
      </tbody></table></div>
      <p>Preferences are first-boot defaults. Previously restored Home Assistant values take priority. After changing the compiled font subset, reselect Clock font once: ESPHome restores an option index, not its label. Compact 5×7 is always available.</p>
    </div>
    <div className="panel"><div className="yaml-bar"><h3>{slug}.yaml</h3><CopyButton text={yaml} id="yaml" label="Copy install YAML" disabled={!ready} getText={getInstaller} /></div>
      <pre className="code">{ready ? yaml : "Installer unavailable until a matching published release and valid hardware configuration are verified."}</pre></div>
  </Section>;
}

export function AssistantSection({ cfg }: { cfg: Config }) {
  const ids = entityMap(cfg);
  return <Section id="assistant" title="Home Assistant entities and actions" lead={<>The following reference is generated from the actual firmware packages. Example entity IDs use {ids.node}; Home Assistant may adjust duplicates.</>}>
    <div className="panel"><h3>Actions</h3><CopyButton text={sampleAction(cfg, cfg.message || "DOOR")} id="action" label="Copy message action" />
      <pre className="code">{sampleAction(cfg, cfg.message || "DOOR")}</pre>
      <div className="table-scroll"><table className="pin-table"><tbody>{FIRMWARE.actions.map((action) => <tr key={action.action}>
        <td><code>esphome.{ids.node}_{action.action}</code></td><td>{action.description}</td><td>{Object.entries(action.variables).map(([key, type]) => `${key}: ${type}`).join(", ")}</td>
      </tr>)}</tbody></table></div><p>A configured default duration of 0 persists until cleared; action durations at or below 0 select that default. Messages preserve spaces and ASCII case is uppercased, truncated at a valid UTF-8 boundary to {FIRMWARE.renderer.messageMaxBytes} bytes. Unsupported text uses the built-in fallback.</p></div>
    <div className="panel"><h3>Entity reference</h3><div className="table-scroll"><table className="pin-table"><thead><tr><th>Entity</th><th>Options / bounds</th><th>Package</th></tr></thead><tbody>
      {FIRMWARE.entities.map((entity, index) => <tr key={`${entity.domain}-${entity.id ?? entity.name}-${index}`}>
        <td><strong>{entity.name}</strong><br /><code>{entityId(cfg, entity.domain, entity.name)}</code></td>
        <td>{entity.id === "clock_font" ? ["compact", ...cfg.fonts].map((key) => fontSpec(key).option).join(", ") : entity.options?.join(", ") ??
          (entity.min_value !== undefined ? `${entity.min_value}–${entity.max_value}, step ${entity.step} ${entity.unit_of_measurement ?? ""}` : entity.domain)}
          {entity.entity_category ? ` · ${entity.entity_category}` : ""}{entity.disabled_by_default ? " · disabled by default" : ""}</td><td>{entity.package}</td>
      </tr>)}
    </tbody></table></div></div>
  </Section>;
}

export function FontReferenceSection() {
  return <Section id="font-reference" title="Fonts and preview behaviour">
    <div className="panel"><h3>Default and optional fonts</h3><p>The default pair is {FIRMWARE.defaultFonts.map((key) => fontSpec(key).label).join(" + ")}. All compatible extras may be selected together, without a cap. The built-in Compact 5×7 fallback needs no external font data.</p>
      <table className="pin-table"><tbody>{FIRMWARE.fonts.map((font) => <tr key={font.id}><td>{font.label}</td><td>{font.license}</td><td><a href={`${PROJECT.repo}/blob/${PROJECT.ref}/${font.source}`} target="_blank" rel="noreferrer">Source / licence</a></td></tr>)}</tbody></table></div>
    <div className="panel"><h3>How the display chooses a layout</h3><p>Full HH:MM:SS → HH:MM plus seconds bar → Compact 5×7. A glyph never wraps into the next chip. Free text falls back to Compact if the selected face lacks even one character; wide messages scroll or clip according to Message scroll.</p>
      <p>Digit animation slides only changed numeric cells upward in their own ink-height window. Unchanged digits and colons remain stationary. Duration and blank-row gap are real Home Assistant controls; setting duration to 0 or disabling Digit animation cancels any active slide. Browser reduced-motion preferences suppress preview animation only.</p>
      <p>The preview uses the exact FreeType monochrome glyphs, advances and bearings and the C++ built-in bitmap. It displays the logical front-facing buffer; wiring guides mark chain order. Per-chip rotation and flip reflect the selected driver transforms. Frozen preview time, message demo, colour and module boundaries are preview-only and do not enter installer YAML.</p></div>
    <div className="panel"><h3>Boot and secure OTA</h3><p>The installed project version appears briefly after boot, then the restored screen and power state return. OTA has higher priority: start, percentage/bar, 100% for one second and error/code screens are synchronously flushed while ESPHome blocks its normal loop. OTA overrides off, inversion and zero/night brightness without persisting changed preferences. Errors return to current settings after eight seconds. Never share secrets.yaml.</p></div>
  </Section>;
}

export function ReleaseNotesSection({ releaseTag }: { releaseTag?: string | null }) {
  return <Section id="release-notes" title="Firmware version and release notes">
    <div className="panel"><p>Newest published release: <strong>{releaseTag ?? "checking"}</strong>. Configurator firmware contract: <strong>{FIRMWARE.releaseVersion}</strong>; target: <strong>ESPHome {FIRMWARE.esphomeVersion}</strong>.</p>
      <pre className="release-notes">{FIRMWARE.releaseNotes}</pre><p className="meta">Source contract SHA-256: <code>{FIRMWARE.sourceHash}</code></p></div>
  </Section>;
}

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
      "The clock follows Home Assistant time and falls back to SNTP (--:-- means no time at all yet). Check that Home Assistant's time is correct, that the device is connected, and that the timezone substitution matches yours. The live preview uses your browser clock converted to the configured timezone.",
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
    term: "Could not find the pinned remote ref",
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
      lead={<>Symptoms first, fix second, in the order the hardware fails. Every entry maps to a control in Tune or an entity in Home Assistant.</>}
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
            <a href={`${PROJECT.repo}/tree/${PROJECT.ref}/packages`} target="_blank" rel="noreferrer">
              packages/
            </a>{" "}
            and{" "}
            <a href={`${PROJECT.repo}/tree/${PROJECT.ref}/web-configurator`} target="_blank" rel="noreferrer">
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
          on every push to <code>main</code>, compiles the firmware, publishes an immutable release first, then deploys the matching static bundle to GitHub Pages. Installer access fails closed on a source/version mismatch. To run it yourself, fork
          the repository and enable the same workflow — see{" "}
          <a href={`${PROJECT.repo}/tree/${PROJECT.ref}/web-configurator`} target="_blank" rel="noreferrer">
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
