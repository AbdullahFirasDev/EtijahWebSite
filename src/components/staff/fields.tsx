"use client";

import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { Button, Field, Input, inputClass, Textarea } from "./ui";

const toLatinDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));

/** "2026-1-5", "2026/01/05", "20260105" → "2026-01-05" when it is a real calendar date; otherwise null. */
export function parseDateText(raw: string): string | null {
  const s = toLatinDigits(raw).trim();
  const m = /^(\d{4})[-/.\s]?(\d{1,2})[-/.\s]?(\d{1,2})$/.exec(s) ?? /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1) return null;
  return `${m[1]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Date field always written year first: YYYY-MM-DD (السنة-الشهر-اليوم), whatever the browser
 * language. Typing digits inserts the dashes; the calendar button opens the native picker.
 * Controlled (value + onChange) or, inside a GET form, uncontrolled (name + defaultValue).
 */
export function DateInput({
  value,
  defaultValue,
  onChange,
  name,
  id,
  min,
  max,
  disabled,
  className = "",
  inputClassName = "",
  ...rest
}: {
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (v: string | null) => void;
  name?: string;
  id?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
} & { [data: `data-${string}`]: string | boolean | undefined }) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState<string | null>(defaultValue ?? null);
  const current = controlled ? (value ?? null) : inner;
  const [text, setText] = useState(current ?? "");
  const [seen, setSeen] = useState(current);
  const [invalid, setInvalid] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  // An outside change (another field filled this date) replaces what is shown.
  if (current !== seen) {
    setSeen(current);
    setText(current ?? "");
    setInvalid(false);
  }

  const emit = (v: string | null) => {
    setSeen(v);
    if (!controlled) setInner(v);
    onChange?.(v);
  };

  return (
    <div className={`relative ${className}`} dir="ltr">
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        lang="en"
        dir="ltr"
        autoComplete="off"
        placeholder="YYYY-MM-DD"
        title="السنة-الشهر-اليوم"
        maxLength={10}
        disabled={disabled}
        value={text}
        {...rest}
        aria-invalid={invalid || rest["aria-invalid"] || undefined}
        className={`num pe-10 text-left tracking-wide ${invalid ? "border-danger" : ""} ${inputClassName}`}
        onChange={(e) => {
          let t = toLatinDigits(e.target.value).replace(/[/.\s]/g, "-").replace(/[^\d-]/g, "");
          const deleting = (e.nativeEvent as InputEvent).inputType?.startsWith("delete");
          if (!deleting && /^\d{5,8}$/.test(t)) t = `${t.slice(0, 4)}-${t.slice(4, 6)}${t.length > 6 ? `-${t.slice(6)}` : ""}`;
          if (!deleting && (/^\d{4}$/.test(t) || /^\d{4}-\d{2}$/.test(t))) t += "-";
          t = t.slice(0, 10);
          setText(t);
          setInvalid(false);
          if (t === "") emit(null);
          else if (/^\d{4}-\d{2}-\d{2}$/.test(t) && parseDateText(t)) emit(t);
        }}
        onBlur={() => {
          if (!text) return;
          const v = parseDateText(text);
          if (v) {
            setText(v);
            if (v !== current) emit(v);
          } else setInvalid(true);
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label="اختيار من التقويم"
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted hover:text-brand-700 disabled:opacity-50"
        onClick={() => {
          const el = picker.current;
          if (!el) return;
          try {
            el.showPicker();
          } catch {
            el.focus();
          }
        }}
      >
        <CalendarDays className="size-4" aria-hidden="true" />
      </button>
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        min={min}
        max={max}
        value={current ?? ""}
        onChange={(e) => {
          const v = e.target.value || null;
          setText(v ?? "");
          setInvalid(false);
          emit(v);
        }}
        className="pointer-events-none absolute right-0 bottom-0 h-px w-10 opacity-0"
      />
      {name ? <input type="hidden" name={name} value={current ?? ""} /> : null}
    </div>
  );
}

/** Arabic + English inputs side by side (Arabic RTL, English LTR). */
export function Bilingual({
  label,
  ar,
  en,
  onAr,
  onEn,
  multiline,
  rows = 3,
  required,
  hint,
  errorAr,
  maxLength,
  name,
}: {
  label: ReactNode;
  ar: string | null;
  en: string | null;
  onAr: (v: string) => void;
  onEn: (v: string) => void;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  hint?: ReactNode;
  errorAr?: string;
  maxLength?: number;
  name?: string;
}) {
  const id = useId();
  const Control = multiline ? Textarea : Input;
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <legend className="sr-only">{label}</legend>
      <Field label={<>{label} <span className="font-semibold text-muted">· عربي</span></>} required={required} error={errorAr} hint={hint} htmlFor={`${id}-ar`}>
        <Control id={`${id}-ar`} name={name ? `${name}_ar` : undefined} dir="rtl" value={ar ?? ""} maxLength={maxLength} rows={multiline ? rows : undefined} onChange={(e) => onAr(e.target.value)} aria-invalid={!!errorAr || undefined} />
      </Field>
      <Field label={<>{label} <span className="font-semibold text-muted">· English</span></>} htmlFor={`${id}-en`}>
        <Control id={`${id}-en`} name={name ? `${name}_en` : undefined} dir="ltr" lang="en" value={en ?? ""} maxLength={maxLength} rows={multiline ? rows : undefined} onChange={(e) => onEn(e.target.value)} className="text-left" />
      </Field>
    </fieldset>
  );
}

/** Editable list of short texts (inclusions, exclusions…). */
export function StringList({ label, value, onChange, placeholder, dir }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string; dir?: "rtl" | "ltr" }) {
  const id = useId();
  return (
    <div>
      <p id={id} className="mb-1.5 text-sm font-bold text-brand-950">
        {label}
      </p>
      <ul role="list" aria-labelledby={id} className="space-y-2">
        {value.map((item, i) => (
          <li key={i} className="flex gap-2">
            <input
              className={`${inputClass} h-10`}
              dir={dir}
              value={item}
              aria-label={`${label} ${i + 1}`}
              placeholder={placeholder}
              onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
            />
            <Button size="sm" variant="ghost" aria-label="حذف" onClick={() => onChange(value.filter((_, j) => j !== i))} className="h-10 shrink-0 text-danger">
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      <Button size="sm" variant="subtle" className="mt-2" onClick={() => onChange([...value, ""])}>
        <Plus className="size-4" aria-hidden="true" /> إضافة
      </Button>
    </div>
  );
}

/** Number input that keeps an integer state (empty → 0 or null). */
export function NumberInput({ value, onChange, min = 0, max, id, nullable, ...rest }: { value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; id?: string; nullable?: boolean; "aria-label"?: string; className?: string }) {
  return (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      lang="en"
      min={min}
      max={max}
      step={1}
      dir="ltr"
      value={value ?? ""}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") return onChange(nullable ? null : 0);
        const n = Math.trunc(Number(raw));
        if (Number.isFinite(n)) onChange(n);
      }}
      className={`num text-start ${rest.className ?? ""}`}
      aria-label={rest["aria-label"]}
    />
  );
}

/** Money input: edits a decimal string, reports minor units (× 100) or null. */
export function MoneyInput({ value, onChange, id, currency, ...rest }: { value: number | null; onChange: (v: number | null) => void; id?: string; currency?: string; "aria-label"?: string }) {
  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        lang="en"
        dir="ltr"
        defaultValue={value == null ? "" : String(value / 100)}
        onChange={(e) => {
          const raw = e.target.value.replace(/[,\s]/g, "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660));
          if (raw === "") return onChange(null);
          if (/^\d+(\.\d{0,2})?$/.test(raw)) onChange(Math.round(Number(raw) * 100));
        }}
        className={`num text-start ${currency ? "pe-14" : ""}`}
        aria-label={rest["aria-label"]}
      />
      {currency ? <span className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-xs font-bold text-muted">{currency}</span> : null}
    </div>
  );
}
