"use client";

import {
  ArrowDown,
  ArrowUp,
  BedDouble,
  Check,
  CircleAlert,
  Eye,
  History,
  Lock,
  Plane,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Search,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { airportByCode, airportShort, type Airport } from "@/lib/airports";
import { countryName } from "@/lib/countries";
import { addDays, daysBetween, formatDay, todayDay } from "@/lib/dates";
import type { MediaRef } from "@/lib/media";
import { CURRENCIES, formatMoney, type CurrencyCode } from "@/lib/money";
import { computedOptionPrice, convert, hotelPerPerson, optionMargin, optionPrice, priceFrom } from "@/lib/program-pricing";
import { slugify } from "@/lib/slug";
import { BOARD_LABELS, BOARDS, DEPARTURE_STATUS_LABELS, DEPARTURE_STATUSES, RATE_BASIS_LABELS, TYPE_HINTS, TYPE_LABELS, VISIBILITY_LABELS, type Board, type DepartureStatus, type ProgramType, type Visibility } from "@/lib/travel-labels";
import { saveProgramAction } from "@/server/actions/programs";
import type { CatalogOptions } from "@/server/editor-options";
import { AirportDatalist, AirportInput } from "./AirportInput";
import { DestinationPicker } from "./DestinationPicker";
import { Bilingual, MoneyInput, NumberInput } from "./fields";
import { ImagePicker } from "./ImagePicker";
import { Modal } from "./Modal";
import { useToast } from "./Toaster";
import { Badge, Button, Card, Field, Input, Select, Toggle } from "./ui";

// ------------------------------------------------------------------ Form model
export interface OptionForm {
  key: string;
  /** Bumps when prices are set programmatically, so the (uncontrolled) money inputs re-render. */
  v: number;
  id: string | null;
  hotel_id: number;
  room_type_id: string | null;
  room_ar: string | null;
  room_en: string | null;
  occupancy: number;
  board: Board | null;
  nights: number;
  basis: "per_person" | "per_room";
  night_price: number | null;
  night_cost: number | null;
  source: "library" | "custom";
  rate_id: string | null;
  refresh_rate: boolean;
  /** Library rate as stored in this program (currency, price, date). */
  snapshot: { currency: string; price: number; cost: number | null; captured_at: string } | null;
  fx_rate: number | null;
  final_price_override: number | null;
  note_ar: string | null;
  note_en: string | null;
}

export interface DepartureForm {
  key: string;
  id?: number;
  code?: string;
  confirmed?: number;
  depart_date: string;
  return_date: string;
  seats_total: number;
  seats_held: number;
  price_supplement: number;
  status: DepartureStatus;
  note_ar: string | null;
  note_en: string | null;
}

export interface FlightForm {
  key: string;
  direction: "outbound" | "return" | "internal";
  airline_id: number | null;
  flight_no: string | null;
  from: string | null;
  to: string | null;
  day: number | null;
  depart_time: string | null;
  arrive_time: string | null;
  note: string | null;
}

export interface WizardForm {
  type: ProgramType;
  visibility: Visibility;
  featured: boolean;
  title_ar: string;
  title_en: string | null;
  slug: string | null;
  summary_ar: string | null;
  summary_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  destination_ids: number[];
  duration_days: number;
  duration_nights: number;
  currency: string;
  airport: { code: string | null; name_ar: string; name_en: string | null } | null;
  airline_ids: number[];
  flights: FlightForm[];
  itinerary: { key: string; title_ar: string; title_en: string | null; body_ar: string | null; body_en: string | null }[];
  services: { service_id: number; included: boolean; note_ar: string | null; note_en: string | null }[];
  meals_ar: string | null;
  meals_en: string | null;
  terms_ar: string | null;
  terms_en: string | null;
  cover: MediaRef | null;
  gallery: MediaRef[];
  base_price: number | null;
  base_cost: number | null;
  options: OptionForm[];
  extra_prices: { key: string; label_ar: string; label_en: string | null; amount: number | null }[];
  price_note_ar: string | null;
  price_note_en: string | null;
  departures: DepartureForm[];
}

export interface WizardMeta {
  id: number | null;
  code: string | null;
  status: string;
  updated_at: string | null;
  share: { token: string; enabled: boolean } | null;
}

// Drafts present in this browser when a wizard first opened (read once per program).
const draftCache = new Map<string, string | null>();
function readInitialDraft(key: string) {
  if (!draftCache.has(key)) {
    let value: string | null = null;
    try {
      value = localStorage.getItem(key);
    } catch {
      /* storage unavailable */
    }
    draftCache.set(key, value);
  }
  return draftCache.get(key) ?? null;
}
const noopSubscribe = () => () => {};

let seq = 0;
export const newKey = () => `k${Date.now().toString(36)}${++seq}`;

const STEPS = [
  { id: "basics", title: "المعلومات الأساسية والوجهة" },
  { id: "travel", title: "المطار والطيران والتواريخ" },
  { id: "hotels", title: "اختيار الفنادق" },
  { id: "rooms", title: "أسعار الغرف والليالي" },
  { id: "days", title: "البرنامج اليومي والخدمات" },
  { id: "prices", title: "الأسعار النهائية" },
  { id: "review", title: "المعاينة والنشر" },
] as const;

function StepCard({ title, description, children, actions }: { title: string; description?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-lg font-extrabold text-brand-950">{title}</h2>
          {description ? <p className="mt-0.5 max-w-3xl text-sm text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="grid gap-6 p-5">{children}</div>
    </Card>
  );
}

function PricingLocked({ children, locked }: { children: ReactNode; locked: boolean }) {
  if (!locked) return <>{children}</>;
  return (
    <div className="grid gap-4">
      <p className="flex items-center gap-2 rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm font-bold text-accent-700">
        <Lock className="size-4" aria-hidden="true" /> الأسعار والفنادق للاطلاع فقط: لا تملك صلاحية تعديل التسعير. تُحفظ تعديلاتك الأخرى وتبقى الأسعار كما هي.
      </p>
      <fieldset disabled className="grid gap-4 opacity-80">
        {children}
      </fieldset>
    </div>
  );
}

const move = <T,>(list: T[], i: number, d: -1 | 1) => {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const copy = [...list];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
};

/** Client-side publish checklist (the server checks the same rules again). */
function checklist(f: WizardForm) {
  const today = todayDay();
  const fixed = f.type === "fixed";
  const priced = f.options.some((o) => (o.night_price ?? 0) > 0 || (o.final_price_override ?? 0) > 0) || (f.base_price ?? 0) > 0;
  return [
    { ok: f.title_ar.trim().length >= 3, label: "عنوان البرنامج بالعربية", step: 0 },
    { ok: f.destination_ids.length > 0, label: "الدولة / الوجهة", step: 0 },
    { ok: !!f.cover, label: "صورة الغلاف", step: 0 },
    { ok: !!f.summary_ar, label: "الوصف المختصر بالعربية", step: 0 },
    ...(fixed ? [{ ok: f.departures.some((d) => d.depart_date > today && d.status !== "cancelled"), label: "موعد سفر قادم (تاريخ المغادرة والعودة والمقاعد)", step: 1 }] : []),
    { ok: f.options.length > 0, label: fixed ? "فندق واحد على الأقل (يمكن إضافة عدة خيارات)" : "فنادق مقترحة (اختياري)", step: 2, optional: !fixed },
    ...(fixed ? [{ ok: priced, label: "الأسعار (السعر الأساسي أو سعر الفندق)", step: 5 }] : []),
    { ok: f.itinerary.length > 0, label: "البرنامج اليومي (يوم واحد على الأقل)", step: 4 },
  ];
}

export function ProgramWizard({
  initial,
  meta,
  options,
  rights,
  initialStep = 0,
}: {
  initial: WizardForm;
  meta: WizardMeta;
  options: CatalogOptions;
  rights: { pricing: boolean; override: boolean; publish: boolean; costs: boolean };
  initialStep?: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<WizardForm>(initial);
  const [step, setStep] = useState(Math.min(Math.max(0, initialStep), 6));
  const [visited, setVisited] = useState<Set<number>>(() => new Set(meta.id ? [0, 1, 2, 3, 4, 5, 6] : [0]));
  const [saving, setSaving] = useState<"save" | "publish" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [restoreDismissed, setRestoreDismissed] = useState(false);
  const [picker, setPicker] = useState(false);
  /** Remounts the step (uncontrolled money inputs) after restoring a local draft. */
  const [version, setVersion] = useState(0);
  const storageKey = `etijah:program-wizard:${meta.id ?? "new"}`;
  const firstRender = useRef(true);

  const set = <K extends keyof WizardForm>(k: K, v: WizardForm[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };
  const setOption = (key: string, patch: Partial<OptionForm>) => {
    setF((x) => ({ ...x, options: x.options.map((o) => (o.key === key ? { ...o, ...patch } : o)) }));
    setDirty(true);
  };
  const currency = f.currency;
  const money = (n: number | null | undefined) => (n == null ? "—" : formatMoney(n, currency, "ar"));
  const fixed = f.type === "fixed";
  const hotelById = useMemo(() => new Map(options.hotels.map((h) => [h.id, h])), [options.hotels]);

  // ---------------------------------------------------------------- Local draft (never lose work)
  // The draft that existed when the page opened (read once, hydration-safe: null on the server).
  const initialDraft = useSyncExternalStore(noopSubscribe, () => readInitialDraft(storageKey), () => null);
  const restore = useMemo(() => {
    if (restoreDismissed || !initialDraft) return null;
    try {
      const saved = JSON.parse(initialDraft) as { form: WizardForm; at: string };
      return !meta.updated_at || saved.at > meta.updated_at ? saved : null;
    } catch {
      return null;
    }
  }, [initialDraft, restoreDismissed, meta.updated_at]);
  const setRestore = (_: null) => {
    draftCache.delete(storageKey);
    setRestoreDismissed(true);
  };

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!dirty) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ form: f, at: new Date().toISOString() }));
      } catch {
        /* quota or private mode */
      }
    }, 700);
    return () => clearTimeout(t);
  }, [f, dirty, storageKey]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const goTo = (i: number) => {
    setStep(i);
    setVisited((v) => new Set(v).add(i));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---------------------------------------------------------------- Pricing (live, same functions as the server)
  const pricing = { base_price: f.base_price ?? 0, base_cost: f.base_cost };
  const optionPricing = (o: OptionForm) => ({ basis: o.basis, occupancy: o.occupancy, nights: o.nights, night_price: o.night_price ?? 0, night_cost: o.night_cost, final_price_override: o.final_price_override });
  const from = fixed ? priceFrom(pricing, f.options.map(optionPricing)) : null;
  const checks = checklist(f);
  const missing = checks.filter((c) => !c.ok && !("optional" in c && c.optional));

  // ---------------------------------------------------------------- Save
  const save = async (intent: "save" | "publish") => {
    setSaving(intent);
    try {
      const res = await saveProgramAction({
        id: meta.id,
        intent,
        program: {
          type: f.type,
          visibility: f.visibility,
          featured: f.featured,
          title_ar: f.title_ar,
          title_en: f.title_en,
          slug: f.slug,
          summary_ar: f.summary_ar,
          summary_en: f.summary_en,
          description_ar: f.description_ar,
          description_en: f.description_en,
          destination_ids: f.destination_ids,
          duration_days: f.duration_days,
          duration_nights: f.duration_nights,
          currency: f.currency,
          departure_airport: f.airport && f.airport.name_ar.trim() ? f.airport : null,
          airline_ids: f.airline_ids,
          flights: f.flights.map(({ key: _k, ...x }) => x),
          itinerary: f.itinerary.map(({ key: _k, ...x }) => x),
          services: f.services,
          meals_ar: f.meals_ar,
          meals_en: f.meals_en,
          terms_ar: f.terms_ar,
          terms_en: f.terms_en,
          cover_media_id: f.cover?.id ?? null,
          gallery: f.gallery.map((m) => m.id),
          base_price: f.base_price ?? 0,
          base_cost: f.base_cost,
          hotel_options: f.options.map((o) => ({
            id: o.id,
            hotel_id: o.hotel_id,
            room_type_id: o.room_type_id,
            room_ar: o.room_ar,
            room_en: o.room_en,
            occupancy: o.occupancy,
            board: o.board,
            nights: o.nights,
            basis: o.basis,
            night_price: o.night_price ?? 0,
            night_cost: o.night_cost,
            source: o.source,
            rate_id: o.source === "library" ? o.rate_id : null,
            refresh_rate: o.refresh_rate,
            fx_rate: o.fx_rate,
            final_price_override: o.final_price_override,
            note_ar: o.note_ar,
            note_en: o.note_en,
          })),
          extra_prices: f.extra_prices.map(({ key: _k, ...x }) => ({ ...x, amount: x.amount ?? 0 })),
          price_note_ar: f.price_note_ar,
          price_note_en: f.price_note_en,
          departures: fixed ? f.departures.map(({ key: _k, code: _c, confirmed: _cf, ...d }) => d) : [],
        },
      });
      if (res.ok) {
        setErrors({});
        setDirty(false);
        try {
          localStorage.removeItem(storageKey);
        } catch {
          /* ignore */
        }
        draftCache.delete(storageKey);
        if (res.message) toast.success(res.message);
        // Reload with the server's ids (new departures and hotel options), staying on this step.
        router.replace(`/staff/programs/${res.data.id}/?step=${step}`);
        router.refresh();
      } else {
        const fe = res.fieldErrors ?? {};
        setErrors(fe);
        toast.error(res.error);
        if (fe._saved) {
          setDirty(false);
          router.replace(`/staff/programs/${fe._saved}/?step=6`);
          router.refresh();
        }
      }
    } catch {
      toast.error("تعذّر الاتصال بالخادم. عملك محفوظ على هذا الجهاز؛ حاول مجدداً.");
    } finally {
      setSaving(null);
    }
  };

  const err = (k: string) => errors[k] ?? errors[`program.${k}`];
  const destCountries = [...new Set(f.destination_ids.map((d) => options.destinations.find((x) => x.id === d)?.country_code).filter(Boolean))] as string[];
  const destById = useMemo(() => new Map(options.destinations.map((d) => [d.id, d])), [options.destinations]);
  const chosen = f.destination_ids.map((id) => destById.get(id)).filter((d): d is CatalogOptions["destinations"][number] => !!d);

  // ---------------------------------------------------------------- Shortcuts (fewer clicks, nothing assumed silently)
  /** Days drive the rest: nights follow (days - 1) unless staff set them differently, and so do return dates and hotel nights. */
  const setDuration = (days: number) => {
    setF((x) => {
      const nights = x.duration_nights === x.duration_days - 1 || x.duration_nights >= days ? Math.max(0, days - 1) : x.duration_nights;
      const oldSpan = Math.max(0, x.duration_days - 1);
      return {
        ...x,
        duration_days: days,
        duration_nights: nights,
        departures: x.departures.map((d) => (d.depart_date && d.return_date === addDays(d.depart_date, oldSpan) ? { ...d, return_date: addDays(d.depart_date, Math.max(0, days - 1)) } : d)),
        options: x.options.map((o) => (o.nights === Math.max(1, x.duration_nights) && nights > 0 ? { ...o, nights } : o)),
      };
    });
    setDirty(true);
  };

  /** Outbound to the first destination's airport and return from the last one, with the first chosen airline. */
  const suggestFlights = () => {
    const stops: Airport[] = [];
    for (const d of chosen) {
      const a = airportByCode(d.airport_code);
      if (a && stops.at(-1)?.code !== a.code) stops.push(a);
    }
    if (!stops.length) return toast.error("الوجهات المختارة بلا مطار وصول. حدده من «الدول والوجهات» أو أضف الرحلات يدوياً.");
    const home = f.airport?.code ? airportByCode(f.airport.code) : null;
    const homeText = home ? airportShort(home) : (f.airport?.name_ar ?? null);
    const leg = (direction: FlightForm["direction"], from: string | null, to: string | null, day: number | null): FlightForm => ({ key: newKey(), direction, airline_id: f.airline_ids[0] ?? null, flight_no: null, from, to, day, depart_time: null, arrive_time: null, note: null });
    set("flights", [leg("outbound", homeText, airportShort(stops[0]), 1), leg("return", airportShort(stops.at(-1)!), homeText, f.duration_days)]);
    toast.success("أُضيفت رحلتا الذهاب والعودة. أكمل أرقام الرحلات والأوقات إن توفرت.");
  };

  /** Adds the missing day rows up to the trip length, with editable titles built from the chosen cities (in order). */
  const fillDays = () => {
    const n = f.duration_days;
    const k = chosen.length;
    const at = (i: number) => (k ? chosen[n > 2 ? Math.min(k - 1, Math.max(0, Math.floor(((i - 1) * k) / (n - 2)))) : 0] : null);
    const toured = new Set<number>();
    const rows: WizardForm["itinerary"] = [];
    for (let i = 0; i < n; i++) {
      const d = at(i);
      let ar: string;
      let en: string | null;
      if (i === 0) {
        ar = d ? `الوصول إلى ${d.label} والاستقبال في المطار والتوجه إلى الفندق` : "الوصول والاستقبال في المطار والتوجه إلى الفندق";
        en = d ? `Arrival in ${d.name_en}, airport pickup and hotel check-in` : "Arrival, airport pickup and hotel check-in";
      } else if (i === n - 1) {
        ar = "تسجيل الخروج من الفندق والتوجه إلى المطار للعودة";
        en = "Hotel check-out and transfer to the airport for the return flight";
      } else if (d && i > 1 && d.id !== at(i - 1)?.id) {
        ar = `الانتقال إلى ${d.label}`;
        en = `Transfer to ${d.name_en}`;
      } else if (d && !toured.has(d.id)) {
        ar = `جولة سياحية في ${d.label}`;
        en = `Sightseeing tour in ${d.name_en}`;
        toured.add(d.id);
      } else if (d) {
        ar = `يوم حر أو جولات اختيارية في ${d.label}`;
        en = `Free day or optional tours in ${d.name_en}`;
      } else {
        ar = `اليوم ${i + 1}`;
        en = null;
      }
      rows.push({ key: newKey(), title_ar: ar, title_en: en, body_ar: null, body_en: null });
    }
    const added = rows.slice(f.itinerary.length);
    if (!added.length) return toast.success("عدد الأيام مكتمل.");
    set("itinerary", [...f.itinerary, ...added]);
    setVersion((v) => v + 1);
    toast.success(`أُضيفت ${added.length} أيام بعناوين مقترحة. عدّلها وأضف التفاصيل.`);
  };

  // ---------------------------------------------------------------- Hotel picker
  const addOption = (hotelId: number, rateId: string | null) => {
    const h = hotelById.get(hotelId);
    if (!h) return;
    const rate = rateId ? h.rates.find((r) => r.id === rateId) : null;
    const room = rate ? h.room_types.find((r) => r.id === rate.room_type_id) : h.room_types[0];
    const sameCurrency = !rate || rate.currency === currency;
    const nights = Math.max(1, f.duration_nights || 1);
    setF((x) => ({
      ...x,
      options: [
        ...x.options,
        {
          key: newKey(),
          v: 0,
          id: null,
          hotel_id: h.id,
          room_type_id: room?.id ?? null,
          room_ar: room?.name_ar ?? null,
          room_en: room?.name_en ?? null,
          occupancy: rate?.occupancy ?? Math.min(2, room?.max_pax ?? 2),
          board: rate?.board ?? "BB",
          nights,
          basis: rate?.basis ?? "per_room",
          night_price: rate && sameCurrency ? rate.price : null,
          night_cost: rate && sameCurrency ? rate.cost : null,
          source: rate ? "library" : "custom",
          rate_id: rate?.id ?? null,
          refresh_rate: false,
          snapshot: rate ? { currency: rate.currency, price: rate.price, cost: rate.cost, captured_at: new Date().toISOString() } : null,
          fx_rate: null,
          final_price_override: null,
          note_ar: null,
          note_en: null,
        },
      ],
    }));
    setDirty(true);
    toast.success(`أُضيف «${h.name}» إلى البرنامج.`);
  };

  /** Re-copies the current library price into an option (only when staff ask for it). */
  const refreshFromLibrary = (o: OptionForm) => {
    const rate = hotelById.get(o.hotel_id)?.rates.find((r) => r.id === o.rate_id);
    if (!rate) return toast.error("السعر لم يعد موجوداً في المكتبة. حوّل الخيار إلى سعر خاص.");
    const fx = rate.currency === currency ? null : o.fx_rate;
    setOption(o.key, {
      v: o.v + 1,
      refresh_rate: true,
      basis: rate.basis,
      occupancy: rate.occupancy,
      board: rate.board,
      snapshot: { currency: rate.currency, price: rate.price, cost: rate.cost, captured_at: new Date().toISOString() },
      night_price: rate.currency === currency ? rate.price : fx ? convert(rate.price, fx) : null,
      night_cost: rate.cost == null ? null : rate.currency === currency ? rate.cost : fx ? convert(rate.cost, fx) : null,
    });
  };

  const applyFx = (o: OptionForm, fx: number | null) => {
    if (!o.snapshot) return setOption(o.key, { fx_rate: fx });
    setOption(o.key, {
      v: o.v + 1,
      fx_rate: fx,
      night_price: fx ? convert(o.snapshot.price, fx) : o.night_price,
      night_cost: fx && o.snapshot.cost != null ? convert(o.snapshot.cost, fx) : o.night_cost,
    });
  };

  // ---------------------------------------------------------------- Steps
  const stepBasics = (
    <StepCard title="1. المعلومات الأساسية والوجهة" description="نوع البرنامج وعنوانه ووجهته وصوره.">
      <fieldset>
        <legend className="mb-2 text-sm font-bold text-brand-950">نوع البرنامج</legend>
        <div className="grid gap-3 md:grid-cols-2">
          {(["fixed", "custom"] as const).map((t) => (
            <label key={t} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${f.type === t ? "border-brand-600 bg-brand-50/60 ring-2 ring-brand-100" : "border-line hover:border-brand-200"}`}>
              <input type="radio" name="ptype" value={t} checked={f.type === t} onChange={() => set("type", t)} className="mt-1 accent-brand-600" data-program-type={t} />
              <span>
                <span className="block font-bold text-brand-950">{TYPE_LABELS[t].ar}</span>
                <span className="mt-0.5 block text-sm text-muted">{TYPE_HINTS[t]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Bilingual label="عنوان البرنامج" required ar={f.title_ar} en={f.title_en} onAr={(v) => set("title_ar", v)} onEn={(v) => set("title_en", v || null)} errorAr={err("title_ar")} maxLength={140} name="title" />
      <Bilingual label="وصف مختصر" name="summary" hint="سطران يظهران في بطاقة البرنامج." multiline rows={2} ar={f.summary_ar} en={f.summary_en} onAr={(v) => set("summary_ar", v || null)} onEn={(v) => set("summary_en", v || null)} maxLength={320} />
      <Bilingual label="تفاصيل البرنامج" name="description" multiline rows={5} ar={f.description_ar} en={f.description_en} onAr={(v) => set("description_ar", v || null)} onEn={(v) => set("description_en", v || null)} />
      <Field label="الدولة والمدن" required error={err("destination_ids")} hint="اختر الدولة ثم المدن بالترتيب. يمكن الجمع بين أكثر من دولة.">
        <DestinationPicker destinations={options.destinations} countries={options.countries} value={f.destination_ids} onChange={(ids) => set("destination_ids", ids)} />
      </Field>
      <div className="grid gap-6 md:grid-cols-2">
        <ImagePicker label="صورة الغلاف" max={1} value={f.cover ? [f.cover] : []} onChange={(v) => set("cover", v[0] ?? null)} />
        <ImagePicker label="صور الوجهة (المعرض)" max={30} value={f.gallery} onChange={(v) => set("gallery", v)} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="ظهور البرنامج" hint="المخفي لا يظهر في قائمة الموقع، ويُفتح برابطه المستقل فقط.">
          <Select value={f.visibility} onChange={(e) => set("visibility", e.target.value as Visibility)}>
            {(["public", "unlisted"] as const).map((v) => (
              <option key={v} value={v}>
                {VISIBILITY_LABELS[v]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الرابط المختصر (اختياري)" error={err("slug")} hint={`مثال: ${slugify(f.title_en ?? "") || "istanbul-winter-trip"}`}>
          <Input dir="ltr" className="text-left" value={f.slug ?? ""} onChange={(e) => set("slug", e.target.value || null)} />
        </Field>
        <div className="pt-6">
          <Toggle id="p-featured" checked={f.featured} onChange={(v) => set("featured", v)} label="برنامج مميز" description="يظهر أولاً في صفحة العروض والرئيسية." />
        </div>
      </div>
    </StepCard>
  );

  const stepTravel = (
    <StepCard title="2. المطار وشركة الطيران والتواريخ والمدة" description={fixed ? "مدة الرحلة ومطار المغادرة وشركات الطيران، ثم مواعيد السفر والعودة وعدد المقاعد." : "البرنامج الخاص بدون موعد ثابت: المسافر يحدد موعده في نموذج الطلب."}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="عدد الأيام" required error={err("duration_days")}>
          <NumberInput min={1} max={90} value={f.duration_days} onChange={(v) => setDuration(Math.min(90, Math.max(1, v ?? 1)))} aria-label="عدد الأيام" />
        </Field>
        <Field label="عدد الليالي" required error={err("duration_nights")} hint="تُضبط تلقائياً (الأيام − 1) ويمكن تغييرها.">
          <NumberInput min={0} max={90} value={f.duration_nights} onChange={(v) => set("duration_nights", v ?? 0)} aria-label="عدد الليالي" />
        </Field>
        <Field label="مطار المغادرة" hint="ابحث بالاسم أو الرمز (مثل NJF)، أو اكتب مطاراً آخر.">
          <AirportInput
            listId="wizard-airports"
            airports={options.airports}
            value={f.airport ? (f.airport.code ? `${f.airport.name_ar} (${f.airport.code})` : f.airport.name_ar) : ""}
            data-airport
            onChange={(text, a) => set("airport", text.trim() ? (a ? { code: a.code, name_ar: a.name_ar, name_en: a.name_en } : { code: null, name_ar: text.trim(), name_en: null }) : null)}
          />
          <AirportDatalist id="wizard-airports" airports={options.airports} />
        </Field>
      </div>
      <Field label="شركة أو شركات الطيران" hint={options.airlines.length ? "من قائمة شركات الطيران في «الطيران والعمولات»." : "لا توجد شركات طيران بعد. أضفها من «شركات الطيران»."}>
        <div className="flex flex-wrap gap-2" data-airlines>
          {options.airlines.map((a) => {
            const on = f.airline_ids.includes(a.id);
            return (
              <label key={a.id} className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-bold transition-colors ${on ? "border-brand-600 bg-brand-600 text-white" : "border-line text-brand-900 hover:border-brand-300"}`}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => set("airline_ids", on ? f.airline_ids.filter((x) => x !== a.id) : [...f.airline_ids, a.id])} />
                <Plane className="me-1 inline size-3.5" aria-hidden="true" />
                {a.name}
                {a.iata ? <span className="num ms-1 opacity-75">({a.iata})</span> : null}
              </label>
            );
          })}
        </div>
      </Field>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-bold text-brand-950">تفاصيل الرحلات الجوية (إن توفرت)</p>
          <div className="flex flex-wrap gap-2">
          {!f.flights.length && chosen.some((d) => d.airport_code) ? (
            <Button size="sm" variant="subtle" onClick={suggestFlights} data-suggest-flights>
              <Sparkles className="size-4" aria-hidden="true" /> اقتراح الذهاب والعودة
            </Button>
          ) : null}
          <Button size="sm" variant="subtle" onClick={() => set("flights", [...f.flights, { key: newKey(), direction: f.flights.length ? "return" : "outbound", airline_id: f.airline_ids[0] ?? null, flight_no: null, from: null, to: null, day: null, depart_time: null, arrive_time: null, note: null }])}>
            <Plus className="size-4" aria-hidden="true" /> رحلة
          </Button>
          </div>
        </div>
        {f.flights.length ? (
          <ul role="list" className="grid gap-2">
            {f.flights.map((fl, i) => {
              const up = (patch: Partial<FlightForm>) => set("flights", f.flights.map((x) => (x.key === fl.key ? { ...x, ...patch } : x)));
              return (
                <li key={fl.key} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[7rem_1fr_6rem_1fr_1fr_5rem_5rem_auto] sm:items-end">
                  <Select aria-label="الاتجاه" value={fl.direction} onChange={(e) => up({ direction: e.target.value as FlightForm["direction"] })}>
                    <option value="outbound">ذهاب</option>
                    <option value="return">عودة</option>
                    <option value="internal">داخلي</option>
                  </Select>
                  <Select aria-label="شركة الطيران" value={fl.airline_id ?? ""} onChange={(e) => up({ airline_id: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">شركة الطيران…</option>
                    {options.airlines.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                  <Input aria-label="رقم الرحلة" dir="ltr" placeholder="TK 1234" value={fl.flight_no ?? ""} onChange={(e) => up({ flight_no: e.target.value || null })} />
                  <AirportInput listId="wizard-airports" airports={options.airports} aria-label="من" placeholder="من (NJF)" maxLength={60} value={fl.from ?? ""} onChange={(t, a) => up({ from: a ? airportShort(a) : t.trim() || null })} />
                  <AirportInput listId="wizard-airports" airports={options.airports} aria-label="إلى" placeholder="إلى (IST)" maxLength={60} value={fl.to ?? ""} onChange={(t, a) => up({ to: a ? airportShort(a) : t.trim() || null })} />
                  <Input aria-label="الإقلاع" type="time" dir="ltr" value={fl.depart_time ?? ""} onChange={(e) => up({ depart_time: e.target.value || null })} />
                  <Input aria-label="الوصول" type="time" dir="ltr" value={fl.arrive_time ?? ""} onChange={(e) => up({ arrive_time: e.target.value || null })} />
                  <Button size="sm" variant="ghost" className="h-11 text-danger" aria-label={`حذف الرحلة ${i + 1}`} onClick={() => set("flights", f.flights.filter((x) => x.key !== fl.key))}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">اختياري: أضف أرقام الرحلات وأوقاتها إن كانت معروفة.</p>
        )}
      </div>

      {fixed ? (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-brand-950">مواعيد السفر وعدد المقاعد</p>
              <p className="text-xs text-muted">المقاعد المتاحة = الإجمالي − المحجوز خارج الموقع − الطلبات المؤكدة. تأكيد الطلبات يحجز المقاعد تلقائياً.</p>
            </div>
            <Button
              size="sm"
              variant="subtle"
              data-add-departure
              onClick={() => {
                const start = addDays(todayDay(), 30);
                set("departures", [...f.departures, { key: newKey(), depart_date: start, return_date: addDays(start, Math.max(0, f.duration_days - 1)), seats_total: 30, seats_held: 0, price_supplement: 0, status: "open", note_ar: null, note_en: null }]);
              }}
            >
              <Plus className="size-4" aria-hidden="true" /> موعد سفر
            </Button>
          </div>
          {f.departures.length ? (
            <ul role="list" className="grid gap-3">
              {f.departures.map((d) => {
                const up = (patch: Partial<DepartureForm>) => set("departures", f.departures.map((x) => (x.key === d.key ? { ...x, ...patch } : x)));
                const nights = d.depart_date && d.return_date ? daysBetween(d.depart_date, d.return_date) : 0;
                return (
                  <li key={d.key} className="rounded-xl border border-line p-3" data-departure-row>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_7rem_7rem_9rem_9rem_auto] lg:items-end">
                      <Field label="تاريخ المغادرة">
                        <Input type="date" dir="ltr" className="num" value={d.depart_date} onChange={(e) => up({ depart_date: e.target.value, return_date: d.return_date < e.target.value ? addDays(e.target.value, Math.max(0, f.duration_days - 1)) : d.return_date })} data-depart-date />
                      </Field>
                      <Field label="تاريخ العودة" hint={nights ? `${nights + 1} أيام / ${nights} ليالٍ` : undefined}>
                        <Input type="date" dir="ltr" className="num" min={d.depart_date} value={d.return_date} onChange={(e) => up({ return_date: e.target.value })} data-return-date />
                      </Field>
                      <Field label="المقاعد">
                        <NumberInput min={1} max={2000} value={d.seats_total} onChange={(v) => up({ seats_total: v ?? 1 })} aria-label="المقاعد" />
                      </Field>
                      <Field label="خارج الموقع">
                        <NumberInput min={0} max={2000} value={d.seats_held} onChange={(v) => up({ seats_held: v ?? 0 })} aria-label="المحجوز خارج الموقع" />
                      </Field>
                      <Field label="فرق السعر (±)" hint="يُضاف لكل خيار">
                        <Input
                          dir="ltr"
                          className="num"
                          inputMode="decimal"
                          defaultValue={d.price_supplement ? String(d.price_supplement / 100) : ""}
                          disabled={!rights.pricing}
                          onChange={(e) => {
                            const n = Number(e.target.value.replace(/,/g, ""));
                            up({ price_supplement: Number.isFinite(n) ? Math.round(n * 100) : 0 });
                          }}
                        />
                      </Field>
                      <Field label="الحالة">
                        <Select value={d.status} onChange={(e) => up({ status: e.target.value as DepartureStatus })}>
                          {DEPARTURE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {DEPARTURE_STATUS_LABELS[s].ar}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Button size="sm" variant="ghost" className="h-11 text-danger" aria-label="حذف الموعد" disabled={!!d.confirmed} title={d.confirmed ? "عليه طلبات مؤكدة: غيّر حالته إلى ملغى" : undefined} onClick={() => set("departures", f.departures.filter((x) => x.key !== d.key))}>
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                    {d.code ? (
                      <p className="mt-2 text-xs text-muted">
                        <span className="num">{d.code}</span> · مؤكد: <span className="num font-bold">{d.confirmed ?? 0}</span> · متاح: <span className="num font-bold">{Math.max(0, d.seats_total - d.seats_held - (d.confirmed ?? 0))}</span>
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">البرنامج العام يحتاج موعد سفر واحداً على الأقل قبل النشر.</p>
          )}
        </div>
      ) : null}
    </StepCard>
  );

  const stepHotels = (
    <StepCard
      title="3. اختيار الفنادق من المكتبة"
      description={fixed ? "أضف أكثر من فندق للبرنامج نفسه (مثلاً 3 و4 و5 نجوم) ليقارن المسافر ويختار. لا حاجة لإنشاء برنامج لكل فندق." : "فنادق مقترحة تظهر للمسافر دون أسعار؛ السعر النهائي يُحدد في عرض السعر."}
      actions={
        rights.pricing ? (
          <Button variant="primary" size="sm" onClick={() => setPicker(true)} data-open-hotel-picker>
            <Plus className="size-4" aria-hidden="true" /> إضافة فندق من المكتبة
          </Button>
        ) : null
      }
    >
      <PricingLocked locked={!rights.pricing}>
        {f.options.length ? (
          <ul role="list" className="grid gap-3">
            {f.options.map((o, i) => {
              const h = hotelById.get(o.hotel_id);
              return (
                <li key={o.key} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3" data-option-row>
                  <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <BedDouble className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-brand-950">
                      {h?.name ?? `فندق #${o.hotel_id}`}{" "}
                      {h?.stars ? (
                        <span className="inline-flex align-middle text-accent-500">
                          {Array.from({ length: h.stars }, (_, s) => (
                            <Star key={s} className="size-3.5 fill-current" aria-hidden="true" />
                          ))}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted">
                      {h?.city} · {o.room_ar ?? "—"} · {o.source === "library" ? "سعر من المكتبة" : "سعر خاص بهذا البرنامج"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" aria-label="تقديم" disabled={i === 0} onClick={() => set("options", move(f.options, i, -1))}>
                      <ArrowUp className="size-4" aria-hidden="true" />
                    </Button>
                    <Button size="sm" variant="ghost" aria-label="تأخير" disabled={i === f.options.length - 1} onClick={() => set("options", move(f.options, i, 1))}>
                      <ArrowDown className="size-4" aria-hidden="true" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-danger" aria-label="حذف الخيار" onClick={() => set("options", f.options.filter((x) => x.key !== o.key))}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">لم تُضف فنادق بعد. اضغط «إضافة فندق من المكتبة».</p>
        )}
      </PricingLocked>
    </StepCard>
  );

  const stepRooms = (
    <StepCard title="4. أسعار الغرف والليالي" description="لكل فندق: نوع الغرفة وعدد الأشخاص والليالي وسعر الليلة. السعر منسوخ من المكتبة ويمكن تعديله لهذا البرنامج فقط دون تغيير سعر المكتبة.">
      <PricingLocked locked={!rights.pricing}>
        <Field label="عملة البرنامج" htmlFor="p-currency" hint="كل أسعار البرنامج بهذه العملة. أسعار الفنادق بعملة أخرى تحتاج سعر صرف صريحاً.">
          <Select id="p-currency" value={f.currency} onChange={(e) => set("currency", e.target.value)} className="max-w-xs">
            {options.currencies.map((c) => (
              <option key={c} value={c}>
                {CURRENCIES[c as CurrencyCode]?.nameAr ?? c} ({c})
              </option>
            ))}
          </Select>
        </Field>
        {f.options.length ? (
          <ul role="list" className="grid gap-4">
            {f.options.map((o) => {
              const h = hotelById.get(o.hotel_id);
              const libRate = o.rate_id ? h?.rates.find((r) => r.id === o.rate_id) : null;
              const libChanged = libRate && o.snapshot && (libRate.price !== o.snapshot.price || libRate.currency !== o.snapshot.currency);
              const foreign = o.source === "library" && o.snapshot && o.snapshot.currency !== currency;
              const pp = hotelPerPerson({ ...optionPricing(o) });
              return (
                <li key={o.key} className="rounded-2xl border border-line p-4" data-room-pricing>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-extrabold text-brand-950">{h?.name}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        aria-label="مصدر السعر"
                        value={o.source}
                        className="h-9 w-auto text-sm"
                        onChange={(e) => setOption(o.key, { source: e.target.value as OptionForm["source"], rate_id: e.target.value === "custom" ? null : o.rate_id })}
                      >
                        <option value="library" disabled={!h?.rates.length}>
                          سعر من المكتبة
                        </option>
                        <option value="custom">سعر خاص بهذا البرنامج</option>
                      </Select>
                      {o.source === "library" && h?.rates.length ? (
                        <Select
                          aria-label="سعر المكتبة"
                          value={o.rate_id ?? ""}
                          className="h-9 w-auto text-sm"
                          onChange={(e) => {
                            const r = h.rates.find((x) => x.id === e.target.value);
                            if (!r) return;
                            const room = h.room_types.find((x) => x.id === r.room_type_id);
                            setOption(o.key, {
                              v: o.v + 1,
                              rate_id: r.id,
                              refresh_rate: true,
                              room_type_id: r.room_type_id,
                              room_ar: room?.name_ar ?? o.room_ar,
                              room_en: room?.name_en ?? o.room_en,
                              basis: r.basis,
                              occupancy: r.occupancy,
                              board: r.board,
                              snapshot: { currency: r.currency, price: r.price, cost: r.cost, captured_at: new Date().toISOString() },
                              night_price: r.currency === currency ? r.price : o.fx_rate ? convert(r.price, o.fx_rate) : null,
                              night_cost: r.cost == null ? null : r.currency === currency ? r.cost : o.fx_rate ? convert(r.cost, o.fx_rate) : null,
                            });
                          }}
                        >
                          <option value="">اختر السعر…</option>
                          {h.rates.map((r) => (
                            <option key={r.id} value={r.id}>
                              {h.room_types.find((x) => x.id === r.room_type_id)?.name_ar} · {r.board ? BOARD_LABELS[r.board].ar : "—"} · {formatMoney(r.price, r.currency, "ar")} {RATE_BASIS_LABELS[r.basis].ar}
                              {r.season_ar ? ` · ${r.season_ar}` : ""}
                            </option>
                          ))}
                        </Select>
                      ) : null}
                    </div>
                  </div>
                  {o.source === "library" && o.snapshot ? (
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <History className="size-3.5" aria-hidden="true" /> سعر المكتبة المحفوظ في هذا البرنامج: <span className="num font-bold text-brand-900">{formatMoney(o.snapshot.price, o.snapshot.currency, "ar")}</span> ({formatDay(o.snapshot.captured_at.slice(0, 10), "ar")})
                      {libChanged ? (
                        <>
                          <Badge tone="accent">تغيّر سعر المكتبة إلى {formatMoney(libRate!.price, libRate!.currency, "ar")}</Badge>
                          <Button size="sm" variant="subtle" className="h-7" onClick={() => refreshFromLibrary(o)}>
                            <RefreshCw className="size-3.5" aria-hidden="true" /> تحديث من المكتبة
                          </Button>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                  {foreign ? (
                    <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl bg-accent-50 p-3 text-sm">
                      <p className="font-bold text-accent-700">
                        سعر الفندق بعملة {o.snapshot!.currency} وعملة البرنامج {currency}: أدخل سعر الصرف (1 {o.snapshot!.currency} = ؟ {currency}).
                      </p>
                      <Input
                        aria-label="سعر الصرف"
                        dir="ltr"
                        inputMode="decimal"
                        className="num h-10 w-36"
                        defaultValue={o.fx_rate ?? ""}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          applyFx(o, Number.isFinite(n) && n > 0 ? n : null);
                        }}
                        data-fx
                      />
                    </div>
                  ) : null}
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_6rem_6rem_8rem_9rem_9rem]">
                    <Field label="نوع الغرفة">
                      <Input value={o.room_ar ?? ""} onChange={(e) => setOption(o.key, { room_ar: e.target.value || null })} />
                    </Field>
                    <Field label="الوجبات">
                      <Select value={o.board ?? ""} onChange={(e) => setOption(o.key, { board: (e.target.value || null) as Board | null })}>
                        <option value="">—</option>
                        {BOARDS.map((b) => (
                          <option key={b} value={b}>
                            {BOARD_LABELS[b].ar}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="الأشخاص">
                      <NumberInput min={1} max={20} value={o.occupancy} onChange={(v) => setOption(o.key, { occupancy: v ?? 1 })} aria-label="عدد الأشخاص في الغرفة" />
                    </Field>
                    <Field label="الليالي">
                      <NumberInput min={1} max={90} value={o.nights} onChange={(v) => setOption(o.key, { nights: v ?? 1 })} aria-label="عدد الليالي" />
                    </Field>
                    <Field label="نوع السعر">
                      <Select value={o.basis} onChange={(e) => setOption(o.key, { basis: e.target.value as OptionForm["basis"] })}>
                        <option value="per_room">للغرفة</option>
                        <option value="per_person">للشخص</option>
                      </Select>
                    </Field>
                    <Field label={`سعر الليلة (${currency})`}>
                      <MoneyInput key={`p-${o.key}-${o.v}`} value={o.night_price} onChange={(v) => setOption(o.key, { night_price: v })} aria-label="سعر الليلة" />
                    </Field>
                    {rights.costs ? (
                      <Field label="التكلفة لليلة (داخلي)">
                        <MoneyInput key={`c-${o.key}-${o.v}`} value={o.night_cost} onChange={(v) => setOption(o.key, { night_cost: v })} aria-label="التكلفة لليلة" />
                      </Field>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm">
                    الإقامة للشخص: <span className="num font-black text-brand-700">{money(pp)}</span>
                    <span className="text-muted"> ({o.basis === "per_room" ? `${money(o.night_price)} × ${o.nights} ليالٍ ÷ ${o.occupancy} أشخاص` : `${money(o.night_price)} × ${o.nights} ليالٍ`})</span>
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">أضف الفنادق في الخطوة السابقة أولاً.</p>
        )}
      </PricingLocked>
    </StepCard>
  );

  const svcState = (id: number) => f.services.find((s) => s.service_id === id);
  const stepDays = (
    <StepCard
      title="5. البرنامج اليومي والخدمات"
      description="يوم بيوم، ثم الخدمات المشمولة وغير المشمولة والشروط والملاحظات."
      actions={
        <>
          {f.itinerary.length < f.duration_days ? (
            <Button size="sm" variant="primary" data-fill-days onClick={fillDays}>
              <Sparkles className="size-4" aria-hidden="true" /> تعبئة {f.itinerary.length ? "باقي " : ""}الأيام (<span className="num">{f.duration_days - f.itinerary.length}</span>)
            </Button>
          ) : null}
          <Button size="sm" variant="subtle" data-add-day onClick={() => set("itinerary", [...f.itinerary, { key: newKey(), title_ar: "", title_en: null, body_ar: null, body_en: null }])}>
            <Plus className="size-4" aria-hidden="true" /> يوم
          </Button>
        </>
      }
    >
      {f.itinerary.length ? (
        <ol className="grid gap-3">
          {f.itinerary.map((d, i) => {
            const up = (patch: Partial<WizardForm["itinerary"][number]>) => set("itinerary", f.itinerary.map((x) => (x.key === d.key ? { ...x, ...patch } : x)));
            return (
              <li key={d.key} className="rounded-xl border border-line p-3" data-day-row>
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-extrabold text-brand-950">
                    اليوم <span className="num">{i + 1}</span>
                  </p>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" aria-label="تقديم" disabled={i === 0} onClick={() => set("itinerary", move(f.itinerary, i, -1))}>
                      <ArrowUp className="size-4" aria-hidden="true" />
                    </Button>
                    <Button size="sm" variant="ghost" aria-label="تأخير" disabled={i === f.itinerary.length - 1} onClick={() => set("itinerary", move(f.itinerary, i, 1))}>
                      <ArrowDown className="size-4" aria-hidden="true" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-danger" aria-label="حذف اليوم" onClick={() => set("itinerary", f.itinerary.filter((x) => x.key !== d.key))}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3">
                  <Bilingual label="عنوان اليوم" ar={d.title_ar} en={d.title_en} onAr={(v) => up({ title_ar: v })} onEn={(v) => up({ title_en: v || null })} errorAr={err(`itinerary.${i}.title_ar`)} maxLength={160} />
                  <Bilingual label="التفاصيل" multiline rows={2} ar={d.body_ar} en={d.body_en} onAr={(v) => up({ body_ar: v || null })} onEn={(v) => up({ body_en: v || null })} />
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          لا توجد أيام بعد. اضغط «تعبئة الأيام» لإنشاء {f.duration_days} أيام بعناوين مقترحة من الوجهات المختارة بالترتيب، ثم عدّلها.
        </p>
      )}

      <div>
        <p className="mb-2 text-sm font-bold text-brand-950">الخدمات المشمولة وغير المشمولة</p>
        <ul role="list" className="grid gap-2 md:grid-cols-2">
          {options.services.map((s) => {
            const st = svcState(s.id);
            const value = st ? (st.included ? "in" : "out") : "";
            return (
              <li key={s.id} className="grid gap-2 rounded-xl border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-brand-950">{s.name_ar}</span>
                  <Select
                    aria-label={`حالة ${s.name_ar}`}
                    value={value}
                    className="h-9 w-40 text-sm"
                    onChange={(e) => {
                      const v = e.target.value;
                      const rest = f.services.filter((x) => x.service_id !== s.id);
                      set("services", v ? [...rest, { service_id: s.id, included: v === "in", note_ar: st?.note_ar ?? null, note_en: st?.note_en ?? null }] : rest);
                    }}
                    data-service={s.id}
                  >
                    <option value="">لا يُذكر</option>
                    <option value="in">مشمول</option>
                    <option value="out">غير مشمول</option>
                  </Select>
                </div>
                {st ? <Input aria-label={`ملاحظة ${s.name_ar}`} value={st.note_ar ?? ""} placeholder="ملاحظة (اختياري)" className="h-9 text-sm" onChange={(e) => set("services", f.services.map((x) => (x.service_id === s.id ? { ...x, note_ar: e.target.value || null } : x)))} /> : null}
              </li>
            );
          })}
        </ul>
      </div>
      <Bilingual label="الوجبات" ar={f.meals_ar} en={f.meals_en} onAr={(v) => set("meals_ar", v || null)} onEn={(v) => set("meals_en", v || null)} maxLength={200} />
      <Bilingual label="الشروط والملاحظات" multiline rows={4} ar={f.terms_ar} en={f.terms_en} onAr={(v) => set("terms_ar", v || null)} onEn={(v) => set("terms_en", v || null)} />
    </StepCard>
  );

  const stepPrices = (
    <StepCard title="6. الأسعار النهائية" description={fixed ? "السعر النهائي للشخص لكل فندق = السعر الأساسي (الطيران والنقل والجولات…) + حصة الشخص من الفندق. يُحسب تلقائياً، ويمكن تعديله يدوياً بصلاحية." : "البرنامج الخاص لا يعرض سعراً نهائياً للمسافر. السعر يُحدد في عرض السعر بعد اعتماد الموظف."}>
      {fixed ? (
        <PricingLocked locked={!rights.pricing}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={`السعر الأساسي للشخص (${currency})`} hint="كل الخدمات عدا الفندق: الطيران، النقل، الجولات، التأشيرة…">
              <MoneyInput value={f.base_price} onChange={(v) => set("base_price", v)} aria-label="السعر الأساسي" />
            </Field>
            {rights.costs ? (
              <Field label="التكلفة الأساسية للشخص (داخلي)" hint="لا تظهر للعملاء أبداً.">
                <MoneyInput value={f.base_cost} onChange={(v) => set("base_cost", v)} aria-label="التكلفة الأساسية" />
              </Field>
            ) : null}
            <Bilingual label="ملاحظة السعر" hint="مثال: للشخص في غرفة مزدوجة" ar={f.price_note_ar} en={f.price_note_en} onAr={(v) => set("price_note_ar", v || null)} onEn={(v) => set("price_note_en", v || null)} maxLength={120} />
          </div>
          {f.options.length ? (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[46rem] text-sm [&_td]:border-t [&_td]:border-line [&_td]:px-3 [&_td]:py-2.5 [&_th]:bg-mist [&_th]:px-3 [&_th]:py-2 [&_th]:text-start [&_th]:text-xs [&_th]:text-muted">
                <thead>
                  <tr>
                    <th>الفندق والغرفة</th>
                    <th>الإقامة للشخص</th>
                    <th>السعر المحسوب</th>
                    <th>السعر النهائي اليدوي</th>
                    <th>السعر للمسافر</th>
                    {rights.costs ? <th>التكلفة / الهامش</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {f.options.map((o) => {
                    const op = optionPricing(o);
                    const m = optionMargin(pricing, op);
                    return (
                      <tr key={o.key} data-final-price-row>
                        <td>
                          <p className="font-bold text-brand-950">{hotelById.get(o.hotel_id)?.name}</p>
                          <p className="text-xs text-muted">{o.room_ar}</p>
                        </td>
                        <td className="num">{money(hotelPerPerson(op))}</td>
                        <td className="num">{money(computedOptionPrice(pricing, op))}</td>
                        <td className="w-40">
                          {rights.override ? (
                            <MoneyInput key={`o-${o.key}-${o.v}`} value={o.final_price_override} onChange={(v) => setOption(o.key, { final_price_override: v })} aria-label="السعر النهائي اليدوي" />
                          ) : (
                            <span className="text-xs text-muted">{o.final_price_override != null ? money(o.final_price_override) : "تلقائي"}</span>
                          )}
                        </td>
                        <td className="num font-black text-brand-700" data-traveler-price>
                          {money(optionPrice(pricing, op))}
                        </td>
                        {rights.costs ? (
                          <td className="num text-xs">
                            {m.cost == null ? <span className="text-muted">التكلفة غير مكتملة</span> : <span className={m.margin! < 0 ? "font-bold text-danger" : ""}>{money(m.cost)} / {money(m.margin)} ({m.marginPct!.toFixed(1)}%)</span>}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-brand-950">أسعار إضافية (اختياري)</p>
              <Button size="sm" variant="subtle" onClick={() => set("extra_prices", [...f.extra_prices, { key: newKey(), label_ar: "", label_en: null, amount: null }])}>
                <Plus className="size-4" aria-hidden="true" /> سعر إضافي
              </Button>
            </div>
            {f.extra_prices.map((x, i) => (
              <div key={x.key} className="mb-2 grid gap-2 sm:grid-cols-[1fr_1fr_10rem_auto] sm:items-end">
                <Field label="الوصف" error={err(`extra_prices.${i}.label_ar`)}>
                  <Input value={x.label_ar} placeholder="سعر الطفل (2–11 سنة)" onChange={(e) => set("extra_prices", f.extra_prices.map((y) => (y.key === x.key ? { ...y, label_ar: e.target.value } : y)))} />
                </Field>
                <Field label="English">
                  <Input dir="ltr" className="text-left" value={x.label_en ?? ""} onChange={(e) => set("extra_prices", f.extra_prices.map((y) => (y.key === x.key ? { ...y, label_en: e.target.value || null } : y)))} />
                </Field>
                <Field label="السعر">
                  <MoneyInput value={x.amount} onChange={(v) => set("extra_prices", f.extra_prices.map((y) => (y.key === x.key ? { ...y, amount: v } : y)))} aria-label="السعر الإضافي" />
                </Field>
                <Button size="sm" variant="ghost" className="h-11 text-danger" aria-label="حذف" onClick={() => set("extra_prices", f.extra_prices.filter((y) => y.key !== x.key))}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        </PricingLocked>
      ) : (
        <p className="rounded-xl bg-brand-50 px-4 py-4 text-sm leading-[1.9] text-brand-900">
          سيظهر للمسافر «السعر حسب طلبك». بعد وصول طلبه، افتح الطلب من «طلبات المسافرين» واضغط «إنشاء عرض سعر» لبناء عرض مخصص بفنادق المكتبة، ثم أرسل الرابط أو ملف PDF.
        </p>
      )}
    </StepCard>
  );

  const stepReview = (
    <StepCard title="7. المعاينة والنشر" description="راجع النواقص، ثم احفظ كمسودة أو انشر البرنامج.">
      <ul role="list" className="grid gap-2">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-2.5">
            <span className="flex items-center gap-2 font-bold">
              {c.ok ? <Check className="size-4 text-[#17663a]" aria-hidden="true" /> : <CircleAlert className={`size-4 ${"optional" in c && c.optional ? "text-muted" : "text-accent-600"}`} aria-hidden="true" />}
              {c.label}
            </span>
            {!c.ok ? (
              <button type="button" className="text-sm font-bold text-brand-600 hover:underline" onClick={() => goTo(c.step)}>
                الانتقال للخطوة {c.step + 1}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <dl className="grid gap-3 rounded-2xl bg-mist p-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs font-bold text-muted">النوع</dt>
          <dd className="font-extrabold text-brand-950">{TYPE_LABELS[f.type].ar}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-muted">المدة</dt>
          <dd className="font-extrabold text-brand-950">
            {f.duration_days} أيام / {f.duration_nights} ليالٍ
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-muted">الفنادق</dt>
          <dd className="font-extrabold text-brand-950">{f.options.length}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold text-muted">{fixed ? "يبدأ من (للشخص)" : "السعر"}</dt>
          <dd className="num font-extrabold text-brand-700" data-review-price>
            {fixed ? money(from) : "حسب الطلب"}
          </dd>
        </div>
        <div className="sm:col-span-4">
          <dt className="text-xs font-bold text-muted">الوجهات</dt>
          <dd className="font-bold text-brand-950">
            {f.destination_ids.map((d) => options.destinations.find((x) => x.id === d)?.label).filter(Boolean).join("، ") || "—"}
            {destCountries.length ? ` (${destCountries.map((c) => options.destinations.find((d) => d.country_code === c)?.country ?? c).join("، ")})` : ""}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => save("save")} loading={saving === "save"} disabled={!!saving} data-save-draft>
          <Save className="size-4" aria-hidden="true" /> حفظ كمسودة
        </Button>
        {rights.publish ? (
          <Button variant="accent" onClick={() => save("publish")} loading={saving === "publish"} disabled={!!saving} data-publish>
            <Rocket className="size-4" aria-hidden="true" /> حفظ ونشر
          </Button>
        ) : null}
        {meta.id ? (
          <Link href={`/staff/preview/program/${meta.id}/`} target="_blank" prefetch={false} className="inline-flex h-11 items-center gap-2 rounded-xl px-4 font-bold text-brand-700 hover:bg-brand-50">
            <Eye className="size-4" aria-hidden="true" /> معاينة كما يراها المسافر
          </Link>
        ) : null}
      </div>
      {missing.length ? <p className="text-sm text-muted">يمكنك الحفظ كمسودة الآن؛ النشر يتطلب إكمال البنود أعلاه.</p> : null}
    </StepCard>
  );

  const steps = [stepBasics, stepTravel, stepHotels, stepRooms, stepDays, stepPrices, stepReview];

  return (
    <div className="grid gap-6 xl:grid-cols-[16rem_1fr]" data-wizard>
      {/* Stepper */}
      <nav aria-label="خطوات إنشاء البرنامج" className="xl:sticky xl:top-6 xl:self-start">
        <ol className="flex gap-2 overflow-x-auto pb-1 xl:grid xl:overflow-visible">
          {STEPS.map((s, i) => {
            const stepChecks = checks.filter((c) => c.step === i && !("optional" in c && c.optional));
            const done = visited.has(i) && stepChecks.every((c) => c.ok);
            return (
              <li key={s.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={step === i ? "step" : undefined}
                  data-step={i}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm font-bold transition-colors ${step === i ? "bg-brand-600 text-white" : "bg-white text-brand-900 ring-1 ring-line hover:bg-brand-50"}`}
                >
                  <span className={`num grid size-7 shrink-0 place-items-center rounded-full text-xs ${step === i ? "bg-white text-brand-700" : done ? "bg-[#e9f7ef] text-[#17663a]" : "bg-mist text-muted"}`}>
                    {done && step !== i ? <Check className="size-4" aria-hidden="true" /> : i + 1}
                  </span>
                  <span className="whitespace-nowrap xl:whitespace-normal">{s.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 hidden rounded-xl bg-white p-4 text-sm ring-1 ring-line xl:block">
          <p className="text-xs font-bold text-muted">{fixed ? "يبدأ من" : "النوع"}</p>
          <p className="num text-xl font-black text-brand-700">{fixed ? money(from) : "حسب الطلب"}</p>
          <p className="mt-2 text-xs text-muted">{dirty ? "تغييرات غير محفوظة (محفوظة مؤقتاً على هذا الجهاز)" : "كل التغييرات محفوظة"}</p>
        </div>
      </nav>

      <div className="grid min-w-0 gap-4">
        {restore ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm font-bold text-accent-700">
            <span>توجد نسخة غير محفوظة من عملك على هذا الجهاز ({formatDay(restore.at.slice(0, 10), "ar")}).</span>
            <span className="flex gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setF(restore.form);
                  setRestore(null);
                  setDirty(true);
                  setVersion((v) => v + 1);
                }}
              >
                استعادة
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setRestore(null);
                  try {
                    localStorage.removeItem(storageKey);
                  } catch {
                    /* ignore */
                  }
                }}
              >
                تجاهل
              </Button>
            </span>
          </div>
        ) : null}

        <div key={version}>{steps[step]}</div>

        <div className="sticky bottom-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white/95 px-4 py-3 shadow-[0_-10px_30px_-20px_rgb(5_28_51/0.5)] backdrop-blur">
          <Button variant="ghost" disabled={step === 0} onClick={() => goTo(step - 1)}>
            السابق
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => save("save")} loading={saving === "save"} disabled={!!saving} data-save-anywhere>
              <Save className="size-4" aria-hidden="true" /> حفظ كمسودة
            </Button>
            {step < STEPS.length - 1 ? (
              <Button variant="primary" onClick={() => goTo(step + 1)} data-next-step>
                التالي: {STEPS[step + 1].title}
              </Button>
            ) : rights.publish ? (
              <Button variant="accent" onClick={() => save("publish")} loading={saving === "publish"} disabled={!!saving}>
                <Rocket className="size-4" aria-hidden="true" /> حفظ ونشر
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <HotelPicker open={picker} onClose={() => setPicker(false)} hotels={options.hotels} countries={destCountries} destinationIds={f.destination_ids} programCurrency={currency} onAdd={addOption} showCosts={rights.costs} />
    </div>
  );
}

// ------------------------------------------------------------------ Hotel picker (library)
function HotelPicker({
  open,
  onClose,
  hotels,
  countries,
  destinationIds,
  programCurrency,
  onAdd,
  showCosts,
}: {
  open: boolean;
  onClose: () => void;
  hotels: CatalogOptions["hotels"];
  countries: string[];
  destinationIds: number[];
  programCurrency: string;
  onAdd: (hotelId: number, rateId: string | null) => void;
  showCosts: boolean;
}) {
  const [q, setQ] = useState("");
  const inCities = hotels.some((h) => destinationIds.includes(h.destination_id));
  const [scopeChoice, setScope] = useState<"cities" | "countries" | "all" | null>(null);
  const scope = scopeChoice ?? (inCities ? "cities" : countries.length ? "countries" : "all");
  const [stars, setStars] = useState<number | null>(null);
  const list = hotels.filter(
    (h) =>
      (scope === "all" || (scope === "cities" ? destinationIds.includes(h.destination_id) : !countries.length || countries.includes(h.country_code))) &&
      (!stars || h.stars === stars) &&
      (!q || `${h.name} ${h.name_en} ${h.city}`.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <Modal open={open} onClose={onClose} title="اختيار فندق من المكتبة" wide>
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_9rem_10rem]">
        <label className="relative">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted" aria-hidden="true" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم الفندق أو المدينة…" className="ps-9" aria-label="بحث" data-picker-search />
        </label>
        <Select aria-label="النجوم" value={stars ?? ""} onChange={(e) => setStars(e.target.value ? Number(e.target.value) : null)}>
          <option value="">كل النجوم</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} نجوم
            </option>
          ))}
        </Select>
        <Select aria-label="نطاق الفنادق" value={scope} onChange={(e) => setScope(e.target.value as "cities" | "countries" | "all")} data-picker-scope>
          {destinationIds.length ? <option value="cities">مدن البرنامج</option> : null}
          {countries.length ? <option value="countries">دول البرنامج</option> : null}
          <option value="all">كل الفنادق</option>
        </Select>
      </div>
      {list.length ? (
        <ul role="list" className="grid gap-3">
          {list.map((h) => (
            <li key={h.id} className="rounded-xl border border-line p-3" data-picker-hotel={h.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-brand-950">
                    {h.name}{" "}
                    {h.stars ? (
                      <span className="inline-flex align-middle text-accent-500">
                        {Array.from({ length: h.stars }, (_, s) => (
                          <Star key={s} className="size-3.5 fill-current" aria-hidden="true" />
                        ))}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted">
                    {h.city} · {countryName(h.country_code, "ar")} {h.hasLink ? "" : "· بلا رابط رسمي"}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => onAdd(h.id, null)}>
                  إضافة بسعر خاص
                </Button>
              </div>
              {h.rates.length ? (
                <ul role="list" className="mt-2 grid gap-1.5">
                  {h.rates.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-mist px-3 py-2 text-sm">
                      <span>
                        <span className="font-bold text-brand-950">{h.room_types.find((x) => x.id === r.room_type_id)?.name_ar}</span>
                        <span className="text-muted">
                          {" "}
                          · {r.board ? BOARD_LABELS[r.board].ar : "—"} · {r.occupancy} أشخاص · {RATE_BASIS_LABELS[r.basis].ar}
                          {r.season_ar ? ` · ${r.season_ar}` : ""}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="num font-black text-brand-700">{formatMoney(r.price, r.currency, "ar")}</span>
                        {showCosts && r.cost != null ? <span className="num text-xs text-muted">تكلفة {formatMoney(r.cost, r.currency, "ar")}</span> : null}
                        {r.currency !== programCurrency ? <Badge tone="accent">{r.currency}</Badge> : null}
                        <Button size="sm" variant="primary" onClick={() => onAdd(h.id, r.id)} data-add-rate-option={r.id}>
                          <Plus className="size-3.5" aria-hidden="true" /> إضافة
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted">لا توجد أسعار محفوظة لهذا الفندق في المكتبة.</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-sm text-muted">
          لا توجد فنادق مطابقة.{" "}
          <Link href="/staff/hotels/new/" target="_blank" className="font-bold text-brand-600 underline">
            أضف فندقاً جديداً للمكتبة
          </Link>
        </p>
      )}
    </Modal>
  );
}
