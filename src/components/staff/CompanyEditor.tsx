"use client";

import { Mail, Pencil, Phone, Plus, Save, Star, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteCompanyAction, deleteContactAction, saveCompanyAction, saveContactAction } from "@/server/actions/companies";
import { Modal } from "./Modal";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Textarea, Toggle } from "./ui";
import { useActionRunner } from "./useActionRunner";

export interface CompanyForm {
  id: number | null;
  name: string;
  name_en: string | null;
  industry: string | null;
  city: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

export function CompanyEditor({ initial, canDelete, onSaved, compact }: { initial: CompanyForm; canDelete?: boolean; onSaved?: (id: number) => void; compact?: boolean }) {
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { run, pending } = useActionRunner();
  const set = <K extends keyof CompanyForm>(k: K, v: CompanyForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = () =>
    run(() => saveCompanyAction(f), {
      onOk: (d) => {
        setErrors({});
        if (onSaved) onSaved(d.id);
        else if (!f.id) router.replace(`/staff/companies/${d.id}/`);
      },
      onError: (r) => setErrors(r.fieldErrors ?? {}),
    });

  const fields = (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="اسم الشركة" required error={errors.name} htmlFor="co-name">
        <Input id="co-name" value={f.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="الاسم بالإنجليزية" hint="يظهر في عروض الأسعار الإنجليزية." htmlFor="co-name-en">
        <Input id="co-name-en" dir="ltr" className="text-left" value={f.name_en ?? ""} onChange={(e) => set("name_en", e.target.value)} />
      </Field>
      <Field label="القطاع / النشاط" htmlFor="co-industry">
        <Input id="co-industry" value={f.industry ?? ""} onChange={(e) => set("industry", e.target.value)} placeholder="مثال: نفط وطاقة، تعليم، مصارف" />
      </Field>
      <Field label="المدينة" htmlFor="co-city">
        <Input id="co-city" value={f.city ?? ""} onChange={(e) => set("city", e.target.value)} />
      </Field>
      <Field label="الهاتف" htmlFor="co-phone">
        <Input id="co-phone" dir="ltr" className="text-start" value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
      </Field>
      <Field label="البريد الإلكتروني" error={errors.email} htmlFor="co-email">
        <Input id="co-email" type="email" dir="ltr" className="text-start" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} />
      </Field>
      {!compact ? (
        <>
          <Field label="الموقع الإلكتروني" error={errors.website} htmlFor="co-web">
            <Input id="co-web" type="url" dir="ltr" className="text-left" placeholder="https://" value={f.website ?? ""} onChange={(e) => set("website", e.target.value)} />
          </Field>
          <Field label="العنوان" htmlFor="co-address">
            <Input id="co-address" value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <Field label="ملاحظات داخلية" className="sm:col-span-2" htmlFor="co-notes" hint="لا تظهر للعميل.">
            <Textarea id="co-notes" rows={3} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </>
      ) : null}
    </div>
  );

  if (compact)
    return (
      <div className="grid gap-4">
        {fields}
        <div className="flex justify-end">
          <Button variant="primary" onClick={save} loading={pending}>
            <Save className="size-4" aria-hidden="true" /> حفظ الشركة
          </Button>
        </div>
      </div>
    );

  return (
    <Card>
      <CardHeader
        title="بيانات الشركة"
        actions={
          <>
            {f.id && canDelete ? (
              <Button size="sm" variant="danger" onClick={() => run(() => deleteCompanyAction(f.id!), { confirm: "حذف الشركة؟", onOk: () => router.push("/staff/companies/") })}>
                <Trash2 className="size-4" aria-hidden="true" /> حذف
              </Button>
            ) : null}
            <Button size="sm" variant="primary" onClick={save} loading={pending}>
              <Save className="size-4" aria-hidden="true" /> حفظ
            </Button>
          </>
        }
      />
      <div className="p-5">{fields}</div>
    </Card>
  );
}

export interface ContactItem {
  id: number | null;
  name: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
  notes: string | null;
}

export function ContactsManager({ companyId, contacts }: { companyId: number; contacts: ContactItem[] }) {
  const [form, setForm] = useState<ContactItem | null>(null);
  const { run, pending } = useActionRunner();
  const set = <K extends keyof ContactItem>(k: K, v: ContactItem[K]) => setForm((x) => (x ? { ...x, [k]: v } : x));

  return (
    <Card>
      <CardHeader
        title="جهات الاتصال"
        description="الأشخاص الذين تُرسل إليهم العروض."
        actions={
          <Button size="sm" variant="subtle" onClick={() => setForm({ id: null, name: "", position: null, phone: null, email: null, is_primary: contacts.length === 0, notes: null })}>
            <Plus className="size-4" aria-hidden="true" /> إضافة
          </Button>
        }
      />
      {contacts.length ? (
        <ul role="list" className="divide-y divide-line">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-start gap-3 px-5 py-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                <UserRound className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-bold text-brand-950">
                  {c.name}
                  {c.is_primary ? (
                    <Badge tone="accent">
                      <Star className="size-3" aria-hidden="true" /> رئيسي
                    </Badge>
                  ) : null}
                </p>
                {c.position ? <p className="text-xs text-muted">{c.position}</p> : null}
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {c.phone ? (
                    <a href={`tel:${c.phone}`} dir="ltr" className="num inline-flex items-center gap-1 text-brand-700 hover:underline">
                      <Phone className="size-3" aria-hidden="true" /> {c.phone}
                    </a>
                  ) : null}
                  {c.email ? (
                    <a href={`mailto:${c.email}`} dir="ltr" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                      <Mail className="size-3" aria-hidden="true" /> {c.email}
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" aria-label={`تعديل ${c.name}`} onClick={() => setForm(c)}>
                  <Pencil className="size-4" aria-hidden="true" />
                </Button>
                <Button size="sm" variant="ghost" className="text-danger" aria-label={`حذف ${c.name}`} onClick={() => run(() => deleteContactAction({ company_id: companyId, id: c.id! }), { confirm: `حذف ${c.name}؟` })}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="لا توجد جهات اتصال" text="أضف الشخص المسؤول عن السفر في الشركة لإرسال العروض إليه." />
      )}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? "تعديل جهة الاتصال" : "جهة اتصال جديدة"}
        footer={
          <>
            <Button onClick={() => setForm(null)}>إلغاء</Button>
            <Button variant="primary" loading={pending} onClick={() => form && run(() => saveContactAction({ ...form, company_id: companyId }), { onOk: () => setForm(null) })}>
              حفظ
            </Button>
          </>
        }
      >
        {form ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="الاسم" required htmlFor="ct-name">
              <Input id="ct-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="المنصب" htmlFor="ct-pos">
              <Input id="ct-pos" value={form.position ?? ""} onChange={(e) => set("position", e.target.value)} />
            </Field>
            <Field label="الهاتف / واتساب" htmlFor="ct-phone" hint="مع رمز الدولة، مثل +9647…">
              <Input id="ct-phone" dir="ltr" className="text-start" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="البريد الإلكتروني" htmlFor="ct-email">
              <Input id="ct-email" type="email" dir="ltr" className="text-start" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Toggle id="ct-primary" checked={form.is_primary} onChange={(v) => set("is_primary", v)} label="جهة الاتصال الرئيسية" />
            </div>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}
