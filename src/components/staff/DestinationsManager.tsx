"use client";

import { DownloadCloud, MapPin, Pencil, Plane, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { airportByCode, airportLabel, ALL_AIRPORTS } from "@/lib/airports";
import { COUNTRY_CODES, countryName, flag } from "@/lib/countries";
import { mediaSrc, type MediaRef } from "@/lib/media";
import { deleteDestinationAction, importGeoAction, saveDestinationAction } from "@/server/actions/catalog";
import { AirportDatalist, AirportInput } from "./AirportInput";
import { Bilingual } from "./fields";
import { ImagePicker } from "./ImagePicker";
import { Modal } from "./Modal";
import { Badge, Button, Card, EmptyState, Field, Input, Select, Table, Toggle } from "./ui";
import { useActionRunner } from "./useActionRunner";

export type DestinationKind = "city" | "area";
export const KIND_LABELS: Record<DestinationKind, string> = { city: "مدينة", area: "منطقة سياحية" };

export interface DestinationItem {
  id: number;
  country_code: string;
  name_ar: string;
  name_en: string;
  kind: DestinationKind;
  airport_code: string | null;
  summary_ar: string | null;
  summary_en: string | null;
  cover: MediaRef | null;
  active: boolean;
  /** Built on the server (Intl country names differ between Node and browsers). */
  country_name: string;
  hotels: number;
  programs: number;
}

type FormState = Omit<DestinationItem, "id" | "hotels" | "programs" | "country_name"> & { id?: number; airport_text: string };

const blank = (country: string): FormState => ({
  country_code: country,
  name_ar: "",
  name_en: "",
  kind: "city",
  airport_code: null,
  airport_text: "",
  summary_ar: "",
  summary_en: "",
  cover: null,
  active: true,
});

const PAGE = 120;

export function DestinationsManager({
  items,
  countries,
  reference,
  canEdit,
  canDelete,
}: {
  items: DestinationItem[];
  /** Countries that have destinations, with server-built names. */
  countries: { code: string; name: string; count: number }[];
  /** Reference countries with cities not imported yet. */
  reference: { code: string; name: string; total: number; missing: number }[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [country, setCountry] = useState("");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [showImport, setShowImport] = useState(false);
  const { run, pending } = useActionRunner();
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((d) => (!country || d.country_code === country) && (!needle || `${d.name_ar} ${d.name_en} ${d.country_name} ${d.airport_code ?? ""}`.toLowerCase().includes(needle)));
  }, [items, country, q]);
  const shown = filtered.slice(0, limit);
  const missingTotal = reference.reduce((n, c) => n + c.missing, 0);

  const save = () => {
    if (!form) return;
    run(
      () =>
        saveDestinationAction({
          id: form.id,
          country_code: form.country_code,
          name_ar: form.name_ar,
          name_en: form.name_en,
          kind: form.kind,
          airport_code: form.airport_code,
          summary_ar: form.summary_ar,
          summary_en: form.summary_en,
          cover_media_id: form.cover?.id ?? null,
          active: form.active,
        }),
      { onOk: () => setForm(null), onError: (r) => setErrors(r.fieldErrors ?? {}) },
    );
  };

  const edit = (d: DestinationItem) => {
    setErrors({});
    const a = airportByCode(d.airport_code);
    setForm({ ...d, summary_ar: d.summary_ar ?? "", summary_en: d.summary_en ?? "", airport_text: a ? airportLabel(a) : (d.airport_code ?? "") });
  };

  return (
    <>
      {canEdit && missingTotal > 0 ? (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-600">
                <DownloadCloud className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-extrabold text-brand-950">مدن ووجهات سياحية جاهزة</p>
                <p className="text-sm text-muted">
                  <span className="num font-bold">{missingTotal}</span> مدينة ومنطقة سياحية في <span className="num font-bold">{reference.length}</span> دولة غير مضافة بعد (بالعربية والإنجليزية مع أقرب مطار). الإضافة لا تغيّر وجهاتك الحالية.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowImport((v) => !v)} aria-expanded={showImport}>
                {showImport ? "إخفاء الدول" : "اختيار دول محددة"}
              </Button>
              <Button size="sm" variant="accent" loading={pending} onClick={() => run(() => importGeoAction({ countries: null }), { confirm: `إضافة ${missingTotal} وجهة جاهزة لكل الدول؟` })} data-import-all-geo>
                <DownloadCloud className="size-4" aria-hidden="true" /> إضافة الكل
              </Button>
            </div>
          </div>
          {showImport ? (
            <ul role="list" className="grid gap-2 border-t border-line p-4 sm:grid-cols-2 lg:grid-cols-3">
              {reference.map((c) => (
                <li key={c.code} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
                  <span className="text-sm font-bold text-brand-950">
                    <span aria-hidden="true">{flag(c.code)}</span> {c.name}{" "}
                    <span className="num text-xs font-semibold text-muted">
                      ({c.missing} من {c.total})
                    </span>
                  </span>
                  <Button size="sm" variant="subtle" disabled={pending} onClick={() => run(() => importGeoAction({ countries: [c.code] }))} data-import-geo={c.code}>
                    إضافة
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <div className="grid gap-3 border-b border-line px-5 py-4 md:grid-cols-[1fr_14rem_auto] md:items-center">
          <label className="relative">
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted" aria-hidden="true" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setLimit(PAGE);
              }}
              placeholder="ابحث باسم المدينة أو الدولة أو رمز المطار…"
              className="ps-9"
              aria-label="بحث في الوجهات"
              data-destination-filter
            />
          </label>
          <Select
            aria-label="الدولة"
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setLimit(PAGE);
            }}
            data-destination-country
          >
            <option value="">كل الدول ({items.length})</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.count})
              </option>
            ))}
          </Select>
          {canEdit ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setErrors({});
                setForm(blank(country || "TR"));
              }}
            >
              <Plus className="size-4" aria-hidden="true" /> وجهة جديدة
            </Button>
          ) : null}
        </div>
        <p className="px-5 pt-3 text-xs text-muted">
          <span className="num font-bold text-brand-950">{filtered.length}</span> وجهة · تُستخدم للفلترة في صفحة العروض ولربط الفنادق بالمدن، ومطارها يقترح رحلات الطيران في البرامج.
        </p>
        {shown.length ? (
          <Table label="الوجهات">
            <thead>
              <tr>
                <th>الوجهة</th>
                <th>الدولة</th>
                <th>النوع</th>
                <th>أقرب مطار</th>
                <th>الفنادق</th>
                <th>البرامج</th>
                <th>الحالة</th>
                <th className="w-0" />
              </tr>
            </thead>
            <tbody>
              {shown.map((d) => (
                <tr key={d.id} data-destination-row={d.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      {d.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaSrc(d.cover, 480)} alt="" className="size-11 rounded-lg object-cover" />
                      ) : (
                        <span className="grid size-11 place-items-center rounded-lg bg-mist text-muted">
                          <MapPin className="size-4" aria-hidden="true" />
                        </span>
                      )}
                      <div>
                        <p className="font-bold text-brand-950">{d.name_ar}</p>
                        <p className="text-xs text-muted" dir="ltr">
                          {d.name_en}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap">
                    <span aria-hidden="true">{flag(d.country_code)}</span> {d.country_name}
                  </td>
                  <td className="text-xs">{KIND_LABELS[d.kind]}</td>
                  <td className="num text-xs" dir="ltr">
                    {d.airport_code ? (
                      <span className="inline-flex items-center gap-1">
                        <Plane className="size-3" aria-hidden="true" />
                        {d.airport_code}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="num">{d.hotels}</td>
                  <td className="num">{d.programs}</td>
                  <td>{d.active ? <Badge tone="success">مفعّلة</Badge> : <Badge tone="muted">موقوفة</Badge>}</td>
                  <td>
                    <div className="flex gap-1">
                      {canEdit ? (
                        <Button size="sm" variant="ghost" aria-label={`تعديل ${d.name_ar}`} onClick={() => edit(d)}>
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-danger"
                          aria-label={`حذف ${d.name_ar}`}
                          onClick={() => run(() => deleteDestinationAction(d.id), { confirm: `حذف وجهة «${d.name_ar}»؟` })}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : items.length ? (
          <p className="px-5 py-10 text-center text-sm text-muted">لا توجد وجهات مطابقة للبحث.</p>
        ) : (
          <EmptyState icon={<MapPin className="size-6" />} title="لا توجد وجهات بعد" text="أضف المدن الجاهزة من الأعلى بضغطة واحدة، أو أضف وجهة يدوياً، ثم أضف فنادقها." />
        )}
        {filtered.length > shown.length ? (
          <div className="border-t border-line p-3 text-center">
            <Button size="sm" variant="ghost" onClick={() => setLimit((n) => n + PAGE)}>
              عرض المزيد (<span className="num">{filtered.length - shown.length}</span> متبقية)
            </Button>
          </div>
        ) : null}
      </Card>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? "تعديل الوجهة" : "وجهة جديدة"}
        wide
        footer={
          <>
            <Button onClick={() => setForm(null)}>إلغاء</Button>
            <Button variant="primary" onClick={save} loading={pending}>
              حفظ الوجهة
            </Button>
          </>
        }
      >
        {form ? (
          <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="الدولة" required htmlFor="dest-country">
                <Select id="dest-country" value={form.country_code} onChange={(e) => set("country_code", e.target.value)}>
                  {COUNTRY_CODES.map((c) => (
                    <option key={c} value={c}>
                      {countryName(c, "ar")}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="النوع" htmlFor="dest-kind">
                <Select id="dest-kind" value={form.kind} onChange={(e) => set("kind", e.target.value as DestinationKind)}>
                  {(Object.keys(KIND_LABELS) as DestinationKind[]).map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABELS[k]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Bilingual label="اسم المدينة / الوجهة" required ar={form.name_ar} en={form.name_en} onAr={(v) => set("name_ar", v)} onEn={(v) => set("name_en", v)} errorAr={errors.name_ar ?? errors.name_en} name="dest_name" />
            <Field label="أقرب مطار" htmlFor="dest-airport" error={errors.airport_code} hint="يُقترح تلقائياً كمطار الوصول عند إنشاء برنامج لهذه الوجهة. ابحث بالاسم أو الرمز.">
              <AirportInput
                id="dest-airport"
                listId="dest-airports"
                value={form.airport_text}
                placeholder="مثال: IST"
                onChange={(text, a) => setForm((f) => (f ? { ...f, airport_text: text, airport_code: a ? a.code : text.trim() ? text.trim().toUpperCase() : null } : f))}
              />
              <AirportDatalist id="dest-airports" airports={ALL_AIRPORTS.filter((a) => a.country_code === form.country_code).concat(ALL_AIRPORTS.filter((a) => a.country_code !== form.country_code))} />
            </Field>
            <Bilingual label="نبذة قصيرة" multiline ar={form.summary_ar} en={form.summary_en} onAr={(v) => set("summary_ar", v)} onEn={(v) => set("summary_en", v)} />
            <ImagePicker label="صورة الوجهة" max={1} value={form.cover ? [form.cover] : []} onChange={(v) => set("cover", v[0] ?? null)} />
            <Toggle id="dest-active" checked={form.active} onChange={(v) => set("active", v)} label="وجهة مفعّلة" description="الوجهات الموقوفة لا تظهر عند إنشاء برامج جديدة." />
          </div>
        ) : null}
      </Modal>
    </>
  );
}
