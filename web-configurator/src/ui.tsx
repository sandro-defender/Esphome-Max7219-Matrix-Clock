import { useCallback, useId, useState, type ReactNode } from "react";
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
  disabled = false,
  getText,
}: {
  text: string;
  id: string;
  label: string;
  copiedLabel?: string;
  className?: string;
  onCopied?: (id: string) => void;
  disabled?: boolean;
  /** Installers reverify the newest release immediately before clipboard access. */
  getText?: () => Promise<string | null>;
}) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    const prepared = getText ? await getText() : text;
    if (prepared === null || !(await copyText(prepared))) return;
    setCopied(true);
    onCopied?.(id);
    window.setTimeout(() => setCopied(false), 1600);
  }, [text, id, onCopied, getText]);
  return (
    <button type="button" className={cn("btn", className ?? "primary")} onClick={copy} disabled={disabled}>
      <span role="status" aria-live="polite">
        {copied ? copiedLabel : label}
      </span>
    </button>
  );
}

/** Aligned, explicitly labelled field used by every firmware widget. */
export function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="field setting-row">
    <label className="field-label" htmlFor={id}>{label}</label>
    <div className="field-control">{children}</div>
  </div>;
}

export function Toggle({ label, hint, checked, onChange, disabled = false }: {
  label: string; hint?: string; checked: boolean; onChange: (next: boolean) => void; disabled?: boolean;
}) {
  return <label className="field setting-row toggle-row">
    <span className="field-label">{label}{hint ? <small>{hint}</small> : null}</span>
    <span className="checkbox-control">
      <input type="checkbox" aria-label={label} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span aria-hidden="true">{checked ? "On" : "Off"}</span>
    </span>
  </label>;
}

export function Slider({ label, value, min, max, step, unit, onChange, disabled = false }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string;
  onChange: (next: number) => void; disabled?: boolean;
}) {
  const id = useId();
  return <Field id={id} label={label + (unit ? ` (${unit})` : "")}>
    <div className="range-control">
      <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))} />
      <input type="number" aria-label={`${label} value`} min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(event) => onChange(clampNumber(Number(event.target.value), min, max))} />
    </div>
  </Field>;
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

export function NumberField({ label, value, min, max, step = 1, onChange, disabled = false }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (next: number) => void; disabled?: boolean;
}) {
  const id = useId();
  return <Field id={id} label={label}>
    <input id={id} type="number" min={min} max={max} step={step} value={value} disabled={disabled}
      onChange={(event) => onChange(clampNumber(Number(event.target.value), min, max))} />
  </Field>;
}

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
