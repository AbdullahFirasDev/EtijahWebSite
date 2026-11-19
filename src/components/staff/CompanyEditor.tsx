"use client";

import { Mail, Pencil, Phone, Plus, Save, Star, Trash2, UserRound } from "lucide-react";
import { mediaSrc, type MediaRef } from "@/lib/media";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteCompanyAction, deleteContactAction, saveCompanyAction, saveContactAction } from "@/server/actions/companies";
import { emptyCompanyForm } from "@/lib/company-form";
import { ImagePicker } from "./ImagePicker";

export { emptyCompanyForm };
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
  terms: string | null;
  status: "active" | "archived";
  portal_enabled: boolean;
  branding: {
    logo: MediaRef | null;
    primary_color: string;
    secondary_color: string;
    display_name: string | null;
    display_name_en: string | null;
    contact_line: string | null;
  };
}


export function CompanyEditor({ initial, canDelete, onSaved, compact }: { initial: CompanyForm; canDelete?: boolean; onSaved?: (id: number) => void; compact?: boolean }) {
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { run, pending } = useActionRunner();
  const set = <K extends keyof CompanyForm>(k: K, v: CompanyForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = () =>
    run(() => saveCompanyAction({ ...f, branding: { ...f.branding, logo_media_id: f.branding.logo?.id ?? null } }), {
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
          <Field label="الشروط الخاصة بالشركة" className="sm:col-span-2" htmlFor="co-terms" hint="تُقترح تلقائياً في عروض أسعار هذه الشركة.">
            <Textarea id="co-terms" rows={3} value={f.terms ?? ""} onChange={(e) => set("terms", e.target.value)} />
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
      <div className="grid gap-6 p-5">
        {fields}
        <div className="rounded-2xl border border-line p-4">
          <p className="font-extrabold text-brand-950">الهوية البصرية لملفات PDF</p>
          <p className="mb-4 text-sm text-muted">القالب موحد لكل الشركات؛ يتغير فقط الشعار والألوان والاسم وبيانات التواصل.</p>
          <div className="grid gap-4 lg:grid-cols-[14rem_1fr]">
            <ImagePicker kind="logo" label="شعار الشركة" max={1} value={f.branding.logo ? [f.branding.logo] : []} onChange={(v) => set("branding", { ...f.branding, logo: v[0] ?? null })} hint="PNG بخلفية شفافة يفضل." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="اللون الأساسي" error={errors["branding.primary_color"]} htmlFor="co-c1">
                <div className="flex gap-2">
                  <input id="co-c1" type="color" value={f.branding.primary_color} onChange={(e) => set("branding", { ...f.branding, primary_color: e.target.value })} className="h-11 w-14 cursor-pointer rounded-lg border border-line" />
                  <Input dir="ltr" className="num" value={f.branding.primary_color} onChange={(e) => set("branding", { ...f.branding, primary_color: e.target.value })} aria-label="اللون الأساسي" data-primary-color />
                </div>
              </Field>
              <Field label="اللون الثانوي" error={errors["branding.secondary_color"]} htmlFor="co-c2">
                <div className="flex gap-2">
                  <input id="co-c2" type="color" value={f.branding.secondary_color} onChange={(e) => set("branding", { ...f.branding, secondary_color: e.target.value })} className="h-11 w-14 cursor-pointer rounded-lg border border-line" />
                  <Input dir="ltr" className="num" value={f.branding.secondary_color} onChange={(e) => set("branding", { ...f.branding, secondary_color: e.target.value })} aria-label="اللون الثانوي" data-secondary-color />
                </div>
              </Field>
              <Field label="الاسم على الملفات (عربي)" hint="افتراضياً اسم الشركة." htmlFor="co-dn">
                <Input id="co-dn" value={f.branding.display_name ?? ""} onChange={(e) => set("branding", { ...f.branding, display_name: e.target.value || null })} />
              </Field>
              <Field label="الاسم على الملفات (English)" htmlFor="co-dne">
                <Input id="co-dne" dir="ltr" className="text-left" value={f.branding.display_name_en ?? ""} onChange={(e) => set("branding", { ...f.branding, display_name_en: e.target.value || null })} />
              </Field>
              <Field label="سطر بيانات التواصل في الملفات" className="sm:col-span-2" hint="مثال: الهاتف · البريد · المدينة" htmlFor="co-cl">
                <Input id="co-cl" value={f.branding.contact_line ?? ""} onChange={(e) => set("branding", { ...f.branding, contact_line: e.target.value || null })} data-contact-line />
              </Field>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl ring-1 ring-line" aria-label="معاينة الهوية">
            <div className="flex items-center justify-between px-5 py-4" style={{ background: f.branding.primary_color, color: "#fff" }}>
              <div className="flex items-center gap-3">
                {f.branding.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaSrc(f.branding.logo, 480)} alt="" className="h-10 w-auto rounded bg-white/95 p-1" />
                ) : null}
                <span className="text-lg font-black">{f.branding.display_name || f.name || "اسم الشركة"}</span>
              </div>
              <span className="rounded-full px-3 py-1 text-xs font-extrabold" style={{ background: f.branding.secondary_color, color: "#051c33" }}>
                عرض سعر
              </span>
            </div>
            <p className="bg-white px-5 py-2 text-xs text-muted">{f.branding.contact_line || [f.phone, f.email, f.website].filter(Boolean).join(" · ") || "بيانات التواصل"}</p>
          </div>
        </div>
        <div className="grid gap-4 rounded-2xl border border-line p-4 sm:grid-cols-2">
          <Toggle id="co-portal" checked={f.portal_enabled} onChange={(v) => set("portal_enabled", v)} label="تفعيل بوابة الشركة" description="يسمح لمستخدمي الشركة بالدخول إلى بوابتها. الإيقاف يُنهي جلساتهم فوراً." />
          <Toggle id="co-archived" checked={f.status === "archived"} onChange={(v) => set("status", v ? "archived" : "active")} label="أرشفة الشركة" description="لا تظهر عند إنشاء عروض جديدة، ويتوقف دخول مستخدميها." />
        </div>
      </div>
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
