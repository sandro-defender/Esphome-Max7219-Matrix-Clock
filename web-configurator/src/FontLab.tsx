import { GlyphStrip } from "./GlyphStrip";
import { FONT_CATALOG, fitForPanel, fontSpec, previewFont, widthWarning } from "./fontCatalog";
import { DEFAULT_FONTS, EXTRA_FONTS, addExtraFontAndSelect, toggleExtraFont } from "./fontSelection";
import { GEORGIAN_DATE_FONT, styledPreviewFont, textCells } from "./fonts";
import type { Config, DigitStyle, LetterStyle, ScreenMode } from "./types";
import { cn } from "./utils/cn";
import { Section } from "./ui";

interface FontLabProps {
  cfg: Config;
  setCfg: (update: (current: Config) => Config) => void;
  panelWidth: number;
  panelHeight: number;
}

const DIGIT_STYLE_OPTIONS: readonly DigitStyle[] = ["Standard 0-9", "Custom big 0-9"];
const LETTER_STYLE_OPTIONS: readonly LetterStyle[] = ["English", "Georgian"];

/**
 * Bundled firmware font workbench. Every checkbox maps to a package file in
 * the generated installer and checking it immediately selects that face.
 */
export function FontLab({ cfg, setCfg, panelWidth, panelHeight }: FontLabProps) {
  const selected = fontSpec(cfg.clockFont);
  const baseClockFont = previewFont(cfg.clockFont);
  const selectedFont = styledPreviewFont(baseClockFont, cfg.clockDigitStyle, cfg.clockLetterStyle);
  const selectedFit = fitForPanel(selectedFont, panelWidth, panelHeight);
  const warning = widthWarning(selected.label, selectedFit, panelWidth);
  const availableFontIds = FONT_CATALOG.filter((item) => item.id === "compact" || cfg.fonts.includes(item.id));
  const charSets = selected.characterSets ?? {
    standardDigits: "0123456789",
    customBigDigits: "\uE000\uE001\uE002\uE003\uE004\uE005\uE006\uE007\uE008\uE009",
    englishUpper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    englishLower: "abcdefghijklmnopqrstuvwxyz",
    georgian: "აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ",
    punctuation: ":.-/%!?+",
  };

  const screenRows: {
    id: string;
    label: string;
    screenMode: ScreenMode;
    fontValue: string;
    onFont: (next: string) => void;
    digitValue: DigitStyle;
    onDigit: (next: DigitStyle) => void;
    letterValue: LetterStyle;
    onLetter: (next: LetterStyle) => void;
    sample: string;
    sampleCaption: string;
    preview: ReturnType<typeof styledPreviewFont>;
  }[] = [
    {
      id: "clock",
      label: "Clock screen",
      screenMode: "Clock",
      fontValue: cfg.clockFont,
      onFont: (next) => setCfg((current) => ({ ...current, clockFont: next })),
      digitValue: cfg.clockDigitStyle,
      onDigit: (next) => setCfg((current) => ({ ...current, clockDigitStyle: next })),
      letterValue: cfg.clockLetterStyle as LetterStyle,
      onLetter: (next) => setCfg((current) => ({ ...current, clockLetterStyle: next })),
      sample: "12:34:56",
      sampleCaption: "HH:MM:SS",
      preview: styledPreviewFont(previewFont(cfg.clockFont), cfg.clockDigitStyle, cfg.clockLetterStyle),
    },
    {
      id: "date",
      label: "Date screen",
      screenMode: "Date",
      fontValue: cfg.dateFont,
      onFont: (next) => setCfg((current) => ({ ...current, dateFont: next })),
      digitValue: cfg.dateDigitStyle,
      onDigit: (next) => setCfg((current) => ({ ...current, dateDigitStyle: next })),
      letterValue: cfg.dateLanguage as LetterStyle,
      onLetter: (next) => setCfg((current) => ({ ...current, dateLanguage: next })),
      sample: cfg.dateLanguage === "Georgian" ? "\x80\x81\x82 21.10" : "SUN 21.10",
      sampleCaption: cfg.dateLanguage === "Georgian" ? "კვი 21.10" : "SUN 21.10",
      preview: styledPreviewFont(
        cfg.dateFont === "compact" && cfg.dateLanguage === "Georgian" ? GEORGIAN_DATE_FONT : previewFont(cfg.dateFont),
        cfg.dateDigitStyle,
        cfg.dateLanguage,
      ),
    },
    {
      id: "temperature",
      label: "Temperature screen",
      screenMode: "Temperature",
      fontValue: cfg.tempFont,
      onFont: (next) => setCfg((current) => ({ ...current, tempFont: next })),
      digitValue: cfg.tempDigitStyle,
      onDigit: (next) => setCfg((current) => ({ ...current, tempDigitStyle: next })),
      letterValue: cfg.tempLetterStyle,
      onLetter: (next) => setCfg((current) => ({ ...current, tempLetterStyle: next })),
      sample: "23.5 C",
      sampleCaption: "23.5 C",
      preview: styledPreviewFont(previewFont(cfg.tempFont), cfg.tempDigitStyle, cfg.tempLetterStyle),
    },
    {
      id: "message",
      label: "Messages & Countdown",
      screenMode: "Message",
      fontValue: cfg.messageFont,
      onFont: (next) => setCfg((current) => ({ ...current, messageFont: next })),
      digitValue: cfg.messageDigitStyle,
      onDigit: (next) => setCfg((current) => ({ ...current, messageDigitStyle: next })),
      letterValue: cfg.messageLetterStyle,
      onLetter: (next) => setCfg((current) => ({ ...current, messageLetterStyle: next })),
      sample: cfg.messageLetterStyle === "Georgian" ? "გამარჯობა 09" : "HELLO 09",
      sampleCaption: cfg.messageLetterStyle === "Georgian" ? "გამარჯობა 09" : "HELLO 09",
      preview: styledPreviewFont(previewFont(cfg.messageFont), cfg.messageDigitStyle, cfg.messageLetterStyle),
    },
  ];

  const applyAllDigits = (style: DigitStyle) => {
    setCfg((current) => ({
      ...current,
      clockDigitStyle: style,
      dateDigitStyle: style,
      tempDigitStyle: style,
      messageDigitStyle: style,
    }));
  };

  const applyAllLetters = (style: LetterStyle) => {
    setCfg((current) => ({
      ...current,
      clockLetterStyle: style,
      dateLanguage: style,
      tempLetterStyle: style,
      messageLetterStyle: style,
    }));
  };

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
                    <em>{included ? "included · unified EN/GE + 0-9 + big 0-9" : "optional"}</em>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="font-grid">
          {availableFontIds.map((item) => {
            const itemFont = previewFont(item.id);
            const itemBigFont = styledPreviewFont(itemFont, "Custom big 0-9", "English");
            const itemFit = fitForPanel(itemBigFont, panelWidth, panelHeight);
            const active = cfg.clockFont === item.id;
            const itemWarning = widthWarning(item.label, itemFit, panelWidth);
            return (
              <button
                key={item.id}
                type="button"
                className={cn("font-card", active && "on")}
                aria-pressed={active}
                onClick={() =>
                  setCfg((current) => ({
                    ...current,
                    clockFont: item.id,
                    dateFont: item.id,
                    tempFont: item.id,
                    messageFont: item.id,
                  }))
                }
              >
                <span className="font-name">
                  {item.label}
                  {item.id === "compact" ? <em>always compiled</em> : DEFAULT_FONTS.includes(item.id) ? <em>default</em> : null}
                  {active ? <em className="font-selected">selected</em> : null}
                </span>
                <div className="font-card-strips">
                  <GlyphStrip font={itemBigFont} text="0123456789" scale={2} />
                  <GlyphStrip font={itemFont} text="ABC აბგ" scale={2} />
                </div>
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
        <p className="font-source">
          Want a different face? Draw one in the{" "}
          <a href="https://sandro-defender.github.io/Pixeel-font-editor/" target="_blank" rel="noreferrer">
            Pixeel font editor
          </a>{" "}
          and export a drop-in package for this clock.
        </p>
      </fieldset>

      <fieldset className="font-group font-group-screens" data-font-screens>
        <legend>Per-screen font, digit set &amp; letter set</legend>
        <div className="screen-quick-bar">
          <span className="meta">Apply across all 4 screens:</span>
          <div className="btn-row">
            <button type="button" className="btn ghost" onClick={() => applyAllDigits("Custom big 0-9")}>
              All Custom big 0-9
            </button>
            <button type="button" className="btn ghost" onClick={() => applyAllDigits("Standard 0-9")}>
              All Standard 0-9
            </button>
            <button type="button" className="btn ghost" onClick={() => applyAllLetters("English")}>
              All English
            </button>
            <button type="button" className="btn ghost" onClick={() => applyAllLetters("Georgian")}>
              All Georgian (ქართული)
            </button>
          </div>
        </div>

        <div className="screen-style-grid">
          {screenRows.map((row) => {
            const isCurrentScreen = cfg.screen === row.screenMode;
            return (
              <div
                key={row.id}
                className={cn("screen-style-card", isCurrentScreen && "active")}
                data-screen-font-row={row.id}
              >
                <div className="screen-style-head">
                  <div>
                    <strong>{row.label}</strong>
                    <span className="screen-style-badge">
                      {fontSpec(row.fontValue).label} · {row.digitValue} · {row.letterValue}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={cn("chip", isCurrentScreen && "on")}
                    onClick={() => setCfg((current) => ({ ...current, screen: row.screenMode }))}
                  >
                    {isCurrentScreen ? "Live on matrix" : "Show on matrix"}
                  </button>
                </div>

                <div className="glyph-bezel" title={`${row.label} sample: ${row.sampleCaption}`}>
                  <GlyphStrip font={row.preview} text={row.sample} scale={3} />
                  <span className="glyph-bezel-caption">{row.sampleCaption}</span>
                </div>

                <div className="screen-style-controls">
                  <label className="screen-style-field">
                    <span>Font</span>
                    <select
                      aria-label={`${row.label} font`}
                      value={row.fontValue}
                      onChange={(event) => row.onFont(event.target.value)}
                    >
                      {availableFontIds.map((item) => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="screen-style-field">
                    <span>Digit set</span>
                    <select
                      aria-label={`${row.label} digit set`}
                      value={row.digitValue}
                      onChange={(event) => row.onDigit(event.target.value as DigitStyle)}
                    >
                      {DIGIT_STYLE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </label>
                  <label className="screen-style-field">
                    <span>Letter set</span>
                    <select
                      aria-label={`${row.label} letter set`}
                      value={row.letterValue}
                      onChange={(event) => row.onLetter(event.target.value as LetterStyle)}
                    >
                      {LETTER_STYLE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="font-group font-group-charsets" data-font-charsets>
        <legend>Extracted character sets in {selected.label}</legend>
        <div className="charset-grid">
          <div className="charset-card" data-charset="customBigDigits">
            <div className="charset-head">
              <div>
                <strong>Custom big 0-9</strong>
                <span className="charset-range">PUA U+E000–U+E009 · 6×8 bold 2 px stroke</span>
              </div>
              <span className="charset-count">{textCells(charSets.customBigDigits).length} glyphs</span>
            </div>
            <div className="glyph-bezel">
              <GlyphStrip
                font={styledPreviewFont(baseClockFont, "Custom big 0-9", "English")}
                text="0123456789"
                scale={3}
              />
            </div>
            <code className="charset-specimen">0 1 2 3 4 5 6 7 8 9 (U+E000–U+E009)</code>
          </div>

          <div className="charset-card" data-charset="standardDigits">
            <div className="charset-head">
              <div>
                <strong>Standard 0-9</strong>
                <span className="charset-range">ASCII U+0030–U+0039 · 5×7 compact 1 px stroke</span>
              </div>
              <span className="charset-count">{textCells(charSets.standardDigits).length} glyphs</span>
            </div>
            <div className="glyph-bezel">
              <GlyphStrip
                font={styledPreviewFont(baseClockFont, "Standard 0-9", "English")}
                text={charSets.standardDigits}
                scale={3}
              />
            </div>
            <code className="charset-specimen">{charSets.standardDigits}</code>
          </div>

          <div className="charset-card" data-charset="englishUpper">
            <div className="charset-head">
              <div>
                <strong>English uppercase</strong>
                <span className="charset-range">ASCII U+0041–U+005A · A–Z</span>
              </div>
              <span className="charset-count">{textCells(charSets.englishUpper).length} glyphs</span>
            </div>
            <div className="glyph-bezel">
              <GlyphStrip font={baseClockFont} text={charSets.englishUpper} scale={2} />
            </div>
            <code className="charset-specimen">{charSets.englishUpper}</code>
          </div>

          {charSets.englishLower ? (
            <div className="charset-card" data-charset="englishLower">
              <div className="charset-head">
                <div>
                  <strong>English lowercase</strong>
                  <span className="charset-range">ASCII U+0061–U+007A · a–z</span>
                </div>
                <span className="charset-count">{textCells(charSets.englishLower).length} glyphs</span>
              </div>
              <div className="glyph-bezel">
                <GlyphStrip font={baseClockFont} text={charSets.englishLower} scale={2} />
              </div>
              <code className="charset-specimen">{charSets.englishLower}</code>
            </div>
          ) : null}

          <div className="charset-card charset-card-wide" data-charset="georgian">
            <div className="charset-head">
              <div>
                <strong>Georgian Mkhedruli</strong>
                <span className="charset-range">Unicode U+10D0–U+10F0 · ა–ჰ</span>
              </div>
              <span className="charset-count">{textCells(charSets.georgian).length} glyphs</span>
            </div>
            <div className="glyph-bezel">
              <GlyphStrip font={baseClockFont} text={charSets.georgian} scale={2} />
            </div>
            <code className="charset-specimen">{charSets.georgian}</code>
          </div>

          <div className="charset-card" data-charset="punctuation">
            <div className="charset-head">
              <div>
                <strong>Punctuation &amp; symbols</strong>
                <span className="charset-range">Clock colons, separators &amp; status symbols</span>
              </div>
              <span className="charset-count">{textCells(charSets.punctuation).length} glyphs</span>
            </div>
            <div className="glyph-bezel">
              <GlyphStrip font={baseClockFont} text={charSets.punctuation} scale={3} />
            </div>
            <code className="charset-specimen">{charSets.punctuation}</code>
          </div>
        </div>
      </fieldset>
    </Section>
  );
}
