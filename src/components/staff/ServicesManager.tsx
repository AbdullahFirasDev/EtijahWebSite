"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ServiceIcon } from "@/components/travel/ServiceIcon";
import { SERVICE_ICONS } from "@/lib/travel-labels";
import { deleteServiceAction, saveServiceAction } from "@/server/actions/catalog";
import { Bilingual, NumberInput } from "./fields";
import { Modal } from "./Modal";
import { Badge, Button, Card, Field, Table, Toggle } from "./ui";
import { useActionRunner } from "./useActionRunner";

export interface ServiceItem {
  id?: number;
  icon: string;
  name_ar: string;
  name_en: string;
  sort: number;
  active: boolean;
  programs?: number;
}

export function ServicesManager({ items, canEdit, canDelete }: { items: ServiceItem[]; canEdit: boolean; canDelete: boolean }) {
  const [form, setForm] = useState<ServiceItem | null>(null);
  const { run, pending } = useActionRunner();
  const set = <K extends keyof ServiceItem>(k: K, v: ServiceItem[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <>
      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <p className="text-sm text-muted">تظهر الخدمات بأيقوناتها في بطاقات العروض وقوائم «يشمل / لا يشمل».</p>
          {canEdit ? (
            <Button variant="primary" size="sm" onClick={() => setForm({ icon: "check", name_ar: "", name_en: "", sort: (items.at(-1)?.sort ?? 0) + 10, active: true })}>
              <Plus className="size-4" aria-hidden="true" /> خدمة جديدة
            </Button>
          ) : null}
        </div>
        <Table label="الخدمات">
          <thead>
            <tr>
              <th>الخدمة</th>
              <th>English</th>
              <th>مستخدمة في</th>
              <th>الحالة</th>
              <th className="w-0" />
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <td>
                  <span className="flex items-center gap-3 font-bold text-brand-950">
                    <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-600">
                      <ServiceIcon name={s.icon} />
                    </span>
                    {s.name_ar}
                  </span>
                </td>
                <td dir="ltr" className="text-start">
                  {s.name_en}
                </td>
                <td className="num">{s.programs} برنامج</td>
                <td>{s.active ? <Badge tone="success">مفعّلة</Badge> : <Badge tone="muted">موقوفة</Badge>}</td>
                <td>
                  <div className="flex gap-1">
                    {canEdit ? (
                      <Button size="sm" variant="ghost" aria-label={`تعديل ${s.name_ar}`} onClick={() => setForm(s)}>
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button size="sm" variant="ghost" className="text-danger" aria-label={`حذف ${s.name_ar}`} onClick={() => run(() => deleteServiceAction(s.id!), { confirm: `حذف خدمة «${s.name_ar}»؟` })}>
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? "تعديل الخدمة" : "خدمة جديدة"}
        footer={
          <>
            <Button onClick={() => setForm(null)}>إلغاء</Button>
            <Button variant="primary" loading={pending} onClick={() => form && run(() => saveServiceAction({ ...form, icon: form.icon as (typeof SERVICE_ICONS)[number] }), { onOk: () => setForm(null) })}>
              حفظ
            </Button>
          </>
        }
      >
        {form ? (
          <div className="grid gap-5">
            <Bilingual label="اسم الخدمة" required ar={form.name_ar} en={form.name_en} onAr={(v) => set("name_ar", v)} onEn={(v) => set("name_en", v)} />
            <fieldset>
              <legend className="mb-2 text-sm font-bold text-brand-950">الأيقونة</legend>
              <div className="flex flex-wrap gap-2">
                {SERVICE_ICONS.map((icon) => (
                  <label key={icon} className={`grid size-11 cursor-pointer place-items-center rounded-xl border ${form.icon === icon ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-muted hover:border-brand-200"}`}>
                    <input type="radio" name="service-icon" value={icon} checked={form.icon === icon} onChange={() => set("icon", icon)} className="sr-only" aria-label={icon} />
                    <ServiceIcon name={icon} className="size-5" />
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="الترتيب" hint="الأصغر يظهر أولاً." htmlFor="svc-sort">
              <NumberInput id="svc-sort" value={form.sort} onChange={(v) => set("sort", v ?? 0)} />
            </Field>
            <Toggle id="svc-active" checked={form.active} onChange={(v) => set("active", v)} label="خدمة مفعّلة" />
          </div>
        ) : null}
      </Modal>
    </>
  );
}
