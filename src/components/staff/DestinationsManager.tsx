"use client";

import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { COUNTRY_CODES, countryName, flag } from "@/lib/countries";
import { mediaSrc, type MediaRef } from "@/lib/media";
import { deleteDestinationAction, saveDestinationAction } from "@/server/actions/catalog";
import { Bilingual } from "./fields";
import { ImagePicker } from "./ImagePicker";
import { Modal } from "./Modal";
import { Badge, Button, Card, EmptyState, Field, Select, Table, Toggle } from "./ui";
import { useActionRunner } from "./useActionRunner";

export interface DestinationItem {
  id: number;
  country_code: string;
  name_ar: string;
  name_en: string;
  summary_ar: string | null;
  summary_en: string | null;
  cover: MediaRef | null;
  active: boolean;
  hotels: number;
  programs: number;
}

const blank = (): Omit<DestinationItem, "id" | "hotels" | "programs"> & { id?: number } => ({
  country_code: "TR",
  name_ar: "",
  name_en: "",
  summary_ar: "",
  summary_en: "",
  cover: null,
  active: true,
});

export function DestinationsManager({ items, canEdit, canDelete }: { items: DestinationItem[]; canEdit: boolean; canDelete: boolean }) {
  const [form, setForm] = useState<ReturnType<typeof blank> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending } = useActionRunner();
  const set = <K extends keyof ReturnType<typeof blank>>(k: K, v: ReturnType<typeof blank>[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = () => {
    if (!form) return;
    run(
      () =>
        saveDestinationAction({
          id: form.id,
          country_code: form.country_code,
          name_ar: form.name_ar,
          name_en: form.name_en,
          summary_ar: form.summary_ar,
          summary_en: form.summary_en,
          cover_media_id: form.cover?.id ?? null,
          active: form.active,
        }),
      { onOk: () => setForm(null), onError: (r) => setErrors(r.fieldErrors ?? {}) },
    );
  };

  return (
    <>
      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <p className="text-sm text-muted">
            <span className="num font-bold text-brand-950">{items.length}</span> وجهة · تُستخدم للفلترة في صفحة العروض ولربط الفنادق بالمدن.
          </p>
          {canEdit ? (
            <Button variant="primary" size="sm" onClick={() => (setErrors({}), setForm(blank()))}>
              <Plus className="size-4" aria-hidden="true" /> وجهة جديدة
            </Button>
          ) : null}
        </div>
        {items.length ? (
          <Table label="الوجهات">
            <thead>
              <tr>
                <th>الوجهة</th>
                <th>الدولة</th>
                <th>الفنادق</th>
                <th>البرامج</th>
                <th>الحالة</th>
                <th className="w-0" />
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
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
                  <td>
                    <span aria-hidden="true">{flag(d.country_code)}</span> {countryName(d.country_code, "ar")}
                  </td>
                  <td className="num">{d.hotels}</td>
                  <td className="num">{d.programs}</td>
                  <td>{d.active ? <Badge tone="success">مفعّلة</Badge> : <Badge tone="muted">موقوفة</Badge>}</td>
                  <td>
                    <div className="flex gap-1">
                      {canEdit ? (
                        <Button size="sm" variant="ghost" aria-label={`تعديل ${d.name_ar}`} onClick={() => (setErrors({}), setForm({ ...d, summary_ar: d.summary_ar ?? "", summary_en: d.summary_en ?? "" }))}>
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
        ) : (
          <EmptyState icon={<MapPin className="size-6" />} title="لا توجد وجهات بعد" text="ابدأ بإضافة المدن التي تنظّمون إليها الرحلات، مثل إسطنبول أو دبي، ثم أضف فنادقها." />
        )}
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
            <Field label="الدولة" required htmlFor="dest-country">
              <Select id="dest-country" value={form.country_code} onChange={(e) => set("country_code", e.target.value)}>
                {COUNTRY_CODES.map((c) => (
                  <option key={c} value={c}>
                    {countryName(c, "ar")}
                  </option>
                ))}
              </Select>
            </Field>
            <Bilingual label="اسم المدينة / الوجهة" required ar={form.name_ar} en={form.name_en} onAr={(v) => set("name_ar", v)} onEn={(v) => set("name_en", v)} errorAr={errors.name_ar ?? errors.name_en} name="dest_name" />
            <Bilingual label="نبذة قصيرة" multiline ar={form.summary_ar} en={form.summary_en} onAr={(v) => set("summary_ar", v)} onEn={(v) => set("summary_en", v)} />
            <ImagePicker label="صورة الوجهة" max={1} value={form.cover ? [form.cover] : []} onChange={(v) => set("cover", v[0] ?? null)} />
            <Toggle id="dest-active" checked={form.active} onChange={(v) => set("active", v)} label="وجهة مفعّلة" description="الوجهات الموقوفة لا تظهر عند إنشاء برامج جديدة." />
          </div>
        ) : null}
      </Modal>
    </>
  );
}
