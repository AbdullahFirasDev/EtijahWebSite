"use client";

import { Archive, ArchiveRestore, ExternalLink, Lock, Plus, Save, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MediaRef } from "@/lib/media";
import { deleteHotelAction, saveHotelAction } from "@/server/actions/catalog";
import { Bilingual, NumberInput, StringList } from "./fields";
import { ImagePicker } from "./ImagePicker";
import { Badge, Button, Card, CardHeader, Field, Input, Select, Textarea } from "./ui";
import { useActionRunner } from "./useActionRunner";

export interface RoomTypeForm {
  id: string | null;
  name_ar: string;
  name_en: string | null;
  max_pax: number;
  notes: string | null;
}

export interface HotelForm {
  id?: number;
  destination_id: number | null;
  name_ar: string;
  name_en: string;
  stars: number | null;
  category_ar: string | null;
  category_en: string | null;
  website_url: string | null;
  maps_url: string | null;
  address_ar: string | null;
  address_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  rooms_ar: string | null;
  rooms_en: string | null;
  amenities: string[];
  contact: { phone: string | null; email: string | null; person: string | null };
  internal_notes: string | null;
  status: "active" | "archived";
  media: MediaRef[];
  room_types: RoomTypeForm[];
}

export interface HotelDestinationOption {
  id: number;
  label: string;
  country_code: string;
  kind: "city" | "area";
  active: boolean;
}

export function HotelEditor({
  initial,
  destinations,
  countries,
  canDelete,
  canEdit,
}: {
  initial: HotelForm;
  destinations: HotelDestinationOption[];
  /** Countries with destinations (names built on the server). */
  countries: { code: string; name: string }[];
  canDelete: boolean;
  canEdit: boolean;
}) {
  const [f, setF] = useState(initial);
  const [country, setCountry] = useState(() => destinations.find((d) => d.id === initial.destination_id)?.country_code ?? countries[0]?.code ?? "");
  const cityOptions = destinations.filter((d) => d.country_code === country && (d.active || d.id === f.destination_id));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { run, pending } = useActionRunner();
  const set = <K extends keyof HotelForm>(k: K, v: HotelForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const setRoom = (i: number, patch: Partial<RoomTypeForm>) => set("room_types", f.room_types.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = (status = f.status) =>
    run(
      () =>
        saveHotelAction({
          ...f,
          status,
          id: f.id,
          destination_id: f.destination_id ?? 0,
          media: f.media.map((m) => m.id),
        }),
      {
        onOk: (data) => {
          setErrors({});
          set("status", status);
          if (!f.id) router.replace(`/staff/hotels/${data.id}/`);
        },
        onError: (r) => setErrors(r.fieldErrors ?? {}),
      },
    );

  const testLink = (url: string | null) =>
    url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline">
        <ExternalLink className="size-3" aria-hidden="true" /> اختبار الرابط
      </a>
    ) : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
      <fieldset disabled={!canEdit} className="grid min-w-0 gap-6">
        <Card>
          <CardHeader title="بيانات الفندق" />
          <div className="grid gap-5 p-5">
            <Bilingual label="اسم الفندق" required ar={f.name_ar} en={f.name_en} onAr={(v) => set("name_ar", v)} onEn={(v) => set("name_en", v)} errorAr={errors.name_ar ?? errors.name_en} name="hotel_name" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-4 sm:grid-cols-2 sm:col-span-2">
                <Field label="الدولة" required htmlFor="hotel-country">
                  <Select
                    id="hotel-country"
                    value={country}
                    onChange={(e) => {
                      setCountry(e.target.value);
                      if (destinations.find((d) => d.id === f.destination_id)?.country_code !== e.target.value) set("destination_id", null);
                    }}
                  >
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="المدينة / الوجهة" required error={errors.destination_id} htmlFor="hotel-dest" hint="غير موجودة؟ أضفها من «الدول والوجهات».">
                  <Select id="hotel-dest" value={f.destination_id ?? ""} onChange={(e) => set("destination_id", e.target.value ? Number(e.target.value) : null)}>
                    <option value="">اختر المدينة…</option>
                    {(["city", "area"] as const).map((k) =>
                      cityOptions.some((d) => d.kind === k) ? (
                        <optgroup key={k} label={k === "city" ? "المدن" : "مناطق سياحية"}>
                          {cityOptions
                            .filter((d) => d.kind === k)
                            .map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.label}
                              </option>
                            ))}
                        </optgroup>
                      ) : null,
                    )}
                  </Select>
                </Field>
              </div>
              <fieldset>
                <legend className="mb-1.5 text-sm font-bold text-brand-950">التصنيف (النجوم)</legend>
                <div className="flex h-11 items-center gap-1" role="radiogroup" aria-label="عدد النجوم">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={f.stars === n} aria-label={`${n} نجوم`} onClick={() => set("stars", f.stars === n ? null : n)} className="rounded-lg p-1.5 hover:bg-accent-50">
                      <Star className={`size-6 ${f.stars && n <= f.stars ? "fill-accent-500 text-accent-500" : "text-line"}`} aria-hidden="true" />
                    </button>
                  ))}
                  <span className="ms-2 text-sm text-muted">{f.stars ? `${f.stars} نجوم` : "بدون تصنيف"}</span>
                </div>
              </fieldset>
            </div>
            <Bilingual label="فئة الفندق" hint="مثال: منتجع، فندق بوتيك، شقق فندقية." ar={f.category_ar} en={f.category_en} onAr={(v) => set("category_ar", v)} onEn={(v) => set("category_en", v)} />
            <Bilingual label="العنوان" ar={f.address_ar} en={f.address_en} onAr={(v) => set("address_ar", v)} onEn={(v) => set("address_en", v)} />
            <Bilingual label="وصف الفندق" multiline rows={4} ar={f.description_ar} en={f.description_en} onAr={(v) => set("description_ar", v)} onEn={(v) => set("description_en", v)} />
            <Bilingual label="معلومات السكن" multiline rows={2} hint="الإطلالات، وقت الدخول والخروج…" ar={f.rooms_ar} en={f.rooms_en} onAr={(v) => set("rooms_ar", v)} onEn={(v) => set("rooms_en", v)} />
            <StringList label="الخدمات والمرافق" value={f.amenities} onChange={(v) => set("amenities", v)} placeholder="مثال: مسبح، واي فاي مجاني، موقف سيارات" />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="أنواع الغرف"
            description="عرّف أنواع الغرف وسعتها، ثم أضف أسعار الليلة لكل نوع في قسم «الأسعار»."
            actions={
              <Button size="sm" variant="subtle" onClick={() => set("room_types", [...f.room_types, { id: null, name_ar: "", name_en: null, max_pax: 2, notes: null }])}>
                <Plus className="size-4" aria-hidden="true" /> نوع غرفة
              </Button>
            }
          />
          <div className="p-5">
            {f.room_types.length ? (
              <ul role="list" className="grid gap-3">
                {f.room_types.map((r, i) => (
                  <li key={r.id ?? `new-${i}`} className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-[1fr_1fr_7rem_auto] sm:items-end">
                    <Field label="نوع الغرفة (عربي)" required>
                      <Input value={r.name_ar} onChange={(e) => setRoom(i, { name_ar: e.target.value })} placeholder="مثال: غرفة مزدوجة مطلة على البحر" data-room-name={i} />
                    </Field>
                    <Field label="English">
                      <Input dir="ltr" className="text-left" value={r.name_en ?? ""} onChange={(e) => setRoom(i, { name_en: e.target.value || null })} placeholder="Sea view double" />
                    </Field>
                    <Field label="عدد الأشخاص">
                      <NumberInput value={r.max_pax} min={1} max={20} onChange={(v) => setRoom(i, { max_pax: v ?? 1 })} aria-label="عدد الأشخاص" />
                    </Field>
                    <Button size="sm" variant="ghost" className="h-11 text-danger" aria-label="حذف نوع الغرفة" onClick={() => set("room_types", f.room_types.filter((_, j) => j !== i))}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">لا توجد أنواع غرف بعد. أضف نوعاً واحداً على الأقل لتتمكن من حفظ الأسعار.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="الروابط المعتمدة" description="يصبح اسم الفندق رابطاً قابلاً للنقر في الموقع وعروض الأسعار وملفات PDF. استخدم روابط حقيقية تم التحقق منها فقط." />
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <Field label="الموقع الرسمي للفندق" error={errors.website_url} hint="الرابط الأساسي لاسم الفندق." htmlFor="hotel-web">
              <Input id="hotel-web" type="url" dir="ltr" inputMode="url" placeholder="https://" value={f.website_url ?? ""} onChange={(e) => set("website_url", e.target.value)} className="text-left" />
              {testLink(f.website_url)}
            </Field>
            <Field label="رابط خرائط Google" error={errors.maps_url} hint="يُستخدم إذا لم يتوفر موقع رسمي." htmlFor="hotel-maps">
              <Input id="hotel-maps" type="url" dir="ltr" inputMode="url" placeholder="https://maps.app.goo.gl/…" value={f.maps_url ?? ""} onChange={(e) => set("maps_url", e.target.value)} className="text-left" />
              {testLink(f.maps_url)}
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="معلومات التواصل والملاحظات الداخلية" description="للموظفين فقط. لا تظهر في الموقع أو عروض الأسعار أو بوابة الشركات." />
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Field label="الشخص المسؤول">
              <Input value={f.contact.person ?? ""} onChange={(e) => set("contact", { ...f.contact, person: e.target.value || null })} />
            </Field>
            <Field label="الهاتف">
              <Input dir="ltr" className="num text-left" value={f.contact.phone ?? ""} onChange={(e) => set("contact", { ...f.contact, phone: e.target.value || null })} />
            </Field>
            <Field label="البريد الإلكتروني" error={errors["contact.email"]}>
              <Input dir="ltr" type="email" className="text-left" value={f.contact.email ?? ""} onChange={(e) => set("contact", { ...f.contact, email: e.target.value || null })} />
            </Field>
            <Field label="ملاحظات داخلية" className="sm:col-span-3">
              <Textarea rows={3} value={f.internal_notes ?? ""} onChange={(e) => set("internal_notes", e.target.value || null)} placeholder="شروط الدفع، جهة الحجز، ملاحظات التعامل…" />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="صور الفندق" description="الصورة الأولى هي الصورة الرئيسية. يُفضّل عرض 1600 بكسل أو أكثر." />
          <div className="p-5">
            <ImagePicker label="الصور" coverFirst max={16} value={f.media} onChange={(v) => set("media", v)} />
          </div>
        </Card>
      </fieldset>

      <aside className="grid content-start gap-4 xl:sticky xl:top-6">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-brand-950">الحالة</p>
            {f.status === "active" ? <Badge tone="success">مفعّل في المكتبة</Badge> : <Badge tone="muted">مؤرشف</Badge>}
          </div>
          <p className="mt-2 text-xs leading-[1.8] text-muted">الفنادق المؤرشفة لا تظهر عند إنشاء برامج أو عروض جديدة، وتبقى البرامج السابقة كما هي.</p>
          {canEdit ? (
            <div className="mt-5 grid gap-2">
              <Button variant="primary" onClick={() => save()} loading={pending} data-save-hotel>
                <Save className="size-4" aria-hidden="true" /> حفظ الفندق
              </Button>
              {f.id ? (
                f.status === "active" ? (
                  <Button variant="outline" onClick={() => save("archived")} disabled={pending}>
                    <Archive className="size-4" aria-hidden="true" /> أرشفة الفندق
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => save("active")} disabled={pending}>
                    <ArchiveRestore className="size-4" aria-hidden="true" /> إعادة التفعيل
                  </Button>
                )
              ) : null}
              {f.id && canDelete ? (
                <Button variant="danger" onClick={() => run(() => deleteHotelAction(f.id!), { confirm: "حذف هذا الفندق نهائياً؟ (مسموح فقط إن لم يُستخدم في أي برنامج أو عرض)", onOk: () => router.push("/staff/hotels/") })}>
                  <Trash2 className="size-4" aria-hidden="true" /> حذف
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-mist px-3 py-2 text-xs font-bold text-muted">
              <Lock className="size-3.5" aria-hidden="true" /> عرض فقط — لا تملك صلاحية التعديل.
            </p>
          )}
        </Card>
        <Card className="p-5 text-sm leading-[1.8] text-muted">
          <p className="mb-1 font-bold text-brand-950">كيف تُستخدم المكتبة؟</p>
          أدخل الفندق وأسعاره مرة واحدة هنا، فيظهر تلقائياً عند إنشاء أي برنامج أو عرض سعر لاحقاً. يمكن تعديل السعر داخل برنامج معيّن دون التأثير على سعر المكتبة.
        </Card>
      </aside>
    </div>
  );
}
