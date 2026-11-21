"use client";

import { Clock3, Lock, MapPin, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { COUNTRY_CODES, countryName, flag } from "@/lib/countries";
import { CURRENCIES, formatMoney, type CurrencyCode } from "@/lib/money";
import { deleteTourAction, saveTourAction } from "@/server/actions/tours";
import { Bilingual, MoneyInput } from "./fields";
import { Modal } from "./Modal";
import { Badge, Button, Card, EmptyState, Field, Input, Select, Table, Toggle } from "./ui";
import { useActionRunner } from "./useActionRunner";

export interface TourForm {
  id?: number;
  country_code: string;
  city_ar: string | null;
  city_en: string | null;
  name_ar: string;
  name_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  duration_ar: string | null;
  duration_en: string | null;
  currency: string;
  price: number | null;
  cost: number | null;
  active: boolean;
}

export function ToursManager({ items, canEdit, canCosts, currencies, defaultCurrency }: { items: TourForm[]; canEdit: boolean; canCosts: boolean; currencies: string[]; defaultCurrency: string }) {
  const [form, setForm] = useState<TourForm | null>(null);
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const { run, pending } = useActionRunner();
  const set = <K extends keyof TourForm>(k: K, v: TourForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const countries = useMemo(() => [...new Set(items.map((t) => t.country_code))], [items]);
  const rows = items.filter((t) => (!country || t.country_code === country) && (!q.trim() || [t.name_ar, t.name_en, t.city_ar, t.city_en].some((v) => v?.toLowerCase().includes(q.trim().toLowerCase()))));

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted" aria-hidden="true" />
              <Input aria-label="بحث في الجولات" placeholder="بحث بالاسم أو المدينة…" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 w-64 ps-9" />
            </div>
            <Select aria-label="الدولة" value={country} onChange={(e) => setCountry(e.target.value)} className="h-10 w-48">
              <option value="">كل الدول</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {countryName(c, "ar")}
                </option>
              ))}
            </Select>
          </div>
          {canEdit ? (
            <Button variant="primary" size="sm" data-new-tour onClick={() => setForm({ country_code: country || "TR", city_ar: null, city_en: null, name_ar: "", name_en: null, description_ar: null, description_en: null, duration_ar: null, duration_en: null, currency: defaultCurrency, price: null, cost: null, active: true })}>
              <Plus className="size-4" aria-hidden="true" /> جولة جديدة
            </Button>
          ) : null}
        </div>
        {rows.length ? (
          <Table label="الجولات المسجلة">
            <thead>
              <tr>
                <th>الجولة</th>
                <th>الوجهة</th>
                <th>المدة</th>
                <th>السعر للشخص</th>
                {canCosts ? <th>التكلفة (داخلي)</th> : null}
                <th>الحالة</th>
                <th className="w-0" />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} data-tour-row>
                  <td>
                    <p className="font-bold text-brand-950">{t.name_ar}</p>
                    {t.name_en ? (
                      <p dir="ltr" className="text-start text-xs text-muted">
                        {t.name_en}
                      </p>
                    ) : null}
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden="true">{flag(t.country_code)}</span>
                      {[t.city_ar, countryName(t.country_code, "ar")].filter(Boolean).join("، ")}
                    </span>
                  </td>
                  <td className="text-muted">{t.duration_ar ?? "—"}</td>
                  <td className="num font-bold">{t.price ? formatMoney(t.price, t.currency, "ar") : <span className="text-muted">بدون سعر</span>}</td>
                  {canCosts ? <td className="num text-muted">{t.cost != null ? formatMoney(t.cost, t.currency, "ar") : "—"}</td> : null}
                  <td>{t.active ? <Badge tone="success">مفعّلة</Badge> : <Badge tone="muted">موقوفة</Badge>}</td>
                  <td>
                    {canEdit ? (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" aria-label={`تعديل ${t.name_ar}`} onClick={() => setForm(t)}>
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-danger" aria-label={`حذف ${t.name_ar}`} onClick={() => run(() => deleteTourAction(t.id!), { confirm: `حذف جولة «${t.name_ar}»؟ البرامج والعروض التي أُضيفت إليها تحتفظ بنسختها.` })}>
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<MapPin className="size-6" />} title={items.length ? "لا توجد نتائج" : "لا توجد جولات مسجلة بعد"} text="سجّل الجولات السياحية والرحلات اليومية مرة واحدة (الاسم، الوصف، المدة، السعر)، ثم أضفها بنقرة إلى أيام البرامج وعروض الأسعار." />
        )}
      </Card>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? "تعديل الجولة" : "جولة جديدة"}
        wide
        footer={
          <>
            <Button onClick={() => setForm(null)}>إلغاء</Button>
            <Button variant="primary" loading={pending} data-save-tour onClick={() => form && run(() => saveTourAction({ ...form, price: form.price ?? 0 }), { onOk: () => setForm(null) })}>
              حفظ
            </Button>
          </>
        }
      >
        {form ? (
          <div className="grid gap-5">
            <Bilingual label="اسم الجولة" required ar={form.name_ar} en={form.name_en} onAr={(v) => set("name_ar", v)} onEn={(v) => set("name_en", v || null)} maxLength={160} name="tour-name" />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="الدولة" required htmlFor="tour-country">
                <Select id="tour-country" value={form.country_code} onChange={(e) => set("country_code", e.target.value)}>
                  {COUNTRY_CODES.map((c) => (
                    <option key={c} value={c}>
                      {countryName(c, "ar")}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="المدينة · عربي" htmlFor="tour-city-ar">
                <Input id="tour-city-ar" value={form.city_ar ?? ""} onChange={(e) => set("city_ar", e.target.value || null)} placeholder="إسطنبول" />
              </Field>
              <Field label="المدينة · English" htmlFor="tour-city-en">
                <Input id="tour-city-en" dir="ltr" className="text-left" value={form.city_en ?? ""} onChange={(e) => set("city_en", e.target.value || null)} placeholder="Istanbul" />
              </Field>
            </div>
            <Bilingual label="الوصف" multiline rows={4} ar={form.description_ar} en={form.description_en} onAr={(v) => set("description_ar", v || null)} onEn={(v) => set("description_en", v || null)} hint="ما تشمله الجولة: الأماكن، النقل، الدخول، الغداء…" />
            <Bilingual
              label={
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="size-3.5" aria-hidden="true" /> المدة
                </span>
              }
              ar={form.duration_ar}
              en={form.duration_en}
              onAr={(v) => set("duration_ar", v || null)}
              onEn={(v) => set("duration_en", v || null)}
              maxLength={60}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="العملة" htmlFor="tour-cur">
                <Select id="tour-cur" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                  {currencies.map((c) => (
                    <option key={c} value={c}>
                      {CURRENCIES[c as CurrencyCode]?.nameAr ?? c} ({c})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="السعر للشخص" htmlFor="tour-price" hint="يُنسخ إلى العرض عند الإضافة.">
                <MoneyInput id="tour-price" key={`p-${form.id ?? "new"}`} currency={form.currency} value={form.price} onChange={(v) => set("price", v)} />
              </Field>
              {canCosts ? (
                <Field
                  label={
                    <span className="inline-flex items-center gap-1 text-accent-700">
                      <Lock className="size-3" aria-hidden="true" /> التكلفة للشخص (داخلي)
                    </span>
                  }
                  htmlFor="tour-cost"
                >
                  <MoneyInput id="tour-cost" key={`c-${form.id ?? "new"}`} currency={form.currency} value={form.cost} onChange={(v) => set("cost", v)} />
                </Field>
              ) : null}
            </div>
            <Toggle id="tour-active" checked={form.active} onChange={(v) => set("active", v)} label="جولة مفعّلة" description="الجولات الموقوفة لا تظهر عند إضافة جولة إلى برنامج أو عرض." />
          </div>
        ) : null}
      </Modal>
    </>
  );
}
