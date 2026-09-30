import { useCallback, useState, type ReactNode } from "react";
import { clampNumber, type Config } from "./types";
import { cn } from "./utils/cn";

/** Shared copy-to-clipboard with a textarea fallback for older browsers. */
export async function copyText(text: string): Promise<boolean> {
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

/** Copy button with an aria-live confirmation instead of a title tooltip. */
export function CopyButton({
  text,
  id,
  label,
  copiedLabel = "Copied",
  className,
  onCopied,
}: {
  text: string;
  id: string;
  label: string;
  copiedLabel?: string;
  className?: string;
  onCopied?: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    if (!(await copyText(text))) return;
    setCopied(true);
    onCopied?.(id);
    window.setTimeout(() => setCopied(false), 1600);
  }, [text, id, onCopied]);
  return (
    <button type="button" className={cn("btn", className ?? "primary")} onClick={copy}>
      <span role="status" aria-live="polite">
        {copied ? copiedLabel : label}
      </span>
    </button>
  );
}

export function Toggle({
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

export function Slider({
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

export function Segmented<T extends string>({
  label,
  value,
  options,
  labels,
  hint,
  onChange,
}: {
  label?: string;
  value: T;
  options: readonly T[];
  /** Reader-facing wording per option; the value stays the config string. */
  labels?: Partial<Record<T, string>>;
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
            {labels?.[option] ?? option}
          </button>
        ))}
      </div>
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function NumberField({
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

export function PinField({ label, value, onChange }: { label: string; value: string; onChange: (next: string) => void }) {
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

const PINS = ["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8"];

export type Patch = <K extends keyof Config>(key: K, value: Config[K]) => void;

/** Section shell: anchored, labelled, hazard-ruled. */
export function Section({
  id,
  title,
  lead,
  children,
  className,
}: {
  id: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("doc-section", className)} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      {lead ? <p className="section-lead">{lead}</p> : null}
      {children}
    </section>
  );
}
