"use client";

import {
  Archive,
  ArrowDown,
  ArrowUp,
  CalendarPlus,
  Copy,
  Eye,
  Pause,
  Plus,
  Rocket,
  Save,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ServiceIcon } from "@/components/travel/ServiceIcon";
import { addDays, daysBetween, todayDay } from "@/lib/dates";
import { asset } from "@/lib/asset";
import type { MediaRef } from "@/lib/media";
import { CURRENCIES, formatMoney, type CurrencyCode } from "@/lib/money";
import {
  BOARD_LABELS,
  BOARDS,
  DEPARTURE_STATUS_LABELS,
  DEPARTURE_STATUSES,
  KIND_LABELS,
  type Board,
  type DepartureStatus,
  type ProgramKind,
  type ProgramStatus,
} from "@/lib/travel-labels";
import { deleteProgramAction, duplicateProgramAction, saveProgramAction, setProgramStatusAction } from "@/server/actions/programs";
import { Bilingual, MoneyInput, NumberInput } from "./fields";
import { ImagePicker } from "./ImagePicker";
import { ProgramStatusBadge } from "./StatusBadge";
import { Badge, Button, Card, CardHeader, Field, Input, inputClass, Select, Toggle } from "./ui";
import { useActionRunner } from "./useActionRunner";

export interface ProgramFormState {
  kind: ProgramKind;
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
  price_note_ar: string | null;
  price_note_en: string | null;
  meals_ar: string | null;
  meals_en: string | null;
  terms_ar: string | null;
  terms_en: string | null;
  cover: MediaRef | null;
  gallery: MediaRef[];
  prices: { label_ar: string; label_en: string | null; amount: number | null }[];
  days: { title_ar: string; title_en: string | null; body_ar: string | null; body_en: string | null }[];
  hotels: { hotel_id: number | null; nights: number; room_ar: string | null; room_en: string | null; board: Board | null }[];
  services: Record<number, { state: "included" | "excluded" | "none"; note_ar: string | null; note_en: string | null }>;
  departures: {
    key: string;
    id?: number;
    code?: string;
    confirmed?: number;
    depart_date: string;
    return_date: string;
    seats_total: number;
    seats_held: number;
    price: number | null;
    status: DepartureStatus;
    note_ar: string | null;
    note_en: string | null;
  }[];
}

export interface ProgramMeta {
  id: number;
  code: string;
  slug: string;
  status: ProgramStatus;
  view_count: number;
  leads: number;
}

interface Props {
  initial: ProgramFormState;
  meta: ProgramMeta | null;
  destinations: { id: number; label: string; country: string }[];
  hotels: { id: number; name: string; destination: string; destination_id: number; stars: number | null }[];
  services: { id: number; icon: string; name_ar: string }[];
  currencies: string[];
  permissions: { publish: boolean; delete: boolean };
  publicUrl: string | null;
}

const SECTIONS = [
  ["basics", "المعلومات الأساسية"],
  ["media", "الصور"],
  ["pricing", "الأسعار"],
  ["hotels", "الفنادق والسكن"],
  ["itinerary", "البرنامج اليومي"],
  ["services", "الخدمات المشمولة"],
  ["departures", "الكروبات والمواعيد"],
  ["terms", "الوجبات والشروط"],
] as const;

let keySeq = 0;
const newKey = () => `n${++keySeq}`;

function Section({ id, title, description, children, actions }: { id: string; title: string; description?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-6" aria-labelledby={`${id}-title`}>
      <CardHeader id={`${id}-title`} title={title} description={description} actions={actions} />
      <div className="p-5">{children}</div>
    </Card>
  );
}

function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function ProgramEditor({ initial, meta, destinations, hotels, services, currencies, permissions, publicUrl }: Props) {
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { run, pending } = useActionRunner();
  // Unsaved changes = the form differs from what was last loaded from the server.
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const dirty = useMemo(() => JSON.stringify(f) !== saved, [f, saved]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof ProgramFormState>(k: K, v: ProgramFormState[K]) => setF((x) => ({ ...x, [k]: v }));
  const currency = f.currency as CurrencyCode;

  const payload = () => ({
    kind: f.kind,
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
    price_note_ar: f.price_note_ar,
    price_note_en: f.price_note_en,
    meals_ar: f.meals_ar,
    meals_en: f.meals_en,
    terms_ar: f.terms_ar,
    terms_en: f.terms_en,
    cover_media_id: f.cover?.id ?? null,
    gallery: f.gallery.map((m) => m.id),
    prices: f.prices.map((p) => ({ ...p, amount: p.amount ?? 0 })),
    days: f.days,
    hotels: f.hotels.filter((h) => h.hotel_id).map((h) => ({ ...h, hotel_id: h.hotel_id! })),
    services: Object.entries(f.services)
      .filter(([, s]) => s.state !== "none")
      .map(([sid, s]) => ({ service_id: Number(sid), included: s.state === "included", note_ar: s.note_ar, note_en: s.note_en })),
    departures: f.departures.map((d) => ({
      id: d.id,
      depart_date: d.depart_date,
      return_date: d.return_date,
      seats_total: d.seats_total,
      seats_held: d.seats_held,
      price: d.price,
      status: d.status,
      note_ar: d.note_ar,
      note_en: d.note_en,
    })),
  });

  const save = (intent: "save" | "publish") =>
    run(() => saveProgramAction({ id: meta?.id ?? null, intent, program: payload() }), {
      onOk: (data) => {
        setErrors({});
        setSaved(JSON.stringify(f));
        if (!meta) router.replace(`/staff/programs/${data.id}/`);
      },
      onError: (r) => {
        setErrors(r.fieldErrors ?? {});
        const saved = r.fieldErrors?._saved;
        if (saved) {
          setSaved(JSON.stringify(f));
          if (!meta) router.replace(`/staff/programs/${saved}/`);
          else router.refresh();
        }
      },
    });

  const err = (path: string) => errors[`program.${path}`];
  const errorList = Object.entries(errors).filter(([k]) => k !== "_saved");

  const hotelsByDest = useMemo(() => {
    const map = new Map<string, Props["hotels"]>();
    for (const h of hotels) map.set(h.destination, [...(map.get(h.destination) ?? []), h]);
    return [...map.entries()];
  }, [hotels]);

  const minPrice = useMemo(() => {
    const amounts = [...f.prices.slice(0, 1).map((p) => p.amount ?? 0), ...f.departures.map((d) => d.price ?? 0)].filter((n) => n > 0);
    return amounts.length ? Math.min(...amounts) : null;
  }, [f.prices, f.departures]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_19rem]">
      <div className="grid min-w-0 gap-6">
        {errorList.length ? (
          <div role="alert" className="rounded-2xl border border-danger/25 bg-[#fdeeee] p-4 text-sm text-[#a42424]">
            <p className="font-extrabold">يرجى تصحيح ما يلي:</p>
            <ul className="mt-1 list-disc ps-5">
              {errorList.slice(0, 8).map(([k, v]) => (
                <li key={k}>{v}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <Section id="basics" title="المعلومات الأساسية">
          <div className="grid gap-5">
            <fieldset>
              <legend className="mb-2 text-sm font-bold text-brand-950">نوع العرض</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["package", "group"] as const).map((k) => (
                  <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${f.kind === k ? "border-brand-600 bg-brand-50/60 ring-2 ring-brand-100" : "border-line hover:border-brand-200"}`}>
                    <input type="radio" name="kind" value={k} checked={f.kind === k} onChange={() => set("kind", k)} className="mt-1 accent-brand-600" />
                    <span>
                      <span className="block font-bold text-brand-950">{KIND_LABELS[k].ar}</span>
                      <span className="mt-0.5 block text-xs leading-[1.7] text-muted">
                        {k === "package" ? "تواريخ مرنة يختارها المسافر، مثل باقات شهر العسل والعائلات." : "رحلة جماعية بمواعيد انطلاق وعودة ثابتة وعدد مقاعد محدد."}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <Bilingual label="عنوان البرنامج" required ar={f.title_ar} en={f.title_en} onAr={(v) => set("title_ar", v)} onEn={(v) => set("title_en", v)} errorAr={err("title_ar")} maxLength={140} name="title" />
            <Bilingual label="وصف مختصر للبطاقة" hint="جملة أو جملتان تظهران في بطاقة العرض (حتى 320 حرفاً)." ar={f.summary_ar} en={f.summary_en} onAr={(v) => set("summary_ar", v)} onEn={(v) => set("summary_en", v)} multiline rows={2} maxLength={320} name="summary" />
            <Bilingual label="الوصف التفصيلي" ar={f.description_ar} en={f.description_en} onAr={(v) => set("description_ar", v)} onEn={(v) => set("description_en", v)} multiline rows={6} name="description" />

            <fieldset>
              <legend className="mb-2 text-sm font-bold text-brand-950">
                الوجهات <span className="text-accent-700">*</span>
              </legend>
              {destinations.length ? (
                <div className="flex flex-wrap gap-2">
                  {destinations.map((d) => {
                    const on = f.destination_ids.includes(d.id);
                    return (
                      <label key={d.id} className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-bold transition-colors ${on ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white text-brand-900 hover:border-brand-300"}`}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={on}
                          onChange={() => set("destination_ids", on ? f.destination_ids.filter((x) => x !== d.id) : [...f.destination_ids, d.id])}
                        />
                        {d.label} <span className={on ? "text-white/70" : "text-muted"}>· {d.country}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted">أضف الوجهات أولاً من صفحة «الوجهات».</p>
              )}
              {err("destination_ids") ? <p className="mt-1.5 text-xs font-bold text-danger">{err("destination_ids")}</p> : null}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="عدد الأيام" required htmlFor="p-days" error={err("duration_days")}>
                <NumberInput id="p-days" min={1} max={90} value={f.duration_days} onChange={(v) => set("duration_days", v ?? 1)} />
              </Field>
              <Field label="عدد الليالي" required htmlFor="p-nights" error={err("duration_nights")}>
                <NumberInput id="p-nights" min={0} max={90} value={f.duration_nights} onChange={(v) => set("duration_nights", v ?? 0)} />
              </Field>
              <Field label="الرابط المختصر (اختياري)" htmlFor="p-slug" hint="يُولَّد من العنوان الإنجليزي إن تُرك فارغاً." error={err("slug")}>
                <Input id="p-slug" dir="ltr" value={f.slug ?? ""} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="istanbul-winter-7-days" className="text-left" />
              </Field>
            </div>
            <Toggle id="p-featured" checked={f.featured} onChange={(v) => set("featured", v)} label="عرض مميز" description="يظهر أولاً في صفحة العروض وفي الصفحة الرئيسية." />
          </div>
        </Section>

        <Section id="media" title="الصور" description="صور كبيرة وواضحة للوجهة. صورة الغلاف إلزامية للنشر.">
          <div className="grid gap-6">
            <ImagePicker label="صورة الغلاف" max={1} value={f.cover ? [f.cover] : []} onChange={(v) => set("cover", v[0] ?? null)} />
            <ImagePicker label="معرض الصور" max={30} value={f.gallery} onChange={(v) => set("gallery", v)} />
          </div>
        </Section>

        <Section
          id="pricing"
          title="الأسعار"
          description="السعر الأول هو السعر الرئيسي («يبدأ من») في البطاقة. أضف بعده خيارات أخرى مثل الغرفة المفردة أو سعر الطفل."
          actions={minPrice != null ? <Badge tone="brand">يبدأ من {formatMoney(minPrice, currency, "ar")}</Badge> : null}
        >
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
              <Field label="العملة" htmlFor="p-currency">
                <Select id="p-currency" value={f.currency} onChange={(e) => set("currency", e.target.value)}>
                  {currencies.map((c) => (
                    <option key={c} value={c}>
                      {CURRENCIES[c as CurrencyCode]?.nameAr ?? c} ({c})
                    </option>
                  ))}
                </Select>
              </Field>
              <Bilingual label="ملاحظة السعر" hint="مثال: للشخص الواحد في غرفة مزدوجة" ar={f.price_note_ar} en={f.price_note_en} onAr={(v) => set("price_note_ar", v)} onEn={(v) => set("price_note_en", v)} maxLength={120} />
            </div>
            <ul role="list" className="grid gap-3">
              {f.prices.map((p, i) => (
                <li key={i} className="grid items-end gap-3 rounded-xl border border-line p-3 sm:grid-cols-[1fr_1fr_10rem_auto]">
                  <Field label="الوصف" htmlFor={`price-ar-${i}`} error={err(`prices.${i}.label_ar`)}>
                    <Input id={`price-ar-${i}`} value={p.label_ar} placeholder="للشخص في غرفة مزدوجة" onChange={(e) => set("prices", f.prices.map((x, j) => (j === i ? { ...x, label_ar: e.target.value } : x)))} />
                  </Field>
                  <Field label="English" htmlFor={`price-en-${i}`}>
                    <Input id={`price-en-${i}`} dir="ltr" className="text-left" value={p.label_en ?? ""} placeholder="Per person, double room" onChange={(e) => set("prices", f.prices.map((x, j) => (j === i ? { ...x, label_en: e.target.value } : x)))} />
                  </Field>
                  <Field label="السعر" htmlFor={`price-amt-${i}`} error={err(`prices.${i}.amount`)}>
                    <MoneyInput id={`price-amt-${i}`} currency={f.currency} value={p.amount} onChange={(v) => set("prices", f.prices.map((x, j) => (j === i ? { ...x, amount: v } : x)))} />
                  </Field>
                  <Button variant="ghost" className="text-danger" aria-label="حذف السعر" onClick={() => set("prices", f.prices.filter((_, j) => j !== i))}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
            <div>
              <Button variant="subtle" size="sm" onClick={() => set("prices", [...f.prices, { label_ar: "", label_en: null, amount: null }])}>
                <Plus className="size-4" aria-hidden="true" /> إضافة سعر
              </Button>
            </div>
          </div>
        </Section>

        <Section id="hotels" title="الفنادق والسكن" description="اختر الفنادق من القائمة المعتمدة. يصبح اسم كل فندق رابطاً في صفحة العرض.">
          <ul role="list" className="grid gap-3">
            {f.hotels.map((h, i) => (
              <li key={i} className="rounded-xl border border-line p-3">
                <div className="grid items-end gap-3 md:grid-cols-[1.4fr_6rem_1fr]">
                  <Field label={`الفندق ${i + 1}`} htmlFor={`hotel-${i}`}>
                    <Select id={`hotel-${i}`} value={h.hotel_id ?? ""} onChange={(e) => set("hotels", f.hotels.map((x, j) => (j === i ? { ...x, hotel_id: e.target.value ? Number(e.target.value) : null } : x)))}>
                      <option value="">اختر الفندق…</option>
                      {hotelsByDest.map(([dest, list]) => (
                        <optgroup key={dest} label={dest}>
                          {list.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name} {o.stars ? `(${o.stars}★)` : ""}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                  </Field>
                  <Field label="الليالي" htmlFor={`hotel-n-${i}`}>
                    <NumberInput id={`hotel-n-${i}`} min={1} value={h.nights} onChange={(v) => set("hotels", f.hotels.map((x, j) => (j === i ? { ...x, nights: v ?? 1 } : x)))} />
                  </Field>
                  <Field label="الوجبات" htmlFor={`hotel-b-${i}`}>
                    <Select id={`hotel-b-${i}`} value={h.board ?? ""} onChange={(e) => set("hotels", f.hotels.map((x, j) => (j === i ? { ...x, board: (e.target.value || null) as Board | null } : x)))}>
                      <option value="">غير محدد</option>
                      {BOARDS.map((b) => (
                        <option key={b} value={b}>
                          {BOARD_LABELS[b].ar}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <div className="mt-3 grid items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <Field label="نوع الغرفة" htmlFor={`hotel-r-${i}`}>
                    <Input id={`hotel-r-${i}`} value={h.room_ar ?? ""} placeholder="غرفة مزدوجة بإطلالة على البحر" onChange={(e) => set("hotels", f.hotels.map((x, j) => (j === i ? { ...x, room_ar: e.target.value } : x)))} />
                  </Field>
                  <Field label="Room (English)" htmlFor={`hotel-re-${i}`}>
                    <Input id={`hotel-re-${i}`} dir="ltr" className="text-left" value={h.room_en ?? ""} placeholder="Sea-view double room" onChange={(e) => set("hotels", f.hotels.map((x, j) => (j === i ? { ...x, room_en: e.target.value } : x)))} />
                  </Field>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" aria-label="تقديم" onClick={() => set("hotels", move(f.hotels, i, -1))} disabled={i === 0}>
                      <ArrowUp className="size-4" aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label="تأخير" onClick={() => set("hotels", move(f.hotels, i, 1))} disabled={i === f.hotels.length - 1}>
                      <ArrowDown className="size-4" aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-danger" aria-label="حذف الفندق" onClick={() => set("hotels", f.hotels.filter((_, j) => j !== i))}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button variant="subtle" size="sm" onClick={() => set("hotels", [...f.hotels, { hotel_id: null, nights: Math.max(1, f.duration_nights), room_ar: null, room_en: null, board: "BB" }])}>
              <Plus className="size-4" aria-hidden="true" /> إضافة فندق
            </Button>
            {!hotels.length ? <span className="text-sm text-muted">لا توجد فنادق بعد. أضفها من صفحة «الفنادق».</span> : null}
          </div>
        </Section>

        <Section id="itinerary" title="البرنامج اليومي" description="يوم بيوم: الجولات والأنشطة والتنقلات.">
          <ol className="grid gap-3">
            {f.days.map((d, i) => (
              <li key={i} className="rounded-xl border border-line p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 font-extrabold text-brand-900">
                    <span className="num grid size-8 place-items-center rounded-lg bg-brand-600 text-sm text-white">{i + 1}</span>
                    اليوم {i + 1}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" aria-label="تقديم اليوم" onClick={() => set("days", move(f.days, i, -1))} disabled={i === 0}>
                      <ArrowUp className="size-4" aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label="تأخير اليوم" onClick={() => set("days", move(f.days, i, 1))} disabled={i === f.days.length - 1}>
                      <ArrowDown className="size-4" aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-danger" aria-label={`حذف اليوم ${i + 1}`} onClick={() => set("days", f.days.filter((_, j) => j !== i))}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3">
                  <Bilingual label="عنوان اليوم" required ar={d.title_ar} en={d.title_en} errorAr={err(`days.${i}.title_ar`)} onAr={(v) => set("days", f.days.map((x, j) => (j === i ? { ...x, title_ar: v } : x)))} onEn={(v) => set("days", f.days.map((x, j) => (j === i ? { ...x, title_en: v } : x)))} name={`day${i}`} />
                  <Bilingual label="تفاصيل اليوم" multiline rows={3} ar={d.body_ar} en={d.body_en} onAr={(v) => set("days", f.days.map((x, j) => (j === i ? { ...x, body_ar: v } : x)))} onEn={(v) => set("days", f.days.map((x, j) => (j === i ? { ...x, body_en: v } : x)))} />
                </div>
              </li>
            ))}
          </ol>
          <Button variant="subtle" size="sm" className="mt-3" onClick={() => set("days", [...f.days, { title_ar: "", title_en: null, body_ar: null, body_en: null }])}>
            <Plus className="size-4" aria-hidden="true" /> إضافة يوم
          </Button>
        </Section>

        <Section id="services" title="الخدمات المشمولة وغير المشمولة" description="حدّد لكل خدمة: مشمولة، غير مشمولة، أو لا تظهر. يمكن إضافة ملاحظة قصيرة.">
          <ul role="list" className="divide-y divide-line rounded-xl border border-line">
            {services.map((s) => {
              const v = f.services[s.id] ?? { state: "none" as const, note_ar: null, note_en: null };
              const setS = (patch: Partial<typeof v>) => set("services", { ...f.services, [s.id]: { ...v, ...patch } });
              return (
                <li key={s.id} className="grid gap-3 p-3 md:grid-cols-[12rem_auto_1fr] md:items-center">
                  <span className="flex items-center gap-2.5 font-bold text-brand-950">
                    <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-600">
                      <ServiceIcon name={s.icon} />
                    </span>
                    {s.name_ar}
                  </span>
                  <div className="inline-flex rounded-xl bg-mist p-1" role="radiogroup" aria-label={s.name_ar}>
                    {(
                      [
                        ["included", "مشمولة"],
                        ["excluded", "غير مشمولة"],
                        ["none", "لا تظهر"],
                      ] as const
                    ).map(([state, label]) => (
                      <button
                        key={state}
                        type="button"
                        role="radio"
                        aria-checked={v.state === state}
                        onClick={() => setS({ state })}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                          v.state === state ? (state === "included" ? "bg-brand-600 text-white" : state === "excluded" ? "bg-accent-500 text-brand-950" : "bg-white text-brand-950 shadow-sm") : "text-muted hover:text-brand-950"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {v.state !== "none" ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input className={`${inputClass} h-9 text-sm`} placeholder="ملاحظة (اختياري)" aria-label={`ملاحظة ${s.name_ar}`} value={v.note_ar ?? ""} onChange={(e) => setS({ note_ar: e.target.value })} />
                      <input className={`${inputClass} h-9 text-left text-sm`} dir="ltr" placeholder="Note (English)" aria-label={`English note ${s.name_ar}`} value={v.note_en ?? ""} onChange={(e) => setS({ note_en: e.target.value })} />
                    </div>
                  ) : (
                    <span />
                  )}
                </li>
              );
            })}
          </ul>
        </Section>

        <Section
          id="departures"
          title="الكروبات ومواعيد الانطلاق"
          description={f.kind === "group" ? "مواعيد ثابتة مع عدد المقاعد. المقاعد المتاحة = الإجمالي − المحجوز خارج الموقع − الطلبات المؤكدة." : "اختياري للبرامج المرنة: يمكنك إضافة مواعيد مقترحة."}
          actions={
            <Button
              size="sm"
              variant="subtle"
              onClick={() => {
                const last = f.departures.at(-1);
                const start = last ? addDays(last.depart_date, 7) : addDays(todayDay(), 30);
                set("departures", [
                  ...f.departures,
                  { key: newKey(), depart_date: start, return_date: addDays(start, Math.max(1, f.duration_days - 1)), seats_total: last?.seats_total ?? 30, seats_held: 0, price: null, status: "open", note_ar: null, note_en: null },
                ]);
              }}
            >
              <CalendarPlus className="size-4" aria-hidden="true" /> إضافة موعد
            </Button>
          }
        >
          {f.departures.length ? (
            <ul role="list" className="grid gap-3">
              {f.departures.map((d, i) => {
                const upd = (patch: Partial<typeof d>) => set("departures", f.departures.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                const available = d.seats_total - d.seats_held - (d.confirmed ?? 0);
                const nights = d.depart_date && d.return_date ? daysBetween(d.depart_date, d.return_date) : 0;
                return (
                  <li key={d.key} className="rounded-xl border border-line p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-bold text-brand-900">
                        {d.code ? <span className="num rounded-md bg-mist px-2 py-0.5 text-xs">{d.code}</span> : <Badge tone="accent">جديد</Badge>}
                        <span className="num text-muted">{nights > 0 ? `${nights} ليلة` : ""}</span>
                      </span>
                      <span className="flex items-center gap-3 text-xs">
                        {d.confirmed ? <span className="num text-muted">مؤكد عبر الموقع: {d.confirmed}</span> : null}
                        <span className={`num font-bold ${available <= 5 ? "text-accent-700" : "text-brand-700"}`}>متاح: {Math.max(0, available)}</span>
                        <Button size="sm" variant="ghost" className="text-danger" aria-label="حذف الموعد" onClick={() => set("departures", f.departures.filter((_, j) => j !== i))}>
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                      <Field label="تاريخ السفر" htmlFor={`dep-d-${d.key}`} error={err(`departures.${i}.depart_date`)}>
                        <Input id={`dep-d-${d.key}`} type="date" dir="ltr" value={d.depart_date} onChange={(e) => upd({ depart_date: e.target.value, return_date: d.return_date < e.target.value ? addDays(e.target.value, Math.max(1, f.duration_days - 1)) : d.return_date })} />
                      </Field>
                      <Field label="تاريخ العودة" htmlFor={`dep-r-${d.key}`} error={err(`departures.${i}.return_date`)}>
                        <Input id={`dep-r-${d.key}`} type="date" dir="ltr" min={d.depart_date} value={d.return_date} onChange={(e) => upd({ return_date: e.target.value })} />
                      </Field>
                      <Field label="إجمالي المقاعد" htmlFor={`dep-t-${d.key}`}>
                        <NumberInput id={`dep-t-${d.key}`} min={1} value={d.seats_total} onChange={(v) => upd({ seats_total: v ?? 1 })} />
                      </Field>
                      <Field label="محجوز خارج الموقع" htmlFor={`dep-h-${d.key}`} error={err(`departures.${i}.seats_held`)}>
                        <NumberInput id={`dep-h-${d.key}`} min={0} value={d.seats_held} onChange={(v) => upd({ seats_held: v ?? 0 })} />
                      </Field>
                      <Field label="سعر خاص (اختياري)" htmlFor={`dep-p-${d.key}`}>
                        <MoneyInput id={`dep-p-${d.key}`} currency={f.currency} value={d.price} onChange={(v) => upd({ price: v })} />
                      </Field>
                      <Field label="الحالة" htmlFor={`dep-s-${d.key}`}>
                        <Select id={`dep-s-${d.key}`} value={d.status} onChange={(e) => upd({ status: e.target.value as DepartureStatus })}>
                          {DEPARTURE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {DEPARTURE_STATUS_LABELS[s].ar}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">{f.kind === "group" ? "أضف موعد انطلاق واحداً على الأقل قبل النشر." : "لا توجد مواعيد. المسافر يختار التاريخ المفضل عند الطلب."}</p>
          )}
        </Section>

        <Section id="terms" title="الوجبات والشروط">
          <div className="grid gap-5">
            <Bilingual label="الوجبات" hint="مثال: الإفطار يومياً + عشاء في أيام الجولات." ar={f.meals_ar} en={f.meals_en} onAr={(v) => set("meals_ar", v)} onEn={(v) => set("meals_en", v)} maxLength={200} />
            <Bilingual label="الشروط والملاحظات" multiline rows={5} ar={f.terms_ar} en={f.terms_en} onAr={(v) => set("terms_ar", v)} onEn={(v) => set("terms_en", v)} />
          </div>
        </Section>
      </div>

      {/* Sticky action panel */}
      <aside data-editor-panel className="order-first grid content-start gap-4 xl:sticky xl:top-6 xl:order-none xl:max-h-[calc(100svh-3rem)] xl:overflow-y-auto">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            {meta ? <ProgramStatusBadge status={meta.status} /> : <Badge tone="muted">برنامج جديد</Badge>}
            {meta ? <span className="num text-xs font-bold text-muted">{meta.code}</span> : null}
          </div>
          {meta ? (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-mist p-2.5">
                <dt className="text-xs text-muted">المشاهدات</dt>
                <dd className="num text-lg font-black text-brand-900">{meta.view_count}</dd>
              </div>
              <div className="rounded-xl bg-mist p-2.5">
                <dt className="text-xs text-muted">الطلبات</dt>
                <dd className="num text-lg font-black text-brand-900">{meta.leads}</dd>
              </div>
            </dl>
          ) : null}
          <div className="mt-4 grid gap-2">
            <Button variant="primary" onClick={() => save("save")} loading={pending}>
              <Save className="size-4" aria-hidden="true" /> {meta?.status === "published" ? "حفظ التغييرات" : "حفظ كمسودة"}
            </Button>
            {permissions.publish && meta?.status !== "published" ? (
              <Button variant="accent" onClick={() => save("publish")} loading={pending}>
                <Rocket className="size-4" aria-hidden="true" /> حفظ ونشر للمسافرين
              </Button>
            ) : null}
            {dirty ? <p className="text-center text-xs font-bold text-accent-700" role="status">لديك تغييرات غير محفوظة</p> : null}
          </div>
          {meta ? (
            <div className="mt-4 grid gap-2 border-t border-line pt-4">
              <a href={publicUrl ? asset(publicUrl) : `/staff/preview/program/${meta.id}/`} target="_blank" rel="noopener" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line text-sm font-bold text-brand-900 hover:bg-brand-50">
                <Eye className="size-4" aria-hidden="true" /> {publicUrl ? "عرض الصفحة العامة" : "معاينة قبل النشر"}
              </a>
              {permissions.publish && meta.status === "published" ? (
                <Button size="sm" onClick={() => run(() => setProgramStatusAction({ id: meta.id, status: "paused" }), { confirm: "إيقاف البرنامج؟ لن يظهر للمسافرين حتى إعادة نشره." })}>
                  <Pause className="size-4" aria-hidden="true" /> إيقاف مؤقت
                </Button>
              ) : null}
              {permissions.publish && meta.status !== "archived" ? (
                <Button size="sm" onClick={() => run(() => setProgramStatusAction({ id: meta.id, status: "archived" }), { confirm: "أرشفة البرنامج؟ سيختفي من الموقع ويبقى محفوظاً." })}>
                  <Archive className="size-4" aria-hidden="true" /> أرشفة
                </Button>
              ) : null}
              <Button size="sm" onClick={() => run(() => duplicateProgramAction(meta.id), { onOk: (d) => router.push(`/staff/programs/${d.id}/`) })}>
                <Copy className="size-4" aria-hidden="true" /> نسخ كبرنامج جديد
              </Button>
              {permissions.delete ? (
                <Button size="sm" variant="danger" onClick={() => run(() => deleteProgramAction(meta.id), { confirm: "حذف البرنامج نهائياً؟ تبقى طلبات المسافرين المرتبطة به محفوظة.", onOk: () => router.push("/staff/programs/") })}>
                  <Trash2 className="size-4" aria-hidden="true" /> حذف
                </Button>
              ) : null}
            </div>
          ) : null}
        </Card>
        <nav aria-label="أقسام المحرر" className="hidden rounded-2xl border border-line bg-white p-3 xl:block">
          <ul role="list" className="grid gap-0.5 text-sm">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded-lg px-3 py-1.5 font-semibold text-brand-900 hover:bg-brand-50">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </div>
  );
}
