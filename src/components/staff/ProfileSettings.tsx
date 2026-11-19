"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import { saveCompanyProfileAction } from "@/server/actions/admin";
import { Button, Card, CardHeader, Field, Input, Textarea, Toggle } from "./ui";
import { useActionRunner } from "./useActionRunner";

export interface ProfileValues {
  company_name_ar: string;
  company_name_en: string;
  company_phone: string;
  company_email: string;
  company_address_ar: string;
  company_address_en: string;
  pdf_show_hotel_photos: boolean;
  pdf_footer_note_ar: string;
  pdf_footer_note_en: string;
}

/** Etijah's identity on its own documents, and the unified PDF template options. */
export function ProfileSettings({ initial, section }: { initial: ProfileValues; section: "company" | "pdf" }) {
  const [f, setF] = useState(initial);
  const { run, pending } = useActionRunner();
  const set = <K extends keyof ProfileValues>(k: K, v: ProfileValues[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Card>
      <CardHeader
        title={section === "company" ? "بيانات شركة الاتجاه على المستندات" : "خيارات القالب الموحد"}
        description={section === "company" ? "تظهر في ملفات PDF وعروض الأسعار الصادرة بهوية الاتجاه." : "تنطبق على كل الملفات (الاتجاه والشركات)."}
        actions={
          <Button variant="primary" size="sm" loading={pending} onClick={() => run(() => saveCompanyProfileAction(f))} data-save-profile>
            <Save className="size-4" aria-hidden="true" /> حفظ
          </Button>
        }
      />
      {section === "company" ? (
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="الاسم بالعربية" required>
            <Input value={f.company_name_ar} onChange={(e) => set("company_name_ar", e.target.value)} />
          </Field>
          <Field label="الاسم بالإنجليزية" required>
            <Input dir="ltr" className="text-left" value={f.company_name_en} onChange={(e) => set("company_name_en", e.target.value)} />
          </Field>
          <Field label="الهاتف">
            <Input dir="ltr" className="num text-left" value={f.company_phone} onChange={(e) => set("company_phone", e.target.value)} />
          </Field>
          <Field label="البريد الإلكتروني">
            <Input dir="ltr" type="email" className="text-left" value={f.company_email} onChange={(e) => set("company_email", e.target.value)} />
          </Field>
          <Field label="العنوان بالعربية">
            <Input value={f.company_address_ar} onChange={(e) => set("company_address_ar", e.target.value)} />
          </Field>
          <Field label="العنوان بالإنجليزية">
            <Input dir="ltr" className="text-left" value={f.company_address_en} onChange={(e) => set("company_address_en", e.target.value)} />
          </Field>
        </div>
      ) : (
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Toggle id="pdf-photos" checked={f.pdf_show_hotel_photos} onChange={(v) => set("pdf_show_hotel_photos", v)} label="إظهار صور الفنادق في الملفات" />
          </div>
          <Field label="ملاحظة أسفل الملفات (عربي)">
            <Textarea rows={2} value={f.pdf_footer_note_ar} onChange={(e) => set("pdf_footer_note_ar", e.target.value)} />
          </Field>
          <Field label="Footer note (English)">
            <Textarea rows={2} dir="ltr" value={f.pdf_footer_note_en} onChange={(e) => set("pdf_footer_note_en", e.target.value)} />
          </Field>
        </div>
      )}
    </Card>
  );
}
