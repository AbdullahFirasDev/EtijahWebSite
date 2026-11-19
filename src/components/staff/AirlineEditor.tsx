"use client";

import { KeyRound, Save, ShieldAlert, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MediaRef } from "@/lib/media";
import { deleteAirlineAction, saveAirlineAction } from "@/server/actions/airlines";
import { ImagePicker } from "./ImagePicker";
import { Button, Card, CardHeader, Field, Input, Select, Textarea, Toggle } from "./ui";
import { useActionRunner } from "./useActionRunner";

export const ISSUE_METHOD_OPTIONS = [
  ["airline_portal", "نظام شركة الطيران الرسمي"],
  ["gds", "نظام GDS"],
  ["api", "API"],
  ["email", "البريد الإلكتروني"],
  ["agent", "وكيل أو وسيط"],
  ["other", "طريقة أخرى"],
] as const;

export interface AirlineForm {
  id: number | null;
  name_ar: string;
  name_en: string;
  iata: string | null;
  logo: MediaRef | null;
  country_code: string | null;
  contact: { phone: string | null; email: string | null; website: string | null; person: string | null };
  internal_notes: string | null;
  status: "active" | "inactive" | "suspended";
  issuance: {
    method: (typeof ISSUE_METHOD_OPTIONS)[number][0];
    method_note: string | null;
    portal_url: string | null;
    email: string | null;
    phone: string | null;
    instructions: string | null;
    documents: string | null;
    booking_request: string | null;
    confirmation: string | null;
    payment: string | null;
    prepayment_required: boolean;
    credit: "none" | "credit" | "balance";
    credit_note: string | null;
    access_notes: string | null;
    secret_ref: string | null;
    notes: string | null;
  };
}

/** `countries` is built on the server: country names from Intl differ between Node and browsers (hydration). */
export function AirlineEditor({ initial, canEdit, countries }: { initial: AirlineForm; canEdit: boolean; countries: { code: string; name: string }[] }) {
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { run, pending } = useActionRunner();
  const set = <K extends keyof AirlineForm>(k: K, v: AirlineForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const iss = <K extends keyof AirlineForm["issuance"]>(k: K, v: AirlineForm["issuance"][K]) => setF((x) => ({ ...x, issuance: { ...x.issuance, [k]: v } }));
  const txt = (v: string) => (v.trim() ? v : null);

  const save = () =>
    run(() => saveAirlineAction({ ...f, logo_media_id: f.logo?.id ?? null }), {
      onOk: (d) => {
        setErrors({});
        if (!f.id) router.replace(`/staff/airlines/${d.id}/`);
      },
      onError: (r) => setErrors(r.fieldErrors ?? {}),
    });

  return (
    <fieldset disabled={!canEdit} className="grid min-w-0 gap-6">
      <Card>
        <CardHeader
          title="ملف شركة الطيران"
          actions={
            canEdit ? (
              <>
                {f.id ? (
                  <Button size="sm" variant="danger" onClick={() => run(() => deleteAirlineAction(f.id!), { confirm: "حذف شركة الطيران؟ (مسموح فقط إن لم تُستخدم)", onOk: () => router.push("/staff/airlines/") })}>
                    <Trash2 className="size-4" aria-hidden="true" /> حذف
                  </Button>
                ) : null}
                <Button size="sm" variant="primary" onClick={save} loading={pending} data-save-airline>
                  <Save className="size-4" aria-hidden="true" /> حفظ
                </Button>
              </>
            ) : null
          }
        />
        <div className="grid gap-5 p-5 lg:grid-cols-[13rem_1fr]">
          <ImagePicker kind="logo" label="الشعار" max={1} value={f.logo ? [f.logo] : []} onChange={(v) => set("logo", v[0] ?? null)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="الاسم بالعربية" required error={errors.name_ar}>
              <Input value={f.name_ar} onChange={(e) => set("name_ar", e.target.value)} data-airline-name-ar />
            </Field>
            <Field label="الاسم بالإنجليزية" required error={errors.name_en}>
              <Input dir="ltr" className="text-left" value={f.name_en} onChange={(e) => set("name_en", e.target.value)} data-airline-name-en />
            </Field>
            <Field label="رمز IATA" error={errors.iata} hint="حرفان، مثل IA للعراقية و TK للتركية.">
              <Input dir="ltr" className="num uppercase" maxLength={2} value={f.iata ?? ""} onChange={(e) => set("iata", txt(e.target.value.toUpperCase()))} data-airline-iata />
            </Field>
            <Field label="بلد الشركة">
              <Select value={f.country_code ?? ""} onChange={(e) => set("country_code", e.target.value || null)}>
                <option value="">—</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="حالة التعامل">
              <Select value={f.status} onChange={(e) => set("status", e.target.value as AirlineForm["status"])}>
                <option value="active">نتعامل معها</option>
                <option value="inactive">غير نشطة</option>
                <option value="suspended">متوقف التعامل</option>
              </Select>
            </Field>
            <Field label="الشخص المسؤول">
              <Input value={f.contact.person ?? ""} onChange={(e) => set("contact", { ...f.contact, person: txt(e.target.value) })} />
            </Field>
            <Field label="هاتف التواصل">
              <Input dir="ltr" className="num text-left" value={f.contact.phone ?? ""} onChange={(e) => set("contact", { ...f.contact, phone: txt(e.target.value) })} />
            </Field>
            <Field label="بريد التواصل" error={errors["contact.email"]}>
              <Input dir="ltr" type="email" className="text-left" value={f.contact.email ?? ""} onChange={(e) => set("contact", { ...f.contact, email: txt(e.target.value) })} />
            </Field>
            <Field label="الموقع الإلكتروني" error={errors["contact.website"]} className="sm:col-span-2">
              <Input dir="ltr" type="url" className="text-left" placeholder="https://" value={f.contact.website ?? ""} onChange={(e) => set("contact", { ...f.contact, website: txt(e.target.value) })} />
            </Field>
            <Field label="ملاحظات داخلية" className="sm:col-span-2">
              <Textarea rows={2} value={f.internal_notes ?? ""} onChange={(e) => set("internal_notes", txt(e.target.value))} />
            </Field>
          </div>
        </div>
      </Card>

      <Card id="issuance">
        <CardHeader title="آلية إصدار التذاكر" description="كيف نصدر تذاكر هذه الشركة: للموظفين المخولين فقط. النظام لا يصدر التذاكر تلقائياً؛ هذه معلومات وإجراءات داخلية." />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="طريقة الإصدار" required>
            <Select value={f.issuance.method} onChange={(e) => iss("method", e.target.value as AirlineForm["issuance"]["method"])} data-issue-method>
              {ISSUE_METHOD_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="تفاصيل الطريقة" hint="مثال: Amadeus، اسم الوكيل، رقم المكتب…">
            <Input value={f.issuance.method_note ?? ""} onChange={(e) => iss("method_note", txt(e.target.value))} />
          </Field>
          <Field label="رابط نظام الإصدار الرسمي" error={errors["issuance.portal_url"]}>
            <Input dir="ltr" type="url" className="text-left" placeholder="https://" value={f.issuance.portal_url ?? ""} onChange={(e) => iss("portal_url", txt(e.target.value))} data-issue-portal />
          </Field>
          <Field label="البريد المعتمد عند الإصدار" error={errors["issuance.email"]}>
            <Input dir="ltr" type="email" className="text-left" value={f.issuance.email ?? ""} onChange={(e) => iss("email", txt(e.target.value))} />
          </Field>
          <Field label="رقم التواصل للإصدار">
            <Input dir="ltr" className="num text-left" value={f.issuance.phone ?? ""} onChange={(e) => iss("phone", txt(e.target.value))} />
          </Field>
          <Field label="طريقة إرسال طلب الحجز">
            <Input value={f.issuance.booking_request ?? ""} onChange={(e) => iss("booking_request", txt(e.target.value))} />
          </Field>
          <Field label="تعليمات الإصدار" className="sm:col-span-2">
            <Textarea rows={4} value={f.issuance.instructions ?? ""} onChange={(e) => iss("instructions", txt(e.target.value))} data-issue-instructions />
          </Field>
          <Field label="المستندات المطلوبة">
            <Textarea rows={2} value={f.issuance.documents ?? ""} onChange={(e) => iss("documents", txt(e.target.value))} />
          </Field>
          <Field label="طريقة تأكيد الإصدار">
            <Textarea rows={2} value={f.issuance.confirmation ?? ""} onChange={(e) => iss("confirmation", txt(e.target.value))} />
          </Field>
          <Field label="طريقة الدفع والتسوية">
            <Textarea rows={2} value={f.issuance.payment ?? ""} onChange={(e) => iss("payment", txt(e.target.value))} />
          </Field>
          <div className="grid gap-3">
            <Toggle id="iss-prepay" checked={f.issuance.prepayment_required} onChange={(v) => iss("prepayment_required", v)} label="يتطلب الدفع المسبق" />
            <Field label="حساب آجل أو رصيد">
              <Select value={f.issuance.credit} onChange={(e) => iss("credit", e.target.value as AirlineForm["issuance"]["credit"])}>
                <option value="none">لا يوجد (دفع عند الإصدار)</option>
                <option value="credit">حساب آجل</option>
                <option value="balance">رصيد مسبق الدفع</option>
              </Select>
            </Field>
            <Input value={f.issuance.credit_note ?? ""} onChange={(e) => iss("credit_note", txt(e.target.value))} placeholder="سقف الحساب، مدة السداد…" aria-label="ملاحظة الحساب" />
          </div>
          <div className="rounded-xl border border-accent-200 bg-accent-50 p-4 sm:col-span-2">
            <p className="flex items-center gap-2 text-sm font-extrabold text-accent-700">
              <ShieldAlert className="size-4" aria-hidden="true" /> بيانات الدخول
            </p>
            <p className="mt-1 text-xs leading-[1.8] text-accent-700">لا تكتب كلمات المرور هنا. احفظها في مدير أسرار آمن (مثل مدير كلمات مرور الشركة) واكتب مكانها فقط. يرفض النظام الحفظ إن بدا أن النص يحتوي كلمة مرور.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="ملاحظات الوصول (بدون كلمات مرور)" error={errors.access_notes}>
                <Textarea rows={2} value={f.issuance.access_notes ?? ""} onChange={(e) => iss("access_notes", txt(e.target.value))} placeholder="اسم المستخدم العام، من يملك الصلاحية…" data-issue-access />
              </Field>
              <Field label="مرجع بيانات الدخول في مدير الأسرار">
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted" aria-hidden="true" />
                  <Input className="ps-9" value={f.issuance.secret_ref ?? ""} onChange={(e) => iss("secret_ref", txt(e.target.value))} placeholder="مثال: Vault › Airlines › IA portal" />
                </div>
              </Field>
            </div>
          </div>
          <Field label="ملاحظات خاصة" className="sm:col-span-2">
            <Textarea rows={2} value={f.issuance.notes ?? ""} onChange={(e) => iss("notes", txt(e.target.value))} />
          </Field>
        </div>
      </Card>
    </fieldset>
  );
}
