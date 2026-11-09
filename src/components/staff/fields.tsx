"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Button, Field, Input, inputClass, Textarea } from "./ui";

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
