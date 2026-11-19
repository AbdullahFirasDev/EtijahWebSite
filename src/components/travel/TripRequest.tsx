"use client";

import { BedDouble, CalendarDays, Check, CircleAlert, Copy, Minus, Pencil, Plus, Send, Star, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { WhatsAppIcon } from "@/components/ui/icons";
import { whatsappUrl, type Locale } from "@/content/site";
import { travel } from "@/content/travel";
import { AIRPORTS } from "@/lib/airports";
import { countryName } from "@/lib/countries";
import { addDays, formatDay, todayDay } from "@/lib/dates";
import { CURRENCIES, type CurrencyCode } from "@/lib/money";
import { mediaSrc, type MediaRef } from "@/lib/media";
import { DIAL_CODES, formatPhone, toE164 } from "@/lib/phone";
import { lockScroll } from "@/lib/scroll";
import { ROOM_TYPE_LABELS, ROOM_TYPES, type RoomType } from "@/lib/travel-labels";
import { submitTripRequestAction } from "@/server/actions/leads";

export interface RequestDeparture {
  id: number;
  label: string;
  sub: string;
  seatsLeft: number;
  bookable: boolean;
  seatsText: string;
}

export interface RequestHotel {
  id: string;
  label: string;
  sub: string;
  stars: number | null;
  price: string | null;
}

export interface RequestProgram {
  id: number;
  title: string;
  type: "fixed" | "custom";
  cover: MediaRef | null;
  departures: RequestDeparture[];
  hotels: RequestHotel[];
  countries: { code: string; name: string }[];
  services: string[];
  currency: string;
}

interface OpenOptions {
  departureId?: number;
  hotelOptionId?: string;
}

const Ctx = createContext<{ open: (opts?: OpenOptions) => void } | null>(null);
export const useTripRequest = () => useContext(Ctx);

/** Button that opens the request dialog (optionally with a departure or a hotel preselected). */
export function RequestButton({ children, className, departureId, hotelOptionId, disabled }: { children: ReactNode; className?: string; departureId?: number; hotelOptionId?: string; disabled?: boolean }) {
  const ctx = useTripRequest();
  return (
    <button type="button" className={className} disabled={disabled} onClick={() => ctx?.open({ departureId, hotelOptionId })} aria-haspopup="dialog" data-hotel-option={hotelOptionId}>
      {children}
    </button>
  );
}

type Step = 0 | 1 | 2 | 3;

interface FormState {
  departureId: number | null;
  hotelOptionId: string | null;
  date: string;
  dateTo: string;
  flexible: boolean;
  countries: string[];
  places: string;
  days: number | null;
  nights: number | null;
  airport: string;
  stars: number | null;
  budget: string;
  budgetCurrency: string;
  airline: string;
  services: string[];
  activities: string;
  adults: number;
  children: number;
  infants: number;
  rooms: number;
  roomType: RoomType;
  name: string;
  dial: string;
  phone: string;
  email: string;
  notes: string;
  website: string;
}

function Counter({ label, hint, value, min, max, onChange, t }: { label: string; hint: string; value: number; min: number; max: number; onChange: (v: number) => void; t: { increase: string; decrease: string } }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div>
        <p id={id} className="font-bold text-brand-950">
          {label}
        </p>
        {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      </div>
      <div className="flex items-center gap-3" role="group" aria-labelledby={id}>
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`${t.decrease}: ${label}`} className="grid size-10 place-items-center rounded-full border border-line text-brand-900 transition-colors hover:border-brand-500 hover:bg-brand-50 disabled:opacity-35">
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <output aria-live="polite" className="num w-6 text-center text-lg font-black text-brand-950">
          {value}
        </output>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`${t.increase}: ${label}`} className="grid size-10 place-items-center rounded-full border border-line text-brand-900 transition-colors hover:border-brand-500 hover:bg-brand-50 disabled:opacity-35">
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

const field =
  "h-12 w-full rounded-2xl border border-line bg-white px-4 text-base text-ink outline-none transition-[border-color,box-shadow] placeholder:text-muted/60 hover:border-brand-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 aria-invalid:border-danger";
const chip = (on: boolean) => `cursor-pointer rounded-full border px-4 py-2 text-sm font-bold transition-colors ${on ? "border-brand-600 bg-brand-600 text-white" : "border-line text-brand-900 hover:border-brand-300"}`;

export function TripRequestProvider({ program, locale, initialDeparture, children }: { program: RequestProgram; locale: Locale; initialDeparture?: number | null; children: ReactNode }) {
  const t = travel[locale].request;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const openedAt = useRef(0);
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isCustom = program.type === "custom";
  const firstBookable = program.departures.find((d) => d.bookable)?.id ?? null;
  const [f, setF] = useState<FormState>({
    departureId: initialDeparture && program.departures.some((d) => d.id === initialDeparture && d.bookable) ? initialDeparture : firstBookable,
    hotelOptionId: null,
    date: "",
    dateTo: "",
    flexible: false,
    countries: program.countries.map((c) => c.code).slice(0, 1),
    places: "",
    days: null,
    nights: null,
    airport: locale === "ar" ? AIRPORTS[0].name_ar : AIRPORTS[0].name_en,
    stars: null,
    budget: "",
    budgetCurrency: program.currency,
    airline: "",
    services: [],
    activities: "",
    adults: 2,
    children: 0,
    infants: 0,
    rooms: 1,
    roomType: "double",
    name: "",
    dial: "964",
    phone: "",
    email: "",
    notes: "",
    website: "",
  });
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const hasDepartures = !isCustom && program.departures.length > 0;
  const departure = program.departures.find((d) => d.id === f.departureId) ?? null;
  const hotel = program.hotels.find((h) => h.id === f.hotelOptionId) ?? null;
  const minDate = useMemo(() => addDays(todayDay(), 1), []);

  const open = useCallback(
    ({ departureId, hotelOptionId }: OpenOptions = {}) => {
      if (departureId && program.departures.some((d) => d.id === departureId && d.bookable)) setF((x) => ({ ...x, departureId }));
      if (hotelOptionId && program.hotels.some((h) => h.id === hotelOptionId)) setF((x) => ({ ...x, hotelOptionId }));
      if (ref) {
        setRef(null);
        setStep(0);
      }
      openedAt.current = Date.now();
      setIsOpen(true);
    },
    [program.departures, program.hotels, ref],
  );

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (isOpen && !d.open) {
      d.showModal();
      lockScroll(true);
    } else if (!isOpen && d.open) d.close();
    return () => {
      if (isOpen) lockScroll(false);
    };
  }, [isOpen]);

  // Move focus to the step heading when the step changes (screen readers announce it).
  useEffect(() => {
    if (isOpen) bodyRef.current?.querySelector<HTMLElement>("[data-step-heading]")?.focus();
  }, [step, isOpen]);

  const validate = (s: Step) => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (s === 0) {
      if (f.adults < 1) e.adults = t.errors.adults;
      if (isCustom) {
        if (!f.countries.length) e.countries = t.errorsCountry;
        if (!f.flexible && f.date && f.date < minDate) e.date = t.errors.date;
        if (!f.flexible && f.dateTo && (f.dateTo < minDate || (f.date && f.dateTo < f.date))) e.dateTo = t.errors.date;
      } else if (hasDepartures) {
        if (!departure) e.departureId = t.errors.departure;
        else if (departure.seatsLeft < f.adults + f.children) e.departureId = t.errors.seats;
      } else if (!f.flexible && f.date && f.date < minDate) e.date = t.errors.date;
    }
    if (s === 1) {
      if (f.name.trim().replace(/\s+/g, " ").length < 3) e.name = t.errors.name;
      if (!toE164(f.dial, f.phone)) e.phone = t.errors.phone;
      if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = t.errors.email;
    }
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) bodyRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
    return !first;
  };

  const next = () => {
    if (validate(step)) setStep((s) => Math.min(2, s + 1) as Step);
  };

  const submit = async () => {
    if (!validate(0)) return setStep(0);
    if (!validate(1)) return setStep(1);
    setSending(true);
    setServerError(null);
    try {
      const useDeparture = hasDepartures ? f.departureId : null;
      const budget = Number(f.budget.replace(/[,\s]/g, "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)));
      const res = await submitTripRequestAction({
        locale,
        program_id: program.id,
        departure_id: useDeparture,
        hotel_option_id: isCustom ? null : f.hotelOptionId,
        preferred_date: isCustom || useDeparture || f.flexible || !f.date ? null : f.date,
        custom: isCustom
          ? {
              country_codes: f.countries,
              places: f.places || null,
              date_from: f.flexible ? null : f.date || null,
              date_to: f.flexible ? null : f.dateTo || null,
              flexible: f.flexible,
              days: f.days,
              nights: f.nights,
              departure_airport: f.airport || null,
              hotel_stars: f.stars,
              budget_amount: Number.isFinite(budget) && budget > 0 ? Math.round(budget * 100) : null,
              budget_currency: f.budgetCurrency,
              airline_pref: f.airline || null,
              services: f.services,
              activities: f.activities || null,
            }
          : null,
        adults: f.adults,
        children: f.children,
        infants: f.infants,
        rooms: f.rooms,
        room_type: f.roomType,
        full_name: f.name,
        dial_code: f.dial,
        phone: f.phone,
        email: f.email || null,
        notes: f.notes || null,
        website: f.website,
        elapsed_ms: Date.now() - openedAt.current,
      });
      if (res.ok) {
        setRef(res.data.ref);
        setStep(3);
      } else {
        setServerError(res.error);
        const field = Object.keys(res.fieldErrors ?? {})[0];
        if (["departure_id", "preferred_date", "hotel_option_id", "country_codes", "date_from"].includes(field)) setStep(0);
        else if (field === "full_name" || field === "phone" || field === "email") setStep(1);
      }
    } catch {
      setServerError(locale === "ar" ? "تعذّر الاتصال. تحقق من الإنترنت وحاول مجدداً." : "Connection failed. Check your internet and try again.");
    } finally {
      setSending(false);
    }
  };

  const dateText = isCustom
    ? f.flexible || (!f.date && !f.dateTo)
      ? t.flexibleDate
      : [f.date ? formatDay(f.date, locale) : "", f.dateTo ? formatDay(f.dateTo, locale) : ""].filter(Boolean).join(" → ")
    : departure
      ? departure.label
      : f.date && !f.flexible
        ? f.date
        : t.flexibleDate;
  const countriesText = f.countries.map((c) => program.countries.find((x) => x.code === c)?.name ?? countryName(c, locale)).join(locale === "ar" ? "، " : ", ");
  const travelersText = t.summaryTravelers(f.adults, f.children, f.infants);
  const waText = ref
    ? [t.waGreeting, `• ${t.waRef}: ${ref}`, `• ${t.waProgram}: ${program.title}`, `• ${t.waDate}: ${dateText}`, ...(hotel ? [`• ${t.hotel}: ${hotel.label}`] : []), `• ${t.waTravelers}: ${travelersText}`, `• ${t.waName}: ${f.name.trim()}`].join("\n")
    : "";

  const close = () => setIsOpen(false);
  const steps = isCustom ? t.customSteps : t.steps;

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      <dialog
        ref={dialogRef}
        onClose={() => {
          setIsOpen(false);
          lockScroll(false);
        }}
        aria-labelledby="trip-request-title"
        className="m-0 h-[100svh] max-h-none w-full max-w-none overflow-hidden bg-white p-0 text-ink backdrop:bg-brand-950/70 backdrop:backdrop-blur-sm sm:m-auto sm:h-auto sm:max-h-[min(92svh,52rem)] sm:w-[calc(100%-2rem)] sm:max-w-2xl sm:rounded-[1.75rem] sm:shadow-2xl"
      >
        {isOpen ? (
          <div className="flex h-full max-h-[inherit] flex-col">
            {/* Header */}
            <div className="relative shrink-0 overflow-hidden bg-brand-950 px-5 pt-5 pb-5 text-white sm:px-7">
              {program.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaSrc(program.cover, 960)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
              ) : null}
              <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-brand-950 via-brand-950/80 to-brand-950/40" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-accent-300">{isCustom ? t.customTitle : t.title}</p>
                  <h2 id="trip-request-title" className="mt-1 line-clamp-2 text-xl leading-[1.4] font-extrabold sm:text-2xl">
                    {program.title}
                  </h2>
                </div>
                <button type="button" onClick={close} aria-label={t.close} className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20">
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
              {step < 3 ? (
                <ol className="relative mt-5 grid grid-cols-3 gap-2" aria-label={t.stepOf(step + 1, 3)}>
                  {steps.map((label, i) => (
                    <li key={label} aria-current={i === step ? "step" : undefined} className="min-w-0">
                      <div className={`h-1.5 overflow-hidden rounded-full ${i < step ? "bg-accent-500" : "bg-white/20"}`}>
                        <div className={`h-full rounded-full bg-accent-500 transition-[width] duration-700 ease-out-expo ${i === step ? "w-1/2" : i < step ? "w-full" : "w-0"}`} />
                      </div>
                      <p className={`mt-2 flex items-center gap-1.5 truncate text-xs font-bold ${i <= step ? "text-white" : "text-white/50"}`}>
                        <span className={`num grid size-5 shrink-0 place-items-center rounded-full text-[0.7rem] ${i < step ? "bg-accent-500 text-brand-950" : i === step ? "bg-white text-brand-950" : "bg-white/15"}`}>
                          {i < step ? <Check className="size-3" aria-hidden="true" /> : i + 1}
                        </span>
                        <span className="truncate">{label}</span>
                      </p>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>

            {/* Body */}
            <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7" data-lenis-prevent>
              {serverError && step < 3 ? (
                <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-2xl border border-danger/20 bg-accent-50 p-4 text-sm font-bold text-danger">
                  <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" /> {serverError}
                </div>
              ) : null}

              {step === 0 ? (
                <div key="s0" className="grid gap-6 motion-safe:animate-[menu-in_0.5s_var(--ease-out-expo)_both]">
                  <h3 data-step-heading tabIndex={-1} className="text-lg font-extrabold text-brand-950 outline-none">
                    {steps[0]}
                  </h3>

                  {isCustom ? (
                    <>
                      <fieldset>
                        <legend className="mb-2.5 text-sm font-bold text-brand-950">
                          {t.countries} <span className="text-accent-700">*</span>
                        </legend>
                        <div className="flex flex-wrap gap-2" data-field="countries" tabIndex={-1}>
                          {program.countries.map((c) => (
                            <label key={c.code} className={chip(f.countries.includes(c.code))}>
                              <input type="checkbox" className="sr-only" checked={f.countries.includes(c.code)} onChange={() => set("countries", toggle(f.countries, c.code))} />
                              {c.name}
                            </label>
                          ))}
                        </div>
                        {errors.countries ? <p className="mt-2 text-sm font-bold text-danger">{errors.countries}</p> : null}
                      </fieldset>
                      <div>
                        <label htmlFor="req-places" className="mb-2 block text-sm font-bold text-brand-950">
                          {t.places} <span className="text-xs font-semibold text-muted">({t.optional})</span>
                        </label>
                        <input id="req-places" maxLength={200} placeholder={t.placesPh} value={f.places} onChange={(e) => set("places", e.target.value)} className={field} />
                      </div>
                      <fieldset>
                        <legend className="mb-2 text-sm font-bold text-brand-950">{t.period}</legend>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="text-xs font-bold text-muted">
                            {t.dateFrom}
                            <input id="req-date" data-field="date" type="date" dir="ltr" min={minDate} disabled={f.flexible} value={f.date} onChange={(e) => set("date", e.target.value)} aria-invalid={!!errors.date} className={`${field} num mt-1 rtl:text-right disabled:bg-mist`} />
                          </label>
                          <label className="text-xs font-bold text-muted">
                            {t.dateTo}
                            <input id="req-date-to" data-field="dateTo" type="date" dir="ltr" min={f.date || minDate} disabled={f.flexible} value={f.dateTo} onChange={(e) => set("dateTo", e.target.value)} aria-invalid={!!errors.dateTo} className={`${field} num mt-1 rtl:text-right disabled:bg-mist`} />
                          </label>
                        </div>
                        <label className="mt-2.5 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-muted">
                          <input type="checkbox" className="size-4 accent-brand-600" checked={f.flexible} onChange={(e) => set("flexible", e.target.checked)} />
                          {t.flexibleDate}
                        </label>
                        {errors.date || errors.dateTo ? <p className="mt-2 text-sm font-bold text-danger">{errors.date ?? errors.dateTo}</p> : null}
                      </fieldset>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-sm font-bold text-brand-950">
                          {t.days}
                          <input id="req-days" type="number" min={1} max={90} inputMode="numeric" dir="ltr" value={f.days ?? ""} onChange={(e) => set("days", e.target.value ? Math.max(1, Math.min(90, Math.trunc(Number(e.target.value)))) : null)} className={`${field} num mt-2`} />
                        </label>
                        <label className="text-sm font-bold text-brand-950">
                          {t.nights}
                          <input id="req-nights" type="number" min={0} max={90} inputMode="numeric" dir="ltr" value={f.nights ?? ""} onChange={(e) => set("nights", e.target.value ? Math.max(0, Math.min(90, Math.trunc(Number(e.target.value)))) : null)} className={`${field} num mt-2`} />
                        </label>
                      </div>
                      <label className="text-sm font-bold text-brand-950">
                        {t.airport}
                        <input id="req-airport" list="req-airports" maxLength={80} value={f.airport} onChange={(e) => set("airport", e.target.value)} className={`${field} mt-2`} />
                        <datalist id="req-airports">
                          {AIRPORTS.map((a) => (
                            <option key={a.code} value={locale === "ar" ? a.name_ar : a.name_en} />
                          ))}
                        </datalist>
                      </label>
                    </>
                  ) : null}

                  {!isCustom && program.hotels.length ? (
                    <fieldset>
                      <legend className="mb-3 text-sm font-bold text-brand-950">{t.hotel}</legend>
                      <div className="grid gap-2.5" role="radiogroup" data-field="hotelOptionId" tabIndex={-1}>
                        {program.hotels.map((h) => {
                          const on = f.hotelOptionId === h.id;
                          return (
                            <label key={h.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-[border-color,background-color,box-shadow] ${on ? "border-brand-600 bg-brand-50/70 ring-4 ring-brand-100" : "border-line hover:border-brand-300"}`}>
                              <input type="radio" name="hotel" value={h.id} className="size-5 accent-brand-600" checked={on} onChange={() => set("hotelOptionId", h.id)} />
                              <BedDouble className="size-5 shrink-0 text-brand-500" aria-hidden="true" />
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-1.5 font-bold text-brand-950">
                                  {h.label}
                                  {h.stars ? (
                                    <span className="inline-flex text-accent-500" aria-label={`${h.stars} ★`}>
                                      {Array.from({ length: h.stars }, (_, i) => (
                                        <Star key={i} className="size-3 fill-current" aria-hidden="true" />
                                      ))}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="block text-xs text-muted">{h.sub}</span>
                              </span>
                              {h.price ? <span className="num shrink-0 text-sm font-black text-brand-700">{h.price}</span> : null}
                            </label>
                          );
                        })}
                        <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 ${f.hotelOptionId === null ? "border-brand-600 bg-brand-50/70 ring-4 ring-brand-100" : "border-line"}`}>
                          <input type="radio" name="hotel" className="size-5 accent-brand-600" checked={f.hotelOptionId === null} onChange={() => set("hotelOptionId", null)} />
                          <span className="font-bold text-brand-950">{t.anyHotel}</span>
                        </label>
                      </div>
                    </fieldset>
                  ) : null}

                  {hasDepartures ? (
                    <fieldset>
                      <legend className="mb-3 text-sm font-bold text-brand-950">{t.departure}</legend>
                      <div className="grid gap-2.5" role="radiogroup" data-field="departureId" tabIndex={-1} aria-invalid={!!errors.departureId}>
                        {program.departures.map((d) => {
                          const on = f.departureId === d.id;
                          return (
                            <label
                              key={d.id}
                              className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-[border-color,background-color,box-shadow] ${
                                !d.bookable ? "cursor-not-allowed border-line bg-mist opacity-60" : on ? "border-brand-600 bg-brand-50/70 ring-4 ring-brand-100" : "border-line hover:border-brand-300"
                              }`}
                            >
                              <input type="radio" name="departure" className="size-5 accent-brand-600" disabled={!d.bookable} checked={on} onChange={() => set("departureId", d.id)} />
                              <CalendarDays className="size-5 shrink-0 text-brand-500" aria-hidden="true" />
                              <span className="min-w-0 flex-1">
                                <span className="block font-bold text-brand-950">{d.label}</span>
                                <span className="block text-xs text-muted">{d.sub}</span>
                              </span>
                              <span className={`shrink-0 text-xs font-bold ${!d.bookable ? "text-muted" : d.seatsLeft <= 8 ? "text-accent-700" : "text-brand-700"}`}>{d.seatsText}</span>
                            </label>
                          );
                        })}
                      </div>
                      {errors.departureId ? <p className="mt-2 text-sm font-bold text-danger">{errors.departureId}</p> : null}
                    </fieldset>
                  ) : null}

                  {!isCustom && !hasDepartures ? (
                    <div>
                      <label htmlFor="req-date" className="mb-2 block text-sm font-bold text-brand-950">
                        {t.preferredDate}
                      </label>
                      <input
                        id="req-date"
                        data-field="date"
                        type="date"
                        dir="ltr"
                        min={minDate}
                        disabled={f.flexible}
                        value={f.date}
                        onChange={(e) => set("date", e.target.value)}
                        aria-invalid={!!errors.date}
                        className={`${field} num rtl:text-right disabled:bg-mist disabled:text-muted`}
                      />
                      <label className="mt-2.5 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-muted">
                        <input type="checkbox" className="size-4 accent-brand-600" checked={f.flexible} onChange={(e) => set("flexible", e.target.checked)} />
                        {t.flexibleDate}
                      </label>
                      {errors.date ? <p className="mt-2 text-sm font-bold text-danger">{errors.date}</p> : null}
                    </div>
                  ) : null}

                  <fieldset className="rounded-2xl border border-line px-4">
                    <legend className="sr-only">{t.travelers}</legend>
                    <div className="divide-y divide-line">
                      <Counter label={t.adults} hint={t.adultsHint} value={f.adults} min={1} max={60} onChange={(v) => set("adults", v)} t={t} />
                      <Counter label={t.children} hint={t.childrenHint} value={f.children} min={0} max={40} onChange={(v) => set("children", v)} t={t} />
                      <Counter label={t.infants} hint={t.infantsHint} value={f.infants} min={0} max={10} onChange={(v) => set("infants", v)} t={t} />
                      <Counter label={t.rooms} hint="" value={f.rooms} min={1} max={40} onChange={(v) => set("rooms", v)} t={t} />
                    </div>
                  </fieldset>

                  {isCustom ? (
                    <>
                      <fieldset>
                        <legend className="mb-2.5 text-sm font-bold text-brand-950">{t.stars}</legend>
                        <div className="flex flex-wrap gap-2">
                          {[null, 3, 4, 5].map((n) => (
                            <label key={n ?? 0} className={chip(f.stars === n)}>
                              <input type="radio" name="stars" className="sr-only" checked={f.stars === n} onChange={() => set("stars", n)} />
                              {n ? `${n} ★` : t.anyStars}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <div>
                        <label htmlFor="req-budget" className="mb-2 block text-sm font-bold text-brand-950">
                          {t.budget} <span className="text-xs font-semibold text-muted">({t.optional})</span>
                        </label>
                        <div className="flex gap-2" dir="ltr">
                          <input id="req-budget" inputMode="decimal" maxLength={12} value={f.budget} onChange={(e) => set("budget", e.target.value)} className={`${field} num`} />
                          <select aria-label={t.budget} value={f.budgetCurrency} onChange={(e) => set("budgetCurrency", e.target.value)} className={`${field} w-28 shrink-0 cursor-pointer px-3`}>
                            {[...new Set([program.currency, "USD", "IQD"])].map((c) => (
                              <option key={c} value={c}>
                                {CURRENCIES[c as CurrencyCode]?.[locale] ?? c}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <label className="text-sm font-bold text-brand-950">
                        {t.airline} <span className="text-xs font-semibold text-muted">({t.optional})</span>
                        <input id="req-airline" maxLength={80} value={f.airline} onChange={(e) => set("airline", e.target.value)} className={`${field} mt-2`} />
                      </label>
                      {program.services.length ? (
                        <fieldset>
                          <legend className="mb-2.5 text-sm font-bold text-brand-950">{t.services}</legend>
                          <div className="flex flex-wrap gap-2">
                            {program.services.map((sv) => (
                              <label key={sv} className={chip(f.services.includes(sv))}>
                                <input type="checkbox" className="sr-only" checked={f.services.includes(sv)} onChange={() => set("services", toggle(f.services, sv))} />
                                {sv}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      ) : null}
                      <label className="text-sm font-bold text-brand-950">
                        {t.activities} <span className="text-xs font-semibold text-muted">({t.optional})</span>
                        <textarea id="req-activities" rows={2} maxLength={1000} placeholder={t.activitiesPh} value={f.activities} onChange={(e) => set("activities", e.target.value)} className={`${field} mt-2 h-auto resize-y py-3 leading-[1.8]`} />
                      </label>
                    </>
                  ) : null}

                  <fieldset>
                    <legend className="mb-2.5 text-sm font-bold text-brand-950">{t.roomType}</legend>
                    <div className="flex flex-wrap gap-2">
                      {ROOM_TYPES.map((r) => (
                        <label key={r} className={chip(f.roomType === r)}>
                          <input type="radio" name="roomType" className="sr-only" checked={f.roomType === r} onChange={() => set("roomType", r)} />
                          {ROOM_TYPE_LABELS[r][locale]}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              ) : null}

              {step === 1 ? (
                <div key="s1" className="grid gap-5 motion-safe:animate-[menu-in_0.5s_var(--ease-out-expo)_both]">
                  <h3 data-step-heading tabIndex={-1} className="text-lg font-extrabold text-brand-950 outline-none">
                    {steps[1]}
                  </h3>
                  <div>
                    <label htmlFor="req-name" className="mb-2 block text-sm font-bold text-brand-950">
                      {t.name} <span className="text-accent-700">*</span>
                    </label>
                    <input id="req-name" data-field="name" autoComplete="name" maxLength={80} placeholder={t.namePh} value={f.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? "req-name-err" : undefined} className={field} />
                    {errors.name ? (
                      <p id="req-name-err" className="mt-2 text-sm font-bold text-danger">
                        {errors.name}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label htmlFor="req-phone" className="mb-2 block text-sm font-bold text-brand-950">
                      {t.phone} <span className="text-accent-700">*</span>
                    </label>
                    <div className="flex gap-2" dir="ltr">
                      <select aria-label={t.countryCode} value={f.dial} onChange={(e) => set("dial", e.target.value)} className={`${field} num w-32 shrink-0 cursor-pointer px-3`}>
                        {DIAL_CODES.map((d) => (
                          <option key={d.country} value={d.code}>
                            +{d.code} {countryName(d.country, locale)}
                          </option>
                        ))}
                      </select>
                      <input
                        id="req-phone"
                        data-field="phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel-national"
                        maxLength={20}
                        placeholder="07XX XXX XXXX"
                        value={f.phone}
                        onChange={(e) => set("phone", e.target.value)}
                        aria-invalid={!!errors.phone}
                        aria-describedby={errors.phone ? "req-phone-err" : undefined}
                        className={`${field} num`}
                      />
                    </div>
                    {errors.phone ? (
                      <p id="req-phone-err" className="mt-2 text-sm font-bold text-danger">
                        {errors.phone}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label htmlFor="req-email" className="mb-2 block text-sm font-bold text-brand-950">
                      {t.email} <span className="text-xs font-semibold text-muted">({t.optional})</span>
                    </label>
                    <input id="req-email" data-field="email" type="email" dir="ltr" autoComplete="email" maxLength={200} value={f.email} onChange={(e) => set("email", e.target.value)} aria-invalid={!!errors.email} className={`${field} rtl:text-right`} />
                    {errors.email ? <p className="mt-2 text-sm font-bold text-danger">{errors.email}</p> : null}
                  </div>
                  <div>
                    <label htmlFor="req-notes" className="mb-2 block text-sm font-bold text-brand-950">
                      {t.notes} <span className="text-xs font-semibold text-muted">({t.optional})</span>
                    </label>
                    <textarea id="req-notes" rows={3} maxLength={1000} placeholder={t.notesPh} value={f.notes} onChange={(e) => set("notes", e.target.value)} className={`${field} h-auto resize-y py-3 leading-[1.8]`} />
                  </div>
                  {/* Honeypot for bots: hidden from people and assistive technology. */}
                  <div aria-hidden="true" className="absolute -start-[9999px] h-px w-px overflow-hidden">
                    <label>
                      Website
                      <input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set("website", e.target.value)} />
                    </label>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div key="s2" className="grid gap-5 motion-safe:animate-[menu-in_0.5s_var(--ease-out-expo)_both]">
                  <h3 data-step-heading tabIndex={-1} className="text-lg font-extrabold text-brand-950 outline-none">
                    {steps[2]}
                  </h3>
                  <dl className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                    {[
                      { label: t.program, value: program.title, step: 0 as Step },
                      ...(isCustom ? [{ label: t.countries, value: [countriesText, f.places].filter(Boolean).join(" — "), step: 0 as Step }] : []),
                      { label: hasDepartures && departure ? t.departure : isCustom ? t.period : t.preferredDate, value: dateText, step: 0 as Step },
                      ...(hotel ? [{ label: t.hotel, value: `${hotel.label}${hotel.price ? ` · ${hotel.price}` : ""}`, step: 0 as Step }] : []),
                      ...(isCustom && (f.stars || f.budget)
                        ? [{ label: t.stars, value: [f.stars ? `${f.stars} ★` : null, f.budget ? `${t.budget}: ${f.budget} ${CURRENCIES[f.budgetCurrency as CurrencyCode]?.[locale] ?? f.budgetCurrency}` : null].filter(Boolean).join(" · "), step: 0 as Step }]
                        : []),
                      { label: t.travelers, value: `${travelersText} · ${f.rooms} × ${ROOM_TYPE_LABELS[f.roomType][locale]}`, step: 0 as Step },
                      { label: t.name, value: f.name.trim(), step: 1 as Step },
                      { label: t.phone, value: formatPhone(toE164(f.dial, f.phone)) || `+${f.dial} ${f.phone}`, step: 1 as Step, ltr: true },
                      ...(f.email ? [{ label: t.email, value: f.email, step: 1 as Step, ltr: true }] : []),
                      ...(f.notes ? [{ label: t.notes, value: f.notes, step: 1 as Step }] : []),
                    ].map((row) => (
                      <div key={row.label} className="flex items-start gap-3 px-4 py-3">
                        <dt className="w-28 shrink-0 text-sm font-bold text-muted">{row.label}</dt>
                        <dd className={`min-w-0 flex-1 text-[0.95rem] font-semibold break-words whitespace-pre-line text-brand-950 ${"ltr" in row && row.ltr ? "num" : ""}`} dir={"ltr" in row && row.ltr ? "ltr" : undefined}>
                          {row.value}
                        </dd>
                        <button type="button" onClick={() => setStep(row.step)} className="shrink-0 rounded-lg p-1 text-brand-600 hover:bg-brand-50" aria-label={`${t.edit}: ${row.label}`}>
                          <Pencil className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </dl>
                  <p className="text-sm leading-[1.85] text-muted">{t.consent}</p>
                </div>
              ) : null}

              {step === 3 && ref ? (
                <div key="s3" role="status" className="flex flex-col items-center py-4 text-center">
                  <svg viewBox="0 0 80 80" className="size-20" aria-hidden="true">
                    <circle cx="40" cy="40" r="36" fill="none" stroke="var(--color-brand-100)" strokeWidth="6" />
                    <circle cx="40" cy="40" r="36" fill="none" stroke="var(--color-accent-500)" strokeWidth="6" strokeLinecap="round" strokeDasharray="226" strokeDashoffset="226" className="origin-center -rotate-90 motion-safe:animate-[draw_0.9s_var(--ease-out-expo)_forwards] motion-reduce:[stroke-dashoffset:0]" />
                    <path d="M26 41l9 9 19-20" fill="none" stroke="var(--color-brand-600)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="44" strokeDashoffset="44" className="motion-safe:animate-[draw_0.5s_0.6s_ease-out_forwards] motion-reduce:[stroke-dashoffset:0]" />
                  </svg>
                  <h3 data-step-heading tabIndex={-1} className="mt-5 text-2xl font-extrabold text-brand-950 outline-none">
                    {t.successTitle}
                  </h3>
                  <p className="mt-3 max-w-md leading-[1.9] text-muted">{isCustom ? t.successCustomText : t.successText}</p>
                  <div className="mt-6 w-full max-w-sm rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/60 p-4">
                    <p className="text-sm font-bold text-muted">{t.reference}</p>
                    <div className="mt-1 flex items-center justify-center gap-3">
                      <p className="num text-2xl font-black tracking-wide text-brand-800" dir="ltr" data-request-ref>
                        {ref}
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard?.writeText(ref).catch(() => undefined);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-brand-700 ring-1 ring-brand-100 hover:bg-brand-50"
                      >
                        {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                        {copied ? t.copied : t.copy}
                      </button>
                    </div>
                  </div>
                  <div className="mt-6 grid w-full max-w-sm gap-2.5">
                    <a href={whatsappUrl(waText)} target="_blank" rel="noopener noreferrer" className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-accent-500 font-bold text-brand-950 transition-colors hover:bg-accent-400">
                      <WhatsAppIcon className="size-5" /> {t.whatsapp}
                    </a>
                    <button type="button" onClick={close} className="inline-flex h-12 items-center justify-center rounded-full border border-line font-bold text-brand-900 hover:bg-brand-50">
                      {t.done}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            {step < 3 ? (
              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-white px-5 py-4 sm:px-7">
                {step > 0 ? (
                  <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1) as Step)} className="inline-flex h-12 items-center rounded-full px-5 font-bold text-brand-800 hover:bg-brand-50">
                    {t.back}
                  </button>
                ) : (
                  <span className="text-xs font-bold text-muted">{t.stepOf(1, 3)}</span>
                )}
                {step < 2 ? (
                  <button key="next" type="button" onClick={next} className="inline-flex h-12 min-w-36 items-center justify-center rounded-full bg-brand-600 px-7 font-bold text-white transition-colors hover:bg-brand-700">
                    {t.next}
                  </button>
                ) : (
                  <button key="submit" type="button" onClick={submit} disabled={sending} className="inline-flex h-12 min-w-44 items-center justify-center gap-2 rounded-full bg-accent-500 px-7 font-bold text-brand-950 transition-[background-color,box-shadow] hover:bg-accent-400 hover:shadow-glow disabled:opacity-70" data-submit-request>
                    {sending ? <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-brand-950 border-e-transparent" /> : <Send className="size-4 rtl:-scale-x-100" aria-hidden="true" />}
                    {sending ? t.sending : t.submit}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </Ctx.Provider>
  );
}
