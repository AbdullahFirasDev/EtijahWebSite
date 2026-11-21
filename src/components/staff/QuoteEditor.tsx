"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Binoculars,
  Building2,
  Download,
  Eye,
  FileDown,
  Import,
  Lock,
  MapPin,
  Plus,
  Save,
  Tag,
  Trash2,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { quoteDict } from "@/content/quote";
import { asset } from "@/lib/asset";
import { COUNTRY_CODES, countryName } from "@/lib/countries";
import { addDays, daysBetween } from "@/lib/dates";
import type { MediaRef } from "@/lib/media";
import { CURRENCIES, formatMoney, type CurrencyCode } from "@/lib/money";
import { quoteMargin, quoteTotals, type DiscountKind, type ItemKind, type ItemUnit, type PricingMode } from "@/lib/quote-math";
import { BOARD_LABELS, BOARDS, ITEM_UNITS, RATE_BASIS_LABELS, UNIT_LABELS, type Board, type QuoteStatus } from "@/lib/travel-labels";
import { destinationsSpan, destinationsSummary, type TripDestination } from "@/lib/trip-destinations";
import type { HotelPickerOption } from "@/server/repo/catalog";
import type { TourItem } from "@/server/repo/tours";
import { programDraftForQuoteAction, saveQuoteAction } from "@/server/actions/quotes";
import { CompanyEditor, emptyCompanyForm } from "./CompanyEditor";
import { DateInput, MoneyInput, NumberInput, StringList } from "./fields";
import { ImagePicker } from "./ImagePicker";
import { Modal } from "./Modal";
import { QuoteSharePanel, type QuoteMeta } from "./QuoteSharePanel";
import { QuoteStatusBadge } from "./StatusBadge";
import { Badge, Button, Card, CardHeader, Field, Input, Select, Textarea } from "./ui";
import { useActionRunner } from "./useActionRunner";

export interface QuoteItemState {
  key: string;
  kind: ItemKind;
  label: string;
  description: string | null;
  unit: ItemUnit;
  quantity: number;
  unit_price: number | null;
  unit_cost: number | null;
}

export interface QuoteHotelRateState {
  rate_id: string | null;
  source: "library" | "company" | "custom";
  basis: "per_person" | "per_room";
  occupancy: number;
  currency: string;
  night_price: number | null;
  night_cost: number | null;
  refresh: boolean;
}

export interface QuoteFormState {
  audience: "company" | "traveler";
  branding: "company" | "etijah";
  lead_id: number | null;
  b2b_request_id: number | null;
  client: { name: string; phone: string | null; email: string | null } | null;
  beneficiary: { name: string | null; note: string | null } | null;
  company_id: number | null;
  contact_id: number | null;
  program_id: number | null;
  locale: "ar" | "en";
  title: string;
  destination: string | null;
  /** Countries / cities of the trip, each with its own entry and exit date. */
  destinations: TripDestination[];
  intro: string | null;
  start_date: string | null;
  end_date: string | null;
  adults: number;
  children: number;
  infants: number;
  rooms: number;
  rooms_note: string | null;
  currency: string;
  pricing_mode: PricingMode;
  discount_kind: DiscountKind | null;
  discount_value: number;
  discount_label: string | null;
  inclusions: string[];
  exclusions: string[];
  notes: string | null;
  terms: string | null;
  internal_notes: string | null;
  cover: MediaRef | null;
  gallery: MediaRef[];
  valid_until: string;
  days: { title: string; body: string | null }[];
  hotels: { id: string | null; hotel_id: number | null; check_in: string | null; check_out: string | null; nights: number; room_type: string | null; board: Board | null; rooms: number | null; rate: QuoteHotelRateState | null; v?: number }[];
  items: QuoteItemState[];
}

interface Props {
  initial: QuoteFormState;
  meta: (QuoteMeta & { status: QuoteStatus; revision: number }) | null;
  companies: {
    id: number;
    name: string;
    hasLogo: boolean;
    contacts: { id: number; name: string; phone: string | null; email: string | null; is_primary: boolean }[];
    hotelRates: { hotel_id: number; rates: { rate_id: string | null; room_label: string | null; board: Board | null; basis: "per_person" | "per_room"; occupancy: number; currency: string; price: number }[] }[];
  }[];
  programs: { id: number; label: string; type?: string; options?: { id: string; label: string }[] }[];
  hotels: HotelPickerOption[];
  /** Library places (cities / areas) suggested per country. */
  places: { country_code: string; name_ar: string; name_en: string }[];
  /** Pre-registered tours (active). */
  tours: TourItem[];
  currencies: string[];
  defaultTerms: { ar: string; en: string };
  canDelete: boolean;
}

let seq = 0;
const k = () => `i${++seq}`;

const KIND_META: Record<ItemKind, { label: string; hint: string }> = {
  main: { label: "بنود السعر الأساسية", hint: "تدخل في الإجمالي." },
  fee: { label: "تكاليف إضافية", hint: "رسوم أو إضافات تدخل في الإجمالي (مثل ضرائب المدينة)." },
  option: { label: "خدمات اختيارية", hint: "تظهر للعميل بأسعارها ولا تدخل في الإجمالي." },
};

export function QuoteEditor({ initial, meta, companies, programs, hotels, places, tours, currencies, defaultTerms, canDelete }: Props) {
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [companyModal, setCompanyModal] = useState(false);
  const [importId, setImportId] = useState<number | null>(initial.program_id);
  const router = useRouter();
  const { run, pending } = useActionRunner();
  const importer = useActionRunner();
  // Unsaved changes = the form differs from what was last loaded from the server.
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const dirty = useMemo(() => JSON.stringify(f) !== saved, [f, saved]);

  const set = <K extends keyof QuoteFormState>(key: K, v: QuoteFormState[K]) => setF((x) => ({ ...x, [key]: v }));
  /**
   * Destinations drive the summary line and the trip dates while staff have not typed their own:
   * a value still equal to what the previous rows produced follows the new rows.
   */
  const setDests = (rows: TripDestination[]) =>
    setF((x) => {
      const before = { text: destinationsSummary(x.destinations, x.locale), ...destinationsSpan(x.destinations) };
      const after = { text: destinationsSummary(rows, x.locale), ...destinationsSpan(rows) };
      return {
        ...x,
        destinations: rows,
        destination: !x.destination || x.destination === before.text ? after.text || null : x.destination,
        start_date: !x.start_date || x.start_date === before.start ? (after.start ?? x.start_date) : x.start_date,
        end_date: !x.end_date || x.end_date === before.end ? (after.end ?? x.end_date) : x.end_date,
      };
    });
  const addDest = () => {
    const last = f.destinations.at(-1);
    setDests([
      ...f.destinations,
      last
        ? { country_code: last.country_code, city: null, entry_date: last.exit_date, exit_date: null }
        : { country_code: "TR", city: null, entry_date: f.start_date, exit_date: f.end_date },
    ]);
  };
  const placeName = (p: { name_ar: string; name_en: string }) => (f.locale === "ar" ? p.name_ar : p.name_en || p.name_ar);
  const company = companies.find((c) => c.id === f.company_id) ?? null;
  const contact = company?.contacts.find((c) => c.id === f.contact_id) ?? null;
  const ar = f.locale === "ar";
  const cur = f.currency as CurrencyCode;
  const money = (v: number) => formatMoney(v, cur, "ar");

  const priced = useMemo(() => f.items.map((i) => ({ ...i, unit_price: i.unit_price ?? 0 })), [f.items]);
  const totals = useMemo(() => quoteTotals({ ...f, items: priced }), [f, priced]);
  const margin = useMemo(() => quoteMargin({ ...f, items: priced }), [f, priced]);

  const payload = () => ({
    ...f,
    company_id: f.audience === "company" ? f.company_id : null,
    contact_id: f.audience === "company" ? f.contact_id : null,
    client: f.audience === "traveler" ? f.client : null,
    branding: f.audience === "traveler" ? ("etijah" as const) : f.branding,
    cover_media_id: f.cover?.id ?? null,
    gallery: f.gallery.map((m) => m.id),
    hotels: f.hotels
      .filter((h) => h.hotel_id)
      .map(({ v: _v, ...h }) => ({ ...h, hotel_id: h.hotel_id!, rate: h.rate && h.rate.night_price != null ? { ...h.rate, night_price: h.rate.night_price } : null })),
    items: f.items.map((i) => ({ kind: i.kind, label: i.label, description: i.description, unit: i.unit, quantity: i.quantity, unit_price: i.unit_price ?? 0, unit_cost: i.unit_cost })),
    cover: undefined,
  });

  const save = () =>
    run(() => saveQuoteAction({ id: meta?.id ?? null, quote: payload() }), {
      onOk: (d) => {
        setErrors({});
        setSaved(JSON.stringify(f));
        if (!meta) router.replace(`/staff/quotes/${d.id}/`);
      },
      onError: (r) => setErrors(r.fieldErrors ?? {}),
    });

  const [importOption, setImportOption] = useState<string>("");
  const importProgram = () => {
    if (!importId) return;
    const hasContent = f.days.length || f.hotels.length || f.items.length;
    if (hasContent && !window.confirm("سيستبدل الاستيراد البرنامج اليومي والفنادق والأسعار والخدمات الحالية. متابعة؟")) return;
    importer.run(() => programDraftForQuoteAction({ programId: importId, locale: f.locale, adults: f.adults, optionId: importOption || null }), {
      refresh: false,
      onOk: (d) => {
        setF((x) => ({
          ...x,
          program_id: d.program_id,
          title: d.title,
          destination: d.destination,
          // The program's places, keeping dates already entered for the same country/city.
          destinations: d.destinations.map((r, i, all) => {
            const same = x.destinations.find((o) => o.country_code === r.country_code && (!o.city || o.city === r.city));
            return { ...r, entry_date: same?.entry_date ?? (i === 0 ? x.start_date : null), exit_date: same?.exit_date ?? (i === all.length - 1 && x.start_date ? addDays(x.start_date, Math.max(0, d.duration_days - 1)) : null) };
          }),
          intro: d.intro,
          currency: currencies.includes(d.currency) ? d.currency : x.currency,
          cover: d.cover ?? x.cover,
          gallery: d.gallery,
          days: d.days,
          hotels: (() => {
            // Consecutive stays from the travel date, when it is known.
            let cursor = x.start_date;
            return d.hotels.map((h) => {
              const line = { ...h, id: null, check_in: null as string | null, check_out: null as string | null, rooms: null as number | null, rate: { ...h.rate, refresh: false } };
              if (!cursor) return line;
              const stay = { ...line, check_in: cursor, check_out: addDays(cursor, h.nights) };
              cursor = stay.check_out;
              return stay;
            });
          })(),
          inclusions: d.inclusions,
          exclusions: d.exclusions,
          items: d.items.map((i) => ({ ...i, key: k() })),
          end_date: x.start_date ? addDays(x.start_date, Math.max(0, d.duration_days - 1)) : x.end_date,
        }));
      },
    });
  };

  const setItem = (key: string, patch: Partial<QuoteItemState>) => set("items", f.items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const addItem = (kind: ItemKind) =>
    set("items", [...f.items, { key: k(), kind, label: "", description: null, unit: kind === "main" ? "person" : "group", quantity: kind === "main" ? Math.max(1, f.adults) : 1, unit_price: null, unit_cost: null }]);
  const qtyFor = (unit: ItemUnit) => (unit === "person" ? f.adults : unit === "child" ? f.children : unit === "room" ? f.rooms : unit === "night" && f.start_date && f.end_date ? daysBetween(f.start_date, f.end_date) : 1);

  /** Adds a pre-registered tour to a day (new or existing) and, optionally, as a price line. */
  const addTour = (tour: TourItem, target: number | "new", priceAs: "main" | "option" | "none") => {
    const pickL = (a: string | null, e: string | null) => (ar ? a : e || a);
    const name = pickL(tour.name_ar, tour.name_en) ?? tour.name_ar;
    const city = pickL(tour.city_ar, tour.city_en);
    const duration = pickL(tour.duration_ar, tour.duration_en);
    const details = [pickL(tour.description_ar, tour.description_en), duration ? `${ar ? "المدة" : "Duration"}: ${duration}` : null].filter(Boolean).join("\n") || null;
    const priced = priceAs !== "none" && tour.price > 0 && tour.currency === f.currency;
    setF((x) => ({
      ...x,
      days:
        target === "new"
          ? [...x.days, { title: name, body: details }]
          : x.days.map((d, j) => {
              if (j !== target) return d;
              if (!d.title.trim()) return { title: name, body: [d.body, details].filter(Boolean).join("\n") || null };
              return { ...d, body: [d.body, `• ${name}${details ? `\n${details}` : ""}`].filter(Boolean).join("\n") };
            }),
      items: priced
        ? [...x.items, { key: k(), kind: priceAs as ItemKind, label: `${name}${city ? ` (${city})` : ""}`, description: duration, unit: "person", quantity: Math.max(1, x.adults), unit_price: tour.price, unit_cost: tour.cost }]
        : x.items,
    }));
  };

  const err = (p: string) => errors[`quote.${p}`];
  const errorList = Object.values(errors);
  const linkless = f.hotels.filter((h) => h.hotel_id && !hotels.find((o) => o.id === h.hotel_id)?.hasLink);
  const hotelById = new Map(hotels.map((h) => [h.id, h]));
  const companyRatesFor = (hotelId: number) => (f.audience === "company" ? (company?.hotelRates.find((r) => r.hotel_id === hotelId)?.rates ?? []) : []);
  /** Adds a price line for a hotel stay (per person, for the travelers in the quote). */
  const addHotelItem = (h: QuoteFormState["hotels"][number]) => {
    if (!h.rate || h.rate.night_price == null || !h.hotel_id) return;
    const name = hotelById.get(h.hotel_id)?.name ?? "";
    const perPerson = h.rate.basis === "per_room" ? Math.ceil((h.rate.night_price * h.nights) / Math.max(1, h.rate.occupancy)) : h.rate.night_price * h.nights;
    const cost = h.rate.night_cost == null ? null : h.rate.basis === "per_room" ? Math.ceil((h.rate.night_cost * h.nights) / Math.max(1, h.rate.occupancy)) : h.rate.night_cost * h.nights;
    set("items", [
      ...f.items,
      { key: k(), kind: "main", label: `${ar ? "الإقامة في" : "Stay at"} ${name}${h.room_type ? ` — ${h.room_type}` : ""} (${h.nights} ${ar ? "ليالٍ" : "nights"})`, description: null, unit: "person", quantity: Math.max(1, f.adults), unit_price: perPerson, unit_cost: cost },
    ]);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_21rem]">
      <div className="grid min-w-0 gap-6">
        {errorList.length ? (
          <div role="alert" className="rounded-2xl border border-danger/25 bg-[#fdeeee] p-4 text-sm text-[#a42424]">
            <p className="font-extrabold">يرجى تصحيح ما يلي:</p>
            <ul className="mt-1 list-disc ps-5">
              {errorList.slice(0, 8).map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <Card>
          <CardHeader title="المستلم وهوية العرض ولغته" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <fieldset className="sm:col-span-2">
              <legend className="mb-1.5 text-sm font-bold text-brand-950">العرض موجّه إلى</legend>
              <div className="inline-flex rounded-xl bg-mist p-1" role="radiogroup" aria-label="المستلم">
                {(
                  [
                    ["company", "شركة B2B"],
                    ["traveler", "مسافر (طلب برنامج خاص)"],
                  ] as const
                ).map(([a, label]) => (
                  <button key={a} type="button" role="radio" aria-checked={f.audience === a} data-audience={a} onClick={() => setF((x) => ({ ...x, audience: a, branding: a === "traveler" ? "etijah" : x.branding, client: a === "traveler" ? (x.client ?? { name: "", phone: null, email: null }) : x.client }))} className={`rounded-lg px-4 py-1.5 text-sm font-bold ${f.audience === a ? "bg-white text-brand-950 shadow-sm" : "text-muted"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            {f.audience === "traveler" ? (
              <>
                <Field label="اسم المسافر" required error={err("client.name") ?? err("client")}>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted" aria-hidden="true" />
                    <Input className="ps-9" value={f.client?.name ?? ""} onChange={(e) => set("client", { name: e.target.value, phone: f.client?.phone ?? null, email: f.client?.email ?? null })} data-client-name />
                  </div>
                </Field>
                <Field label="هاتف المسافر">
                  <Input dir="ltr" className="num text-left" value={f.client?.phone ?? ""} onChange={(e) => set("client", { name: f.client?.name ?? "", phone: e.target.value || null, email: f.client?.email ?? null })} />
                </Field>
                {f.lead_id ? <p className="text-xs text-muted sm:col-span-2">مرتبط بطلب المسافر #{f.lead_id}. العرض يصدر بهوية الاتجاه.</p> : null}
              </>
            ) : null}
            {f.audience === "company" ? (
            <>
            <Field label="الشركة المستلمة" required error={err("company_id")} htmlFor="q-company">
              <div className="flex gap-2">
                <Select
                  id="q-company"
                  value={f.company_id ?? ""}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : null;
                    const c = companies.find((x) => x.id === id);
                    setF((x) => ({ ...x, company_id: id, contact_id: c?.contacts.find((ct) => ct.is_primary)?.id ?? c?.contacts[0]?.id ?? null }));
                  }}
                >
                  <option value="">اختر الشركة…</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <Button variant="subtle" aria-label="شركة جديدة" onClick={() => setCompanyModal(true)} className="shrink-0">
                  <Building2 className="size-4" aria-hidden="true" /> جديدة
                </Button>
              </div>
            </Field>
            <Field label="جهة الاتصال" htmlFor="q-contact" hint={company && !company.contacts.length ? "لا توجد جهات اتصال لهذه الشركة بعد." : undefined}>
              <Select id="q-contact" value={f.contact_id ?? ""} onChange={(e) => set("contact_id", e.target.value ? Number(e.target.value) : null)} disabled={!company}>
                <option value="">بدون</option>
                {company?.contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="هوية ملف العرض" hint={company && !company.hasLogo ? "لا يوجد شعار لهذه الشركة بعد: أضفه من ملف الشركة." : "القالب موحد؛ يتغير الشعار والألوان والاسم وبيانات التواصل."}>
              <Select value={f.branding} onChange={(e) => set("branding", e.target.value as QuoteFormState["branding"])} data-branding>
                <option value="company">هوية الشركة المختارة</option>
                <option value="etijah">هوية الاتجاه</option>
              </Select>
            </Field>
            <Field label="الجهة المستفيدة (اختياري)" hint="العميل النهائي للشركة، يظهر في الملف.">
              <Input value={f.beneficiary?.name ?? ""} onChange={(e) => set("beneficiary", { name: e.target.value || null, note: f.beneficiary?.note ?? null })} data-beneficiary />
            </Field>
            </>
            ) : null}
            <fieldset className="sm:col-span-2">
              <legend className="mb-1.5 text-sm font-bold text-brand-950">لغة العرض</legend>
              <div className="inline-flex rounded-xl bg-mist p-1" role="radiogroup" aria-label="لغة العرض">
                {(
                  [
                    ["ar", "العربية"],
                    ["en", "English"],
                  ] as const
                ).map(([l, label]) => (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={f.locale === l}
                    onClick={() =>
                      setF((x) => ({
                        ...x,
                        locale: l,
                        terms: !x.terms || x.terms === defaultTerms[x.locale] ? defaultTerms[l] : x.terms,
                      }))
                    }
                    className={`rounded-lg px-4 py-1.5 text-sm font-bold ${f.locale === l ? "bg-white text-brand-950 shadow-sm" : "text-muted"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted">اكتب محتوى العرض بلغته. العناوين والجداول تُترجم تلقائياً في الصفحة وملف PDF.</p>
            </fieldset>
          </div>
        </Card>

        <Card>
          <CardHeader title="البرنامج السياحي" description="استورد برنامجاً جاهزاً ثم عدّله لهذه الشركة، أو ابنِ برنامجاً مخصصاً من الصفر." />
          <div className="flex flex-wrap items-end gap-2 p-5">
            <Field label="استيراد من برنامج" className="min-w-64 flex-1" htmlFor="q-import">
              <Select id="q-import" value={importId ?? ""} onChange={(e) => setImportId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">برنامج مخصص (بدون استيراد)</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
            {programs.find((p) => p.id === importId)?.options?.length ? (
              <Field label="خيار الفندق" className="min-w-56" htmlFor="q-import-opt">
                <Select id="q-import-opt" value={importOption} onChange={(e) => setImportOption(e.target.value)}>
                  <option value="">الخيار الأول</option>
                  {programs
                    .find((p) => p.id === importId)!
                    .options!.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                </Select>
              </Field>
            ) : null}
            <Button variant="subtle" onClick={importProgram} disabled={!importId} loading={importer.pending}>
              <Import className="size-4" aria-hidden="true" /> استيراد
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="تفاصيل الرحلة" />
          <div className="grid gap-4 p-5 sm:grid-cols-2" dir={ar ? "rtl" : "ltr"}>
            <Field label="عنوان العرض" required error={err("title")} className="sm:col-span-2" htmlFor="q-title">
              <Input id="q-title" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder={ar ? "رحلة تحفيزية لفريق المبيعات إلى إسطنبول" : "Sales team incentive trip to Istanbul"} />
            </Field>
            <div className="sm:col-span-2" data-quote-destinations>
              <p className="mb-2 text-sm font-bold text-brand-950">
                الوجهات والدول <span className="font-semibold text-muted">· أضف دولة أو أكثر، ولكل وجهة تاريخ دخول وتاريخ خروج</span>
              </p>
              {f.destinations.length ? (
                <ol className="grid gap-2">
                  {f.destinations.map((d, i) => {
                    const upd = (patch: Partial<TripDestination>) => setDests(f.destinations.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                    const nights = d.entry_date && d.exit_date ? daysBetween(d.entry_date, d.exit_date) : null;
                    return (
                      <li key={i} className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-2" data-destination-row>
                        <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
                          <span className="flex items-center gap-2 text-sm font-extrabold text-brand-950">
                            <span className="num grid size-7 place-items-center rounded-lg bg-brand-600 text-xs font-bold text-white">{i + 1}</span>
                            {[d.city, countryName(d.country_code, "ar")].filter(Boolean).join("، ")}
                            {nights != null ? <Badge tone={nights < 0 ? "danger" : "brand"}>{nights < 0 ? "الخروج قبل الدخول" : quoteDict.ar.nights(nights)}</Badge> : null}
                          </span>
                          <span className="flex gap-1">
                            <Button size="sm" variant="ghost" aria-label="تقديم الوجهة" disabled={i === 0} onClick={() => setDests(f.destinations.map((x, j, a) => (j === i - 1 ? a[i] : j === i ? a[i - 1] : x)))}>
                              <ArrowUp className="size-4" aria-hidden="true" />
                            </Button>
                            <Button size="sm" variant="ghost" aria-label="تأخير الوجهة" disabled={i === f.destinations.length - 1} onClick={() => setDests(f.destinations.map((x, j, a) => (j === i + 1 ? a[i] : j === i ? a[i + 1] : x)))}>
                              <ArrowDown className="size-4" aria-hidden="true" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-danger" aria-label={`حذف الوجهة ${i + 1}`} onClick={() => setDests(f.destinations.filter((_, j) => j !== i))}>
                              <Trash2 className="size-4" aria-hidden="true" />
                            </Button>
                          </span>
                        </div>
                        <Field label="الدولة" htmlFor={`qd-c-${i}`}>
                          <Select id={`qd-c-${i}`} value={d.country_code} onChange={(e) => upd({ country_code: e.target.value, city: null })} data-dest-country>
                            {COUNTRY_CODES.map((c) => (
                              <option key={c} value={c}>
                                {countryName(c, "ar")}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="المدينة / المنطقة (اختياري)" htmlFor={`qd-city-${i}`}>
                          <Input id={`qd-city-${i}`} list={`qd-places-${d.country_code}`} dir={ar ? "rtl" : "ltr"} value={d.city ?? ""} onChange={(e) => upd({ city: e.target.value || null })} placeholder={ar ? "إسطنبول" : "Istanbul"} data-dest-city />
                        </Field>
                        <Field label="تاريخ الدخول" htmlFor={`qd-in-${i}`}>
                          <DateInput id={`qd-in-${i}`} value={d.entry_date} onChange={(v) => upd({ entry_date: v, exit_date: v && d.exit_date && d.exit_date < v ? null : d.exit_date })} data-dest-entry />
                        </Field>
                        <Field label="تاريخ الخروج" htmlFor={`qd-out-${i}`}>
                          <DateInput id={`qd-out-${i}`} min={d.entry_date ?? undefined} value={d.exit_date} onChange={(v) => upd({ exit_date: v })} data-dest-exit />
                        </Field>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="rounded-xl border border-dashed border-line px-4 py-4 text-sm text-muted">لا توجد وجهات بعد. أضف الدولة الأولى، ثم دولاً أو مدناً أخرى بتواريخ دخول وخروج خاصة بكل منها.</p>
              )}
              {[...new Set(f.destinations.map((d) => d.country_code))].map((code) => (
                <datalist key={code} id={`qd-places-${code}`}>
                  {places
                    .filter((p) => p.country_code === code)
                    .map((p) => (
                      <option key={p.name_ar} value={placeName(p)} />
                    ))}
                </datalist>
              ))}
              {err("destinations") ? <p className="mt-1.5 text-xs font-bold text-danger">{err("destinations")}</p> : null}
              <Button size="sm" variant="subtle" className="mt-2" onClick={addDest} data-add-destination>
                <MapPin className="size-4" aria-hidden="true" /> إضافة وجهة / دولة
              </Button>
            </div>
            <Field label="الوجهة (سطر الملخص)" htmlFor="q-dest" hint={f.destinations.length ? "يُكتب تلقائياً من الوجهات أعلاه، ويمكنك تعديله." : undefined}>
              <Input id="q-dest" value={f.destination ?? ""} onChange={(e) => set("destination", e.target.value)} placeholder={ar ? "إسطنبول وبورصة، تركيا" : "Istanbul & Bursa, Türkiye"} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="تاريخ السفر" htmlFor="q-start" error={err("start_date")}>
                <DateInput id="q-start" value={f.start_date} onChange={(v) => set("start_date", v)} />
              </Field>
              <Field label="تاريخ العودة" htmlFor="q-end" error={err("end_date")}>
                <DateInput id="q-end" min={f.start_date ?? undefined} value={f.end_date} onChange={(v) => set("end_date", v)} />
              </Field>
            </div>
            <Field label="مقدمة العرض" className="sm:col-span-2" htmlFor="q-intro">
              <Textarea id="q-intro" rows={3} value={f.intro ?? ""} onChange={(e) => set("intro", e.target.value)} />
            </Field>
            <div className="grid grid-cols-3 gap-3 sm:col-span-2 lg:grid-cols-5">
              <Field label="البالغون" htmlFor="q-adults">
                <NumberInput id="q-adults" value={f.adults} onChange={(v) => set("adults", v ?? 0)} />
              </Field>
              <Field label="الأطفال" htmlFor="q-children">
                <NumberInput id="q-children" value={f.children} onChange={(v) => set("children", v ?? 0)} />
              </Field>
              <Field label="الرضّع" htmlFor="q-infants">
                <NumberInput id="q-infants" value={f.infants} onChange={(v) => set("infants", v ?? 0)} />
              </Field>
              <Field label="عدد الغرف" htmlFor="q-rooms">
                <NumberInput id="q-rooms" value={f.rooms} onChange={(v) => set("rooms", v ?? 0)} />
              </Field>
              <Field label="توزيع الغرف" className="col-span-3 lg:col-span-1" htmlFor="q-rooms-note">
                <Input id="q-rooms-note" value={f.rooms_note ?? ""} onChange={(e) => set("rooms_note", e.target.value)} placeholder={ar ? "8 مزدوجة + 2 مفردة" : "8 double + 2 single"} />
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="الفنادق" description="اسم كل فندق يظهر رابطاً قابلاً للنقر في صفحة العرض وملف PDF." />
          <div className="p-5">
            {linkless.length ? (
              <p className="mb-3 flex items-center gap-2 rounded-xl bg-accent-50 px-3 py-2 text-xs font-bold text-accent-700">
                <AlertTriangle className="size-4" aria-hidden="true" /> {linkless.length} فندق بلا رابط معتمد: سيظهر اسمه نصاً عادياً. أضف الموقع الرسمي أو رابط الخريطة من صفحة الفندق.
              </p>
            ) : null}
            <ul role="list" className="grid gap-3">
              {f.hotels.map((h, i) => {
                const upd = (patch: Partial<typeof h>) => set("hotels", f.hotels.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <li key={i} className="grid gap-3 rounded-xl border border-line p-3 md:grid-cols-6">
                    <Field label={`الفندق ${i + 1}`} className="md:col-span-2" htmlFor={`qh-${i}`}>
                      <Select id={`qh-${i}`} value={h.hotel_id ?? ""} onChange={(e) => upd({ hotel_id: e.target.value ? Number(e.target.value) : null, rate: null })} data-quote-hotel>
                        <option value="">اختر من مكتبة الفنادق…</option>
                        {hotels.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name} — {o.city} {o.stars ? `(${o.stars}★)` : ""}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="الوصول" htmlFor={`qh-in-${i}`}>
                      <DateInput id={`qh-in-${i}`} value={h.check_in} onChange={(v) => upd({ check_in: v, nights: v && h.check_out ? Math.max(1, daysBetween(v, h.check_out)) : h.nights })} />
                    </Field>
                    <Field label="المغادرة" htmlFor={`qh-out-${i}`}>
                      <DateInput id={`qh-out-${i}`} min={h.check_in ?? undefined} value={h.check_out} onChange={(v) => upd({ check_out: v, nights: h.check_in && v ? Math.max(1, daysBetween(h.check_in, v)) : h.nights })} />
                    </Field>
                    <Field label="الليالي" htmlFor={`qh-n-${i}`}>
                      <NumberInput id={`qh-n-${i}`} min={1} value={h.nights} onChange={(v) => upd({ nights: v ?? 1 })} />
                    </Field>
                    <Field label="الغرف" htmlFor={`qh-r-${i}`}>
                      <NumberInput id={`qh-r-${i}`} nullable value={h.rooms} onChange={(v) => upd({ rooms: v })} />
                    </Field>
                    <Field label="نوع الغرفة" className="md:col-span-3" htmlFor={`qh-t-${i}`}>
                      <Input id={`qh-t-${i}`} dir={ar ? "rtl" : "ltr"} value={h.room_type ?? ""} onChange={(e) => upd({ room_type: e.target.value })} />
                    </Field>
                    <Field label="الوجبات" className="md:col-span-2" htmlFor={`qh-b-${i}`}>
                      <Select id={`qh-b-${i}`} value={h.board ?? ""} onChange={(e) => upd({ board: (e.target.value || null) as Board | null })}>
                        <option value="">غير محدد</option>
                        {BOARDS.map((b) => (
                          <option key={b} value={b}>
                            {BOARD_LABELS[b].ar}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    {h.hotel_id ? (
                      <div className="grid gap-2 rounded-xl bg-mist p-3 md:col-span-6 md:grid-cols-[1.6fr_1fr_1fr_auto] md:items-end">
                        <Field label="سعر الليلة من">
                          <Select
                            value={h.rate ? `${h.rate.source}:${h.rate.rate_id ?? ""}` : ""}
                            data-quote-rate
                            onChange={(e) => {
                              const [src, rid] = e.target.value.split(":") as ["library" | "company" | "custom" | "", string];
                              if (!src) return upd({ rate: null });
                              if (src === "custom") return upd({ rate: { rate_id: null, source: "custom", basis: h.rate?.basis ?? "per_room", occupancy: h.rate?.occupancy ?? 2, currency: f.currency, night_price: h.rate?.night_price ?? null, night_cost: h.rate?.night_cost ?? null, refresh: false }, v: (h.v ?? 0) + 1 });
                              if (src === "library") {
                                const r = hotelById.get(h.hotel_id!)?.rates.find((x) => x.id === rid);
                                const rt = r ? hotelById.get(h.hotel_id!)?.room_types.find((x) => x.id === r.room_type_id) : null;
                                if (r) upd({ board: r.board ?? h.board, room_type: h.room_type || (ar ? rt?.name_ar : rt?.name_en || rt?.name_ar) || null, rate: { rate_id: r.id, source: "library", basis: r.basis, occupancy: r.occupancy, currency: r.currency, night_price: r.price, night_cost: r.cost, refresh: true }, v: (h.v ?? 0) + 1 });
                                return;
                              }
                              const cr = companyRatesFor(h.hotel_id!).find((x) => (x.rate_id ?? "") === rid);
                              if (cr) upd({ board: cr.board ?? h.board, room_type: h.room_type || cr.room_label, rate: { rate_id: cr.rate_id, source: "company", basis: cr.basis, occupancy: cr.occupancy, currency: cr.currency, night_price: cr.price, night_cost: null, refresh: true }, v: (h.v ?? 0) + 1 });
                            }}
                          >
                            <option value="">بدون سعر فندق في هذا السطر</option>
                            {companyRatesFor(h.hotel_id).length ? (
                              <optgroup label="أسعار الشركة المخصصة">
                                {companyRatesFor(h.hotel_id).map((r, ri) => (
                                  <option key={`c${ri}`} value={`company:${r.rate_id ?? ""}`}>
                                    {r.room_label} · {r.board ? BOARD_LABELS[r.board].ar : "—"} · {formatMoney(r.price, r.currency, "ar")} {RATE_BASIS_LABELS[r.basis].ar}
                                  </option>
                                ))}
                              </optgroup>
                            ) : null}
                            <optgroup label="مكتبة الفنادق">
                              {(hotelById.get(h.hotel_id)?.rates ?? []).map((r) => (
                                <option key={r.id} value={`library:${r.id}`}>
                                  {hotelById.get(h.hotel_id!)?.room_types.find((x) => x.id === r.room_type_id)?.name_ar} · {r.board ? BOARD_LABELS[r.board].ar : "—"} · {formatMoney(r.price, r.currency, "ar")} {RATE_BASIS_LABELS[r.basis].ar}
                                </option>
                              ))}
                            </optgroup>
                            <option value="custom:">سعر خاص لهذا العرض</option>
                          </Select>
                        </Field>
                        {h.rate ? (
                          <>
                            <Field label={`سعر الليلة (${h.rate.currency}) ${RATE_BASIS_LABELS[h.rate.basis].ar}`} hint="تعديله هنا لا يغيّر سعر المكتبة.">
                              <MoneyInput key={`qr-${i}-${h.v ?? 0}`} value={h.rate.night_price} onChange={(v) => upd({ rate: { ...h.rate!, night_price: v } })} aria-label="سعر الليلة" />
                            </Field>
                            <p className="text-xs text-muted">
                              {h.rate.night_cost != null ? <span className="block">تكلفة داخلية: {formatMoney(h.rate.night_cost, h.rate.currency, "ar")}</span> : null}
                              {h.rate.currency !== f.currency ? <span className="block font-bold text-accent-700">عملة مختلفة عن العرض ({f.currency})</span> : null}
                            </p>
                            <Button size="sm" variant="subtle" onClick={() => addHotelItem(h)} disabled={h.rate.night_price == null || h.rate.currency !== f.currency} data-add-hotel-item>
                              <Tag className="size-4" aria-hidden="true" /> إضافة كبند سعر
                            </Button>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="flex items-end justify-end gap-1">
                      <Button size="sm" variant="ghost" aria-label="تقديم" onClick={() => set("hotels", f.hotels.map((x, j, a) => (j === i - 1 ? a[i] : j === i ? a[i - 1] : x)))} disabled={i === 0}>
                        <ArrowUp className="size-4" aria-hidden="true" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-danger" aria-label="حذف الفندق" onClick={() => set("hotels", f.hotels.filter((_, j) => j !== i))}>
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Button
              size="sm"
              variant="subtle"
              className="mt-3"
              data-add-quote-hotel
              onClick={() => {
                const stay = f.destinations.find((d) => d.entry_date && d.exit_date && !f.hotels.some((h) => h.check_in === d.entry_date)) ?? null;
                const from = stay ? stay.entry_date : f.start_date;
                const to = stay ? stay.exit_date : f.end_date;
                set("hotels", [...f.hotels, { id: null, hotel_id: null, check_in: from, check_out: to, nights: from && to ? Math.max(1, daysBetween(from, to)) : 1, room_type: null, board: "BB", rooms: f.rooms || null, rate: null }]);
              }}
            >
              <Plus className="size-4" aria-hidden="true" /> إضافة فندق
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="البرنامج اليومي" description="أضف الأيام يدوياً، أو أضف جولة مسجلة مسبقاً إلى يوم جديد أو موجود مع سعرها." />
          <div className="p-5" dir={ar ? "rtl" : "ltr"}>
            <TourPicker tours={tours} quote={f} onAdd={addTour} />
            <ol className="grid gap-3">
              {f.days.map((d, i) => (
                <li key={i} className="grid gap-2 rounded-xl border border-line p-3">
                  <div className="flex items-center gap-2">
                    <span className="num grid size-8 shrink-0 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
                    <Input aria-label={`عنوان اليوم ${i + 1}`} value={d.title} onChange={(e) => set("days", f.days.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                    <Button size="sm" variant="ghost" aria-label="تقديم" disabled={i === 0} onClick={() => set("days", f.days.map((x, j, a) => (j === i - 1 ? a[i] : j === i ? a[i - 1] : x)))}>
                      <ArrowUp className="size-4" aria-hidden="true" />
                    </Button>
                    <Button size="sm" variant="ghost" aria-label="تأخير" disabled={i === f.days.length - 1} onClick={() => set("days", f.days.map((x, j, a) => (j === i + 1 ? a[i] : j === i ? a[i + 1] : x)))}>
                      <ArrowDown className="size-4" aria-hidden="true" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-danger" aria-label={`حذف اليوم ${i + 1}`} onClick={() => set("days", f.days.filter((_, j) => j !== i))}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                  <Textarea aria-label={`تفاصيل اليوم ${i + 1}`} rows={2} value={d.body ?? ""} onChange={(e) => set("days", f.days.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
                </li>
              ))}
            </ol>
            <Button size="sm" variant="subtle" className="mt-3" onClick={() => set("days", [...f.days, { title: "", body: null }])}>
              <Plus className="size-4" aria-hidden="true" /> إضافة يوم
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="يشمل / لا يشمل" />
          <div className="grid gap-6 p-5 md:grid-cols-2">
            <StringList label="يشمل العرض" dir={ar ? "rtl" : "ltr"} value={f.inclusions} onChange={(v) => set("inclusions", v)} />
            <StringList label="لا يشمل العرض" dir={ar ? "rtl" : "ltr"} value={f.exclusions} onChange={(v) => set("exclusions", v)} />
          </div>
        </Card>

        <Card>
          <CardHeader title="الأسعار" description="الأسعار تُحسب على الخادم أيضاً. حقل «التكلفة» داخلي ولا يظهر للعميل أبداً." />
          <div className="grid gap-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="العملة" htmlFor="q-currency">
                <Select id="q-currency" value={f.currency} onChange={(e) => set("currency", e.target.value)}>
                  {currencies.map((c) => (
                    <option key={c} value={c}>
                      {CURRENCIES[c as CurrencyCode]?.nameAr ?? c} ({c})
                    </option>
                  ))}
                </Select>
              </Field>
              <fieldset>
                <legend className="mb-1.5 text-sm font-bold text-brand-950">طريقة عرض السعر الرئيسي</legend>
                <div className="inline-flex rounded-xl bg-mist p-1" role="radiogroup" aria-label="طريقة عرض السعر">
                  {(
                    [
                      ["per_person", "للشخص"],
                      ["per_room", "للغرفة"],
                      ["per_group", "للمجموعة"],
                    ] as const
                  ).map(([m, label]) => (
                    <button key={m} type="button" role="radio" aria-checked={f.pricing_mode === m} onClick={() => set("pricing_mode", m)} className={`rounded-lg px-3.5 py-1.5 text-sm font-bold ${f.pricing_mode === m ? "bg-white text-brand-950 shadow-sm" : "text-muted"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            {(["main", "fee", "option"] as const).map((kind) => {
              const rows = f.items.filter((i) => i.kind === kind);
              return (
                <div key={kind}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-extrabold text-brand-950">
                      {KIND_META[kind].label} <span className="font-semibold text-muted">· {KIND_META[kind].hint}</span>
                    </p>
                    <Button size="sm" variant="subtle" onClick={() => addItem(kind)}>
                      <Plus className="size-4" aria-hidden="true" /> بند
                    </Button>
                  </div>
                  {rows.length ? (
                    <ul role="list" className="grid gap-2">
                      {rows.map((it) => (
                        <li key={it.key} className="grid items-end gap-2 rounded-xl border border-line p-3 md:grid-cols-[1.6fr_8rem_6rem_9rem_9rem_auto]">
                          <Field label="الوصف" htmlFor={`it-l-${it.key}`}>
                            <Input id={`it-l-${it.key}`} dir={ar ? "rtl" : "ltr"} value={it.label} onChange={(e) => setItem(it.key, { label: e.target.value })} />
                          </Field>
                          <Field label="الوحدة" htmlFor={`it-u-${it.key}`}>
                            <Select id={`it-u-${it.key}`} value={it.unit} onChange={(e) => setItem(it.key, { unit: e.target.value as ItemUnit, quantity: Math.max(1, qtyFor(e.target.value as ItemUnit)) })}>
                              {ITEM_UNITS.map((u) => (
                                <option key={u} value={u}>
                                  {UNIT_LABELS[u].ar}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          <Field label="الكمية" htmlFor={`it-q-${it.key}`}>
                            <NumberInput id={`it-q-${it.key}`} min={1} value={it.quantity} onChange={(v) => setItem(it.key, { quantity: v ?? 1 })} />
                          </Field>
                          <Field label="سعر الوحدة" htmlFor={`it-p-${it.key}`}>
                            <MoneyInput id={`it-p-${it.key}`} currency={f.currency} value={it.unit_price} onChange={(v) => setItem(it.key, { unit_price: v })} />
                          </Field>
                          <Field
                            label={
                              <span className="inline-flex items-center gap-1 text-accent-700">
                                <Lock className="size-3" aria-hidden="true" /> التكلفة (داخلي)
                              </span>
                            }
                            htmlFor={`it-c-${it.key}`}
                          >
                            <MoneyInput id={`it-c-${it.key}`} currency={f.currency} value={it.unit_cost} onChange={(v) => setItem(it.key, { unit_cost: v })} />
                          </Field>
                          <div className="flex items-center justify-between gap-2 md:flex-col md:items-end">
                            <span className="num text-sm font-black text-brand-900">{money(it.quantity * (it.unit_price ?? 0))}</span>
                            <Button size="sm" variant="ghost" className="text-danger" aria-label="حذف البند" onClick={() => set("items", f.items.filter((x) => x.key !== it.key))}>
                              <Trash2 className="size-4" aria-hidden="true" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}

            <div className="grid gap-3 rounded-xl border border-line bg-mist/50 p-4 sm:grid-cols-3">
              <Field label="الخصم" htmlFor="q-disc-kind">
                <Select id="q-disc-kind" value={f.discount_kind ?? ""} onChange={(e) => setF((x) => ({ ...x, discount_kind: (e.target.value || null) as DiscountKind | null, discount_value: 0 }))}>
                  <option value="">بدون خصم</option>
                  <option value="percent">نسبة مئوية</option>
                  <option value="amount">مبلغ ثابت</option>
                </Select>
              </Field>
              {f.discount_kind ? (
                <>
                  <Field label={f.discount_kind === "percent" ? "النسبة %" : "المبلغ"} htmlFor="q-disc-val" error={err("discount_value")}>
                    {f.discount_kind === "percent" ? (
                      <Input
                        id="q-disc-val"
                        type="number"
                        dir="ltr"
                        min={0}
                        max={100}
                        step={0.5}
                        value={f.discount_value / 100}
                        onChange={(e) => set("discount_value", Math.round(Number(e.target.value || 0) * 100))}
                        className="num"
                      />
                    ) : (
                      <MoneyInput id="q-disc-val" currency={f.currency} value={f.discount_value} onChange={(v) => set("discount_value", v ?? 0)} />
                    )}
                  </Field>
                  <Field label="وصف الخصم" htmlFor="q-disc-label">
                    <Input id="q-disc-label" dir={ar ? "rtl" : "ltr"} value={f.discount_label ?? ""} onChange={(e) => set("discount_label", e.target.value)} placeholder={ar ? "خصم الشركات" : "Corporate discount"} />
                  </Field>
                </>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <dl className="grid gap-2 rounded-xl border border-brand-100 bg-brand-50/50 p-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">المجموع الأساسي</dt>
                  <dd className="num font-bold">{money(totals.subtotal)}</dd>
                </div>
                {totals.fees ? (
                  <div className="flex justify-between">
                    <dt className="text-muted">تكاليف إضافية</dt>
                    <dd className="num font-bold">{money(totals.fees)}</dd>
                  </div>
                ) : null}
                {totals.discount ? (
                  <div className="flex justify-between text-accent-700">
                    <dt>الخصم</dt>
                    <dd className="num font-bold">− {money(totals.discount)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-brand-100 pt-2 text-base">
                  <dt className="font-extrabold text-brand-950">الإجمالي للعميل</dt>
                  <dd className="num font-black text-brand-700">{money(totals.total)}</dd>
                </div>
                {totals.perPerson != null ? (
                  <div className="flex justify-between text-xs">
                    <dt className="text-muted">متوسط للشخص ({totals.pax})</dt>
                    <dd className="num">{money(totals.perPerson)}</dd>
                  </div>
                ) : null}
                {totals.optional ? (
                  <div className="flex justify-between text-xs">
                    <dt className="text-muted">خدمات اختيارية (خارج الإجمالي)</dt>
                    <dd className="num">{money(totals.optional)}</dd>
                  </div>
                ) : null}
              </dl>
              <dl className="grid content-start gap-2 rounded-xl border border-dashed border-accent-300 bg-accent-50/50 p-4 text-sm" aria-label="ملخص داخلي">
                <p className="flex items-center gap-1.5 text-xs font-black text-accent-700">
                  <Lock className="size-3.5" aria-hidden="true" /> داخلي — لا يظهر في صفحة العميل أو ملف PDF
                </p>
                <div className="flex justify-between">
                  <dt className="text-muted">التكلفة</dt>
                  <dd className="num font-bold">{money(margin.cost)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">هامش الربح</dt>
                  <dd className={`num font-black ${margin.margin < 0 ? "text-danger" : "text-[#17663a]"}`}>
                    {money(margin.margin)} <span className="text-xs">({margin.marginPct.toFixed(1)}%)</span>
                  </dd>
                </div>
                {margin.missingCosts ? <p className="text-xs text-accent-700">{margin.missingCosts} بند بلا تكلفة مسجلة.</p> : null}
              </dl>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="الصلاحية والملاحظات والشروط" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="العرض صالح حتى" required htmlFor="q-valid" error={err("valid_until")} hint="بعد هذا التاريخ يصبح العرض منتهي الصلاحية ولا يمكن قبوله.">
              <DateInput id="q-valid" value={f.valid_until} onChange={(v) => set("valid_until", v ?? "")} />
            </Field>
            <div />
            <Field label="ملاحظات للعميل" className="sm:col-span-2" htmlFor="q-notes">
              <Textarea id="q-notes" dir={ar ? "rtl" : "ltr"} rows={3} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
            </Field>
            <Field label="الشروط والأحكام" className="sm:col-span-2" htmlFor="q-terms">
              <Textarea id="q-terms" dir={ar ? "rtl" : "ltr"} rows={6} value={f.terms ?? ""} onChange={(e) => set("terms", e.target.value)} />
            </Field>
            <Field
              label={
                <span className="inline-flex items-center gap-1">
                  <Lock className="size-3.5 text-accent-700" aria-hidden="true" /> ملاحظات داخلية
                </span>
              }
              className="sm:col-span-2"
              htmlFor="q-internal"
              hint="للموظفين فقط."
            >
              <Textarea id="q-internal" rows={2} value={f.internal_notes ?? ""} onChange={(e) => set("internal_notes", e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="الصور" description="صورة الغلاف تظهر في رأس العرض. صور الفنادق تُضاف تلقائياً من بياناتها." />
          <div className="grid gap-6 p-5">
            <ImagePicker label="صورة الغلاف" max={1} value={f.cover ? [f.cover] : []} onChange={(v) => set("cover", v[0] ?? null)} />
            <ImagePicker label="صور إضافية من الوجهة" max={12} value={f.gallery} onChange={(v) => set("gallery", v)} />
          </div>
        </Card>
      </div>

      <aside className="order-first grid content-start gap-4 xl:sticky xl:top-6 xl:order-none xl:max-h-[calc(100svh-3rem)] xl:overflow-y-auto">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            {meta ? <QuoteStatusBadge status={meta.status} /> : <Badge tone="muted">عرض جديد</Badge>}
            {meta ? (
              <span className="num text-xs font-bold text-muted">
                {meta.ref} {meta.revision > 1 ? `· نسخة ${meta.revision}` : ""}
              </span>
            ) : null}
          </div>
          <div className="mt-4 rounded-xl bg-brand-950 p-4 text-white">
            <p className="text-xs text-white/60">{f.pricing_mode === "per_person" ? "السعر للشخص" : f.pricing_mode === "per_room" ? "السعر للغرفة" : "إجمالي المجموعة"}</p>
            <p className="num mt-1 text-2xl font-black">{money(totals.headline.amount)}</p>
            <p className="num mt-1 text-xs text-white/60">الإجمالي: {money(totals.total)}</p>
          </div>
          {meta && meta.status !== "draft" ? <p className="mt-3 text-xs leading-[1.7] text-muted">حفظ التعديلات على عرض مُرسل ينشئ نسخة جديدة، ويرى العميل التحديث على الرابط نفسه.</p> : null}
          <Button variant="primary" className="mt-4 w-full" onClick={save} loading={pending}>
            <Save className="size-4" aria-hidden="true" /> {meta ? "حفظ التعديلات" : "حفظ كمسودة"}
          </Button>
          {dirty && meta ? (
            <p className="mt-2 text-center text-xs font-bold text-accent-700" role="status">
              تغييرات غير محفوظة — احفظ قبل المعاينة أو الإرسال
            </p>
          ) : null}
          {meta ? (
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4">
              <a href={asset(`/q/${meta.token}/`)} target="_blank" rel="noopener" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line text-sm font-bold text-brand-900 hover:bg-brand-50">
                <Eye className="size-4" aria-hidden="true" /> معاينة الصفحة
              </a>
              <a href={asset(`/q/${meta.token}/print/`)} target="_blank" rel="noopener" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line text-sm font-bold text-brand-900 hover:bg-brand-50">
                <FileDown className="size-4" aria-hidden="true" /> معاينة PDF
              </a>
              <a href={asset(`/q/${meta.token}/pdf/`)} className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-brand-50 text-sm font-bold text-brand-800 hover:bg-brand-100">
                <Download className="size-4" aria-hidden="true" /> تنزيل ملف PDF
              </a>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted">بعد الحفظ تظهر خيارات المعاينة وملف PDF والإرسال.</p>
          )}
        </Card>
        {meta ? <QuoteSharePanel meta={meta} contact={f.audience === "traveler" && f.client ? { name: f.client.name, phone: f.client.phone, email: f.client.email } : contact} company={f.audience === "traveler" ? (f.client?.name ?? "") : (company?.name ?? "")} title={f.title} locale={f.locale} canDelete={canDelete} dirty={dirty} portal={f.audience === "company"} /> : null}
      </aside>

      <Modal open={companyModal} onClose={() => setCompanyModal(false)} title="شركة جديدة" wide>
        <CompanyEditor
          compact
          initial={emptyCompanyForm()}
          onSaved={(id) => {
            setCompanyModal(false);
            setF((x) => ({ ...x, company_id: id, contact_id: null }));
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}

/** Chooses a pre-registered tour (countries of this quote first) and where to put it. */
function TourPicker({ tours, quote, onAdd }: { tours: TourItem[]; quote: QuoteFormState; onAdd: (tour: TourItem, target: number | "new", priceAs: "main" | "option" | "none") => void }) {
  const [tourId, setTourId] = useState("");
  const [target, setTarget] = useState("new");
  const [priceAs, setPriceAs] = useState<"main" | "option" | "none">("option");
  const tour = tours.find((t) => String(t.id) === tourId) ?? null;
  const tripCountries = [...new Set(quote.destinations.map((d) => d.country_code))];
  const countries = [...new Set([...tripCountries.filter((c) => tours.some((t) => t.country_code === c)), ...tours.map((t) => t.country_code)])];
  if (!tours.length) {
    return (
      <p className="mb-4 flex items-center gap-2 rounded-xl bg-mist px-3 py-2.5 text-xs text-muted" dir="rtl">
        <Binoculars className="size-4" aria-hidden="true" /> لا توجد جولات مسجلة بعد. سجّلها من «الجولات المسجلة» لتضيفها هنا بنقرة.
      </p>
    );
  }
  return (
    <div className="mb-4 grid gap-3 rounded-xl bg-mist p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end" dir="rtl" data-tour-picker>
      <Field label={<span className="inline-flex items-center gap-1"><Binoculars className="size-4 text-brand-600" aria-hidden="true" /> جولة مسجلة</span>} htmlFor="q-tour" className="sm:col-span-3">
        <Select id="q-tour" value={tourId} onChange={(e) => setTourId(e.target.value)} data-tour-select>
          <option value="">اختر جولة…</option>
          {countries.map((c) => (
            <optgroup key={c} label={`${countryName(c, "ar")}${tripCountries.includes(c) ? " · ضمن وجهات العرض" : ""}`}>
              {tours
                .filter((t) => t.country_code === c)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name_ar}
                    {t.city_ar ? ` — ${t.city_ar}` : ""}
                    {t.price ? ` · ${formatMoney(t.price, t.currency, "ar")}` : ""}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
      </Field>
      <Field label="إضافة إلى" htmlFor="q-tour-day">
        <Select id="q-tour-day" value={target} onChange={(e) => setTarget(e.target.value)} data-tour-day>
          <option value="new">يوم جديد في آخر البرنامج</option>
          {quote.days.map((d, i) => (
            <option key={i} value={i}>
              اليوم {i + 1}
              {d.title ? ` — ${d.title.slice(0, 40)}` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="السعر في العرض" htmlFor="q-tour-price">
        <Select id="q-tour-price" value={priceAs} onChange={(e) => setPriceAs(e.target.value as typeof priceAs)} data-tour-price>
          <option value="option">خدمة اختيارية (خارج الإجمالي)</option>
          <option value="main">بند أساسي (ضمن الإجمالي)</option>
          <option value="none">بدون سعر</option>
        </Select>
      </Field>
      <Button
        variant="primary"
        disabled={!tour}
        data-add-tour
        onClick={() => {
          if (!tour) return;
          onAdd(tour, target === "new" ? "new" : Number(target), priceAs);
          setTourId("");
        }}
      >
        <Plus className="size-4" aria-hidden="true" /> إضافة الجولة
      </Button>
      {tour && priceAs !== "none" && (tour.currency !== quote.currency || !tour.price) ? (
        <p className="text-xs font-bold text-accent-700 sm:col-span-3">
          {!tour.price ? "لا يوجد سعر مسجل لهذه الجولة: سيُضاف وصفها فقط." : `عملة الجولة (${tour.currency}) تختلف عن عملة العرض (${quote.currency}): سيُضاف وصفها فقط، وأدخل سعرها يدوياً.`}
        </p>
      ) : null}
    </div>
  );
}
