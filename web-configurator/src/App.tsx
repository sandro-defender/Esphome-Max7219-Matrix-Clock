import { memo, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { LiveMark, LiveStage } from "./LiveStage";
import { PreviewControls } from "./PreviewControls";
import { FontLab } from "./FontLab";
import {
  AssistantSection,
  DocsSection,
  GallerySection,
  HardwareSection,
  InstallSection,
  PROJECT,
  TroubleshootingSection,
  TuneSection,
} from "./sections";
import { geometry, type Geometry } from "./render";
import type { Config } from "./types";
import { clearSavedConfig, loadConfig, sanitizeConfig, saveConfig, shareUrl } from "./storage";
import { CopyButton, copyText, type Patch } from "./ui";
import { usePinnedChrome } from "./usePinnedChrome";
import { usePreview } from "./usePreview";
import { buildYaml } from "./yaml";

const NAV: { id: string; label: string }[] = [
  { id: "preview", label: "Preview" },
  { id: "tune", label: "Tune" },
  { id: "font-lab", label: "Font Lab" },
  { id: "hardware", label: "Hardware" },
  { id: "install", label: "Install YAML" },
  { id: "assistant", label: "Home Assistant" },
  { id: "troubleshooting", label: "Troubleshooting" },
  { id: "gallery", label: "Gallery" },
  { id: "docs", label: "Docs" },
];

/**
 * Everything below the preview controls, memoised as one block. The preview
 * ticks 20 times a second, so this keeps the settings — including Font Lab's
 * glyph strips and the generated YAML — out of that work; they only re-render
 * when the configuration, the geometry or the YAML actually changes.
 */
const SettingsColumn = memo(function SettingsColumn({
  cfg,
  patch,
  setCfg,
  geo,
  yaml,
}: {
  cfg: Config;
  patch: Patch;
  setCfg: Dispatch<SetStateAction<Config>>;
  geo: Geometry;
  yaml: string;
}) {
  return (
    <>
      <TuneSection cfg={cfg} patch={patch} setCfg={setCfg} geo={geo} />
      <FontLab cfg={cfg} setCfg={setCfg} panelWidth={geo.width} panelHeight={Math.min(8, geo.height)} />
      <HardwareSection cfg={cfg} geo={geo} />
      <InstallSection cfg={cfg} yaml={yaml} />
      <AssistantSection cfg={cfg} />
      <TroubleshootingSection />
      <GallerySection />
      <DocsSection />
    </>
  );
});

export default function App() {
  const initial = useRef(loadConfig()).current;
  const [cfg, setCfg] = useState<Config>(initial.config);
  const [notice, setNotice] = useState<string | null>(initial.from === "link" ? "Settings loaded from the shared link." : null);
  const topbarRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // Where the pinned chrome ends, so the pinned matrix can sit exactly under it.
  usePinnedChrome(topbarRef, navRef);

  const { now, scene, sliding, reducedMotion, replay } = usePreview(cfg);

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
  const geo = useMemo(() => geometry(cfg.chips, cfg.rows), [cfg.chips, cfg.rows]);

  const share = useCallback(async () => {
    const url = shareUrl(cfg, window.location.href.split("#")[0]);
    window.history.replaceState(null, "", `#${url.split("#")[1]}`);
    if (await copyText(url)) {
      setNotice("Share link copied — it encodes these display settings only.");
      window.setTimeout(() => setNotice((current) => (current?.startsWith("Share link") ? null : current)), 4000);
    }
  }, [cfg]);

  const reset = () => {
    clearSavedConfig();
    setCfg(sanitizeConfig(null));
    setNotice("Settings reset to the factory preview.");
  };

  return (
    <div className="app">
      <a className="skip-link" href="#tune">
        Skip to the controls
      </a>
      <header className="topbar" ref={topbarRef}>
        <div className="brand">
          <LiveMark />
          <div>
            <div className="brand-name">
              Clock<span>lab</span>
            </div>
            <small>Wemos D1 Mini · MAX7219 · ESPHome {PROJECT.esphome}</small>
          </div>
        </div>
        <div className="top-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={share}
            title="Copy a link that reopens the configurator with these settings"
          >
            Share
          </button>
          <button type="button" className="btn ghost" onClick={reset} title="Forget the saved settings">
            Reset
          </button>
          <CopyButton text={yaml} id="top-yaml" label="Copy install YAML" copiedLabel="Copied" className="primary" />
        </div>
      </header>

      {notice ? (
        <div className="notice-bar">
          <p role="status">{notice}</p>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification">
            ×
          </button>
        </div>
      ) : null}

      <nav className="site-nav" aria-label="Page sections" ref={navRef}>
        <ul>
          {NAV.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`}>{item.label}</a>
            </li>
          ))}
        </ul>
      </nav>

      <main id="main" className="shell">
        <div className="stage-col">
          <LiveStage cfg={cfg} scene={scene} now={now} />
        </div>

        <div className="content-col">
          <PreviewControls
            cfg={cfg}
            scene={scene}
            sliding={sliding}
            reducedMotion={reducedMotion}
            onMessage={(value) => patch("message", value)}
            onPreviewTime={(value) => patch("previewTime", value)}
            onReplay={replay}
          />
          <SettingsColumn cfg={cfg} patch={patch} setCfg={setCfg} geo={geo} yaml={yaml} />
        </div>
      </main>

      <footer className="site-footer">
        <p>
          <strong>Clocklab</strong> — the web configurator for the{" "}
          <a href={PROJECT.repo} target="_blank" rel="noreferrer">
            ESPHome MAX7219 Matrix Clock
          </a>
          . Firmware target ESPHome {PROJECT.esphome}, release {PROJECT.ref}.
        </p>
        <p className="footer-safety">
          This page never asks for Wi-Fi passwords, API keys, OTA keys or web passwords. Generated installers reference
          your local <code>secrets.yaml</code> and nothing else leaves your browser.
        </p>
        <p className="footer-links">
          <a href={PROJECT.readme} target="_blank" rel="noreferrer">
            README
          </a>
          <a href={PROJECT.validation} target="_blank" rel="noreferrer">
            VALIDATION
          </a>
          <a href={PROJECT.roadmap} target="_blank" rel="noreferrer">
            ROADMAP
          </a>
          <a href={PROJECT.issues} target="_blank" rel="noreferrer">
            Issues
          </a>
        </p>
      </footer>
    </div>
  );
}
