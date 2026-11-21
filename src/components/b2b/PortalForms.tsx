"use client";

import { Check, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DateInput } from "@/components/staff/fields";
import { Button, Field, Input, Select, Textarea } from "@/components/staff/ui";
import { useActionRunner } from "@/components/staff/useActionRunner";
import { companyChangePasswordAction } from "@/server/actions/auth";
import { createPortalRequestAction } from "@/server/actions/portal";
import { portalRespondAction } from "@/server/actions/quotes";

/** New program / quote request from a company user (the company is taken from the session). */
export function PortalRequestForm({ hotels, countries, preselectHotel }: { hotels: { id: number; name: string; city: string }[]; countries: { code: string; name: string }[]; preselectHotel: number | null }) {
  const router = useRouter();
  const { run, pending } = useActionRunner();
  const [f, setF] = useState({
    title: "",
    country_codes: [] as string[],
    places: "",
    date_from: "",
    date_to: "",
    nights: "",
    adults: "2",
    children: "0",
    rooms: "1",
    hotel_ids: preselectHotel ? [preselectHotel] : ([] as number[]),
    hotel_stars: "",
    budget: "",
    beneficiary: "",
    notes: "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const num = (v: string) => (v === "" ? null : Math.max(0, Math.trunc(Number(v))));
  return (
    <div className="grid gap-4 sm:grid-cols-2" data-portal-request-form>
      <Field label="عنوان الطلب" required className="sm:col-span-2">
        <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="مثال: رحلة موظفين إلى إسطنبول" data-req-title />
      </Field>
      <Field label="الدولة">
        <Select value={f.country_codes[0] ?? ""} onChange={(e) => set("country_codes", e.target.value ? [e.target.value] : [])}>
          <option value="">—</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="المدن أو الأماكن">
        <Input value={f.places} onChange={(e) => set("places", e.target.value)} />
      </Field>
      <Field label="من تاريخ">
        <DateInput value={f.date_from || null} onChange={(v) => set("date_from", v ?? "")} aria-label="من تاريخ" />
      </Field>
      <Field label="إلى تاريخ">
        <DateInput min={f.date_from || undefined} value={f.date_to || null} onChange={(v) => set("date_to", v ?? "")} aria-label="إلى تاريخ" />
      </Field>
      <div className="grid grid-cols-3 gap-3 sm:col-span-2">
        <Field label="البالغون">
          <Input type="number" min={1} dir="ltr" className="num" value={f.adults} onChange={(e) => set("adults", e.target.value)} data-req-adults />
        </Field>
        <Field label="الأطفال">
          <Input type="number" min={0} dir="ltr" className="num" value={f.children} onChange={(e) => set("children", e.target.value)} />
        </Field>
        <Field label="الغرف">
          <Input type="number" min={0} dir="ltr" className="num" value={f.rooms} onChange={(e) => set("rooms", e.target.value)} />
        </Field>
      </div>
      {hotels.length ? (
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-bold text-brand-950">الفنادق المفضلة (من الفنادق المتاحة لكم)</legend>
          <div className="flex flex-wrap gap-2">
            {hotels.map((h) => {
              const on = f.hotel_ids.includes(h.id);
              return (
                <label key={h.id} className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-bold ${on ? "border-brand-600 bg-brand-600 text-white" : "border-line text-brand-900"}`}>
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => set("hotel_ids", on ? f.hotel_ids.filter((x) => x !== h.id) : [...f.hotel_ids, h.id])} />
                  {h.name} · {h.city}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
      <Field label="تصنيف الفندق">
        <Select value={f.hotel_stars} onChange={(e) => set("hotel_stars", e.target.value)}>
          <option value="">أي تصنيف</option>
          {[3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} نجوم
            </option>
          ))}
        </Select>
      </Field>
      <Field label="الميزانية التقريبية">
        <Input value={f.budget} onChange={(e) => set("budget", e.target.value)} />
      </Field>
      <Field label="الجهة المستفيدة (عميلكم)" className="sm:col-span-2">
        <Input value={f.beneficiary} onChange={(e) => set("beneficiary", e.target.value)} />
      </Field>
      <Field label="ملاحظات وتفاصيل" className="sm:col-span-2">
        <Textarea rows={4} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
      <div className="sm:col-span-2">
        <Button
          variant="primary"
          loading={pending}
          data-req-submit
          onClick={() =>
            run(
              () =>
                createPortalRequestAction({
                  title: f.title,
                  country_codes: f.country_codes,
                  places: f.places || null,
                  date_from: f.date_from || null,
                  date_to: f.date_to || null,
                  nights: num(f.nights),
                  adults: num(f.adults) ?? 1,
                  children: num(f.children) ?? 0,
                  rooms: num(f.rooms) ?? 0,
                  hotel_ids: f.hotel_ids,
                  hotel_stars: f.hotel_stars ? Number(f.hotel_stars) : null,
                  budget: f.budget || null,
                  beneficiary: f.beneficiary || null,
                  notes: f.notes || null,
                }),
              { onOk: () => router.push("/b2b/requests/") },
            )
          }
        >
          <Send className="size-4 rtl:-scale-x-100" aria-hidden="true" /> إرسال الطلب
        </Button>
      </div>
    </div>
  );
}

/** Accept a quote or ask for changes, as the signed-in company user. */
export function PortalRespond({ quoteId, canRespond }: { quoteId: number; canRespond: boolean }) {
  const { run, pending } = useActionRunner();
  const [note, setNote] = useState("");
  if (!canRespond) return null;
  return (
    <div className="grid gap-3 rounded-2xl bg-white p-5 ring-1 ring-line" data-portal-respond>
      <p className="font-extrabold text-brand-950">ردّكم على العرض</p>
      <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="اكتب التعديلات المطلوبة (لطلب تعديل)" aria-label="ملاحظات" />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" loading={pending} onClick={() => run(() => portalRespondAction({ quoteId, action: "accept", note: note || null }), { confirm: "تأكيد قبول العرض؟" })} data-portal-accept>
          <Check className="size-4" aria-hidden="true" /> قبول العرض
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => run(() => portalRespondAction({ quoteId, action: "changes", note: note || null }))} data-portal-changes>
          طلب تعديل
        </Button>
      </div>
    </div>
  );
}

export function PortalPassword() {
  const { run, pending } = useActionRunner();
  const [f, setF] = useState({ current: "", next: "" });
  return (
    <div className="grid max-w-md gap-4">
      <Field label="كلمة المرور الحالية">
        <Input type="password" dir="ltr" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} autoComplete="current-password" />
      </Field>
      <Field label="كلمة المرور الجديدة" hint="10 أحرف على الأقل، حروف وأرقام.">
        <Input type="password" dir="ltr" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} autoComplete="new-password" />
      </Field>
      <Button variant="primary" loading={pending} onClick={() => run(() => companyChangePasswordAction(f), { onOk: () => setF({ current: "", next: "" }) })}>
        تغيير كلمة المرور
      </Button>
    </div>
  );
}
