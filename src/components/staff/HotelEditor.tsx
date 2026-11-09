"use client";

import { ExternalLink, MapPinned, Save, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MediaRef } from "@/lib/media";
import { deleteHotelAction, saveHotelAction } from "@/server/actions/catalog";
import { Bilingual } from "./fields";
import { ImagePicker } from "./ImagePicker";
import { Button, Card, CardHeader, Field, Input, Select, Toggle } from "./ui";
import { useActionRunner } from "./useActionRunner";

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
  active: boolean;
  media: MediaRef[];
}

export function HotelEditor({ initial, destinations, canDelete }: { initial: HotelForm; destinations: { id: number; label: string }[]; canDelete: boolean }) {
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { run, pending } = useActionRunner();
  const set = <K extends keyof HotelForm>(k: K, v: HotelForm[K]) => setF((x) => ({ ...x, [k]: v }));

  const save = () =>
    run(
      () =>
        saveHotelAction({
          ...f,
          id: f.id,
          destination_id: f.destination_id ?? 0,
          media: f.media.map((m) => m.id),
        }),
      {
        onOk: (data) => {
          setErrors({});
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
      <div className="grid gap-6">
        <Card>
          <CardHeader title="بيانات الفندق" />
          <div className="grid gap-5 p-5">
            <Bilingual label="اسم الفندق" required ar={f.name_ar} en={f.name_en} onAr={(v) => set("name_ar", v)} onEn={(v) => set("name_en", v)} errorAr={errors.name_ar ?? errors.name_en} name="hotel_name" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="المدينة / الوجهة" required error={errors.destination_id} htmlFor="hotel-dest" hint="الدولة والمدينة تُؤخذ من الوجهة.">
                <Select id="hotel-dest" value={f.destination_id ?? ""} onChange={(e) => set("destination_id", e.target.value ? Number(e.target.value) : null)}>
                  <option value="">اختر الوجهة…</option>
                  {destinations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <fieldset>
                <legend className="mb-1.5 text-sm font-bold text-brand-950">التصنيف (النجوم)</legend>
                <div className="flex h-11 items-center gap-1" role="radiogroup" aria-label="عدد النجوم">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={f.stars === n}
                      aria-label={`${n} نجوم`}
                      onClick={() => set("stars", f.stars === n ? null : n)}
                      className="rounded-lg p-1.5 hover:bg-accent-50"
                    >
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
            <Bilingual label="الغرف ومعلومات السكن" multiline rows={3} hint="أنواع الغرف المتاحة، الإطلالات، وقت الدخول والخروج…" ar={f.rooms_ar} en={f.rooms_en} onAr={(v) => set("rooms_ar", v)} onEn={(v) => set("rooms_en", v)} />
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
          <CardHeader title="صور الفندق" description="الصورة الأولى هي الصورة الرئيسية. يُفضّل عرض 1600 بكسل أو أكثر." />
          <div className="p-5">
            <ImagePicker label="الصور" coverFirst max={16} value={f.media} onChange={(v) => set("media", v)} />
          </div>
        </Card>
      </div>

      <aside className="grid content-start gap-4 xl:sticky xl:top-6">
        <Card className="p-5">
          <Toggle id="hotel-active" checked={f.active} onChange={(v) => set("active", v)} label="فندق مفعّل" description="الفنادق الموقوفة لا تظهر في القوائم الجديدة." />
          <div className="mt-5 grid gap-2">
            <Button variant="primary" onClick={save} loading={pending}>
              <Save className="size-4" aria-hidden="true" /> حفظ الفندق
            </Button>
            {f.id && canDelete ? (
              <Button
                variant="danger"
                onClick={() => run(() => deleteHotelAction(f.id!), { confirm: "حذف هذا الفندق نهائياً؟", onOk: () => router.push("/staff/hotels/") })}
              >
                <Trash2 className="size-4" aria-hidden="true" /> حذف
              </Button>
            ) : null}
          </div>
        </Card>
        <Card className="p-5 text-sm leading-[1.8] text-muted">
          <p className="mb-1 flex items-center gap-2 font-bold text-brand-950">
            <MapPinned className="size-4 text-brand-600" aria-hidden="true" /> أين يظهر الرابط؟
          </p>
          في صفحة البرنامج يفتح اسم الفندق صفحة الفندق داخل الموقع. في عرض السعر الإلكتروني وملف PDF يفتح الموقع الرسمي، أو خرائط Google عند عدم توفره.
        </Card>
      </aside>
    </div>
  );
}
