"use client";

import { CircleAlert, CircleCheck, Send } from "lucide-react";
import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { WhatsAppIcon } from "@/components/ui/icons";
import { whatsappUrl, type ServiceId } from "@/content/site";
import type { Dictionary } from "@/content/types";

type Field = "name" | "phone" | "service" | "destination" | "date" | "travelers" | "message";
type Values = Record<Field, string>;
type Errors = Partial<Record<Field, string>>;

const EMPTY: Values = { name: "", phone: "", service: "", destination: "", date: "", travelers: "", message: "" };
const MESSAGE_MAX = 600;
const FIELD_ORDER: Field[] = ["name", "phone", "service", "destination", "date", "travelers", "message"];

/** Today as YYYY-MM-DD in the visitor's local time zone. */
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function validate(values: Values, dict: Dictionary): Errors {
  const e = dict.contact.form.errors;
  const errors: Errors = {};
  const name = values.name.trim();
  if (!name) errors.name = e.nameRequired;
  else if (name.length < 2) errors.name = e.nameShort;

  const phone = values.phone.trim();
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    if (!/^[+\d\s\-().]+$/.test(phone) || digits.length < 7 || digits.length > 15) errors.phone = e.phoneInvalid;
  }

  if (!dict.services.items.some((s) => s.id === values.service)) errors.service = e.serviceRequired;

  if (values.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date) || Number.isNaN(Date.parse(values.date))) errors.date = e.dateInvalid;
    else if (values.date < todayISO()) errors.date = e.datePast;
  }

  if (values.travelers) {
    const n = Number(values.travelers);
    if (!Number.isInteger(n) || n < 1 || n > 50) errors.travelers = e.travelersInvalid;
  }

  if (values.message.length > MESSAGE_MAX) errors.message = e.messageLong;
  return errors;
}

function composeMessage(values: Values, dict: Dictionary) {
  const t = dict.contact.form.template;
  const service = dict.services.items.find((s) => s.id === (values.service as ServiceId))?.title ?? values.service;
  const lines = [t.greeting, "", `• ${t.name}: ${values.name.trim()}`, `• ${t.service}: ${service}`];
  if (values.phone.trim()) lines.push(`• ${t.phone}: ${values.phone.trim()}`);
  if (values.destination.trim()) lines.push(`• ${t.destination}: ${values.destination.trim()}`);
  if (values.date) lines.push(`• ${t.date}: ${values.date}`);
  if (values.travelers) lines.push(`• ${t.travelers}: ${values.travelers}`);
  if (values.message.trim()) lines.push("", `${t.message}:`, values.message.trim());
  return lines.join("\n");
}

const inputBase =
  "w-full rounded-xl border bg-white px-4 text-base text-ink placeholder:text-muted/60 transition-[border-color,box-shadow] duration-200 outline-none " +
  "focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

export function BookingForm({ dict }: { dict: Dictionary }) {
  const f = dict.contact.form;
  const uid = useId();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [attempted, setAttempted] = useState(false);
  const [minDate, setMinDate] = useState<string>();
  const [sentUrl, setSentUrl] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  // Set on the client only, so server and client markup match.
  useEffect(() => setMinDate(todayISO()), []);

  const id = (field: Field) => `${uid}-${field}`;

  const onChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const next = { ...values, [event.target.name]: event.target.value } as Values;
    setValues(next);
    if (attempted) setErrors(validate(next, dict));
  };

  const onBlur = (field: Field) => {
    if (!values[field]) return;
    const fieldError = validate(values, dict)[field];
    setErrors((prev) => ({ ...prev, [field]: fieldError }));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttempted(true);
    const found = validate(values, dict);
    setErrors(found);
    const firstInvalid = FIELD_ORDER.find((field) => found[field]);
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    const url = whatsappUrl(composeMessage(values, dict));
    const win = window.open(url, "_blank");
    if (win) win.opener = null;
    else window.location.href = url; // Pop-up blocked: open in this tab instead.
    setSentUrl(url);
  };

  useEffect(() => {
    if (sentUrl) statusRef.current?.focus();
  }, [sentUrl]);

  const errorCount = Object.values(errors).filter(Boolean).length;

  const label = (field: Field, text: string, required = false) => (
    <label htmlFor={id(field)} className="mb-2 flex items-baseline gap-1.5 text-[0.95rem] font-bold text-brand-950">
      {text}
      {required ? (
        <span aria-hidden="true" className="text-accent-700">
          *
        </span>
      ) : (
        <span className="text-xs font-semibold text-muted">({f.optional})</span>
      )}
    </label>
  );

  const describedBy = (field: Field, extra?: string) => [errors[field] ? `${id(field)}-error` : "", extra ?? ""].filter(Boolean).join(" ") || undefined;

  const fieldClass = (field: Field) => `${inputBase} ${errors[field] ? "border-danger focus:border-danger focus:ring-danger/15" : "border-line hover:border-brand-200"}`;

  const errorText = (field: Field): ReactNode =>
    errors[field] ? (
      <p id={`${id(field)}-error`} className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-danger">
        <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
        {errors[field]}
      </p>
    ) : null;

  if (sentUrl) {
    return (
      <div ref={statusRef} tabIndex={-1} role="status" className="flex flex-col items-start gap-5 rounded-2xl bg-white p-7 shadow-soft sm:p-9">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <CircleCheck className="size-7" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-2xl font-extrabold text-brand-950">{f.successTitle}</h3>
          <p className="mt-3 max-w-lg leading-[1.95] text-muted">{f.successText}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={sentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-accent-500 px-6 font-bold text-brand-950 transition-colors hover:bg-accent-400"
          >
            <WhatsAppIcon className="size-5" />
            {f.successRetry}
            <span className="sr-only">{dict.general.opensInNewTab}</span>
          </a>
          <button
            type="button"
            onClick={() => setSentUrl(null)}
            className="inline-flex h-12 items-center rounded-full border border-brand-200 px-6 font-bold text-brand-700 transition-colors hover:border-brand-600 hover:bg-brand-50"
          >
            {f.newRequest}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} aria-describedby={`${uid}-privacy`} className="grid gap-5 sm:grid-cols-2">
      {attempted && errorCount > 0 ? (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-danger/25 bg-accent-50 p-4 text-sm font-semibold text-danger sm:col-span-2">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          {f.errors.summary}
        </div>
      ) : null}

      <div>
        {label("name", f.fields.name, true)}
        <input
          id={id("name")}
          name="name"
          type="text"
          autoComplete="name"
          required
          maxLength={80}
          value={values.name}
          onChange={onChange}
          onBlur={() => onBlur("name")}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={describedBy("name")}
          className={`${fieldClass("name")} h-12`}
        />
        {errorText("name")}
      </div>

      <div>
        {label("phone", f.fields.phone)}
        <input
          id={id("phone")}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          maxLength={20}
          value={values.phone}
          onChange={onChange}
          onBlur={() => onBlur("phone")}
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={describedBy("phone", `${id("phone")}-hint`)}
          className={`${fieldClass("phone")} num h-12 rtl:text-right`}
        />
        <p id={`${id("phone")}-hint`} className="mt-1.5 text-xs text-muted">
          {f.fields.phoneHint}
        </p>
        {errorText("phone")}
      </div>

      <div>
        {label("service", f.fields.service, true)}
        <select
          id={id("service")}
          name="service"
          required
          value={values.service}
          onChange={onChange}
          onBlur={() => onBlur("service")}
          aria-invalid={Boolean(errors.service)}
          aria-describedby={describedBy("service")}
          className={`${fieldClass("service")} h-12 cursor-pointer ${values.service ? "" : "text-muted"}`}
        >
          <option value="" disabled>
            {f.fields.servicePlaceholder}
          </option>
          {dict.services.items.map((s) => (
            <option key={s.id} value={s.id} className="text-ink">
              {s.title}
            </option>
          ))}
        </select>
        {errorText("service")}
      </div>

      <div>
        {label("destination", f.fields.destination)}
        <input
          id={id("destination")}
          name="destination"
          type="text"
          maxLength={80}
          placeholder={f.fields.destinationPlaceholder}
          value={values.destination}
          onChange={onChange}
          className={`${fieldClass("destination")} h-12`}
        />
      </div>

      <div>
        {label("date", f.fields.date)}
        {/* LTR keeps the browser's date mask (dd/mm/yyyy) readable inside the RTL layout. */}
        <input
          id={id("date")}
          name="date"
          type="date"
          dir="ltr"
          min={minDate}
          value={values.date}
          onChange={onChange}
          onBlur={() => onBlur("date")}
          aria-invalid={Boolean(errors.date)}
          aria-describedby={describedBy("date")}
          className={`${fieldClass("date")} num h-12 rtl:text-right`}
        />
        {errorText("date")}
      </div>

      <div>
        {label("travelers", f.fields.travelers)}
        <input
          id={id("travelers")}
          name="travelers"
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          step={1}
          value={values.travelers}
          onChange={onChange}
          onBlur={() => onBlur("travelers")}
          aria-invalid={Boolean(errors.travelers)}
          aria-describedby={describedBy("travelers")}
          className={`${fieldClass("travelers")} num h-12`}
        />
        {errorText("travelers")}
      </div>

      <div className="sm:col-span-2">
        {label("message", f.fields.message)}
        <textarea
          id={id("message")}
          name="message"
          rows={4}
          maxLength={MESSAGE_MAX + 50}
          placeholder={f.fields.messagePlaceholder}
          value={values.message}
          onChange={onChange}
          onBlur={() => onBlur("message")}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={describedBy("message", `${id("message")}-count`)}
          className={`${fieldClass("message")} resize-y py-3 leading-[1.8]`}
        />
        <div className="mt-1.5 flex items-start justify-between gap-4">
          <div>{errorText("message")}</div>
          <p id={`${id("message")}-count`} className={`num shrink-0 text-xs ${values.message.length > MESSAGE_MAX ? "text-danger" : "text-muted"}`}>
            {values.message.length}/{MESSAGE_MAX}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:col-span-2">
        <button
          type="submit"
          className="group inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-accent-500 px-5 text-base font-bold whitespace-nowrap sm:px-8 sm:text-[1.05rem] text-brand-950 transition-[background-color,box-shadow,transform] duration-300 hover:bg-accent-400 hover:shadow-glow active:scale-[0.98] sm:w-fit"
        >
          <WhatsAppIcon className="size-5" />
          {f.submit}
          <Send className="size-4 transition-transform duration-300 ltr:group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
        </button>
        <p id={`${uid}-privacy`} className="text-sm leading-[1.85] text-muted">
          {f.privacy}
        </p>
      </div>
    </form>
  );
}
