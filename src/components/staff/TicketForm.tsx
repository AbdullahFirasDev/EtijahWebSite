"use client";

import { AlertTriangle, Calculator, Check, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { COMMISSION_BASIS_LABELS, COMMISSION_KIND_LABELS, ruleLabel } from "@/lib/commission-math";
import { todayDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { createTicketAction, previewTicketAction } from "@/server/actions/airlines";
import { ISSUE_METHOD_OPTIONS } from "./AirlineEditor";
import { DateInput, MoneyInput } from "./fields";
import { Badge, Button, Card, CardHeader, Field, Input, Select, Textarea, Toggle } from "./ui";
import { useActionRunner } from "./useActionRunner";

type Preview = Extract<Awaited<ReturnType<typeof previewTicketAction>>, { ok: true }>["data"];

interface Form {
  airline_id: number | "";
  company_id: number | "";
  ticket_number: string;
  pnr: string;
  passenger: string;
  route: string;
  currency: string;
  base_fare: number | null;
  taxes: number | null;
  service_fee: number | null;
  other_basis_amount: number | null;
  issue_method: (typeof ISSUE_METHOD_OPTIONS)[number][0];
  issued_at: string;
  payment_method: string;
  payment_status: "unpaid" | "partial" | "paid";
  paid_amount: number | null;
  airline_settlement: "pending" | "settled";
  notes: string;
}

export function TicketForm({ airlines, companies, currencies }: { airlines: { id: number; name: string; iata: string | null; method: Form["issue_method"] }[]; companies: { id: number; name: string }[]; currencies: string[] }) {
  const router = useRouter();
  const { run, pending } = useActionRunner();
  const [f, setF] = useState<Form>({
    airline_id: "",
    company_id: "",
    ticket_number: "",
    pnr: "",
    passenger: "",
    route: "",
    currency: currencies[0] ?? "USD",
    base_fare: null,
    taxes: null,
    service_fee: null,
    other_basis_amount: null,
    issue_method: "airline_portal",
    issued_at: todayDay(),
    payment_method: "",
    payment_status: "unpaid",
    paid_amount: null,
    airline_settlement: "pending",
    notes: "",
  });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [override, setOverride] = useState<{ company: { on: boolean; amount: number | null; reason: string }; etijah: { on: boolean; amount: number | null; reason: string } }>({
    company: { on: false, amount: null, reason: "" },
    etijah: { on: false, amount: null, reason: "" },
  });
  // Any change after the review invalidates it: the calculation must be reviewed again.
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setPreview(null);
  };
  const money = (n: number) => formatMoney(n, f.currency, "ar");

  const payload = () => ({
    airline_id: Number(f.airline_id),
    company_id: f.company_id === "" ? null : Number(f.company_id),
    ticket_number: f.ticket_number,
    pnr: f.pnr || null,
    passenger: f.passenger || null,
    route: f.route || null,
    currency: f.currency,
    base_fare: f.base_fare ?? 0,
    taxes: f.taxes ?? 0,
    service_fee: f.service_fee ?? 0,
    other_basis_amount: f.other_basis_amount,
    issue_method: f.issue_method,
    issued_at: f.issued_at,
    payment_method: f.payment_method || null,
    payment_status: f.payment_status,
    paid_amount: f.paid_amount ?? 0,
    airline_settlement: f.airline_settlement,
    notes: f.notes || null,
    company_override: override.company.on && f.company_id !== "" ? { amount: override.company.amount ?? 0, reason: override.company.reason } : null,
    etijah_override: override.etijah.on ? { amount: override.etijah.amount ?? 0, reason: override.etijah.reason } : null,
  });

  const review = () => run(() => previewTicketAction(payload()), { refresh: false, onOk: (d) => setPreview(d) });
  const save = () =>
    preview &&
    run(() => createTicketAction({ ticket: payload(), expected: { company: preview.company?.rule_id ?? null, etijah: preview.etijah.rule_id } }), { onOk: (d) => router.push(`/staff/tickets/${d.id}/`) });

  const commissionCard = (title: string, c: Preview["etijah"] | null, key: "company" | "etijah") =>
    c ? (
      <div className="rounded-xl border border-line p-4" data-preview={key}>
        <p className="text-sm font-extrabold text-brand-950">{title}</p>
        {c.missing ? (
          <p className="mt-1 text-xs font-bold text-accent-700">لا توجد قاعدة سارية في تاريخ الإصدار</p>
        ) : (
          <p className="mt-1 text-xs text-muted">
            القاعدة #{c.rule_id}: <span className="num font-bold text-brand-800">{ruleLabel(c)}</span> · {c.kind === "commission" ? COMMISSION_BASIS_LABELS[c.basis] : COMMISSION_KIND_LABELS[c.kind]}
          </p>
        )}
        <p className="num mt-2 text-2xl font-black text-brand-700" data-preview-amount={key}>
          {money(c.amount)}
        </p>
        {c.overridden ? <Badge tone="accent">معدّل يدوياً (المحسوب {money(c.computed_amount)})</Badge> : null}
        <div className="mt-3">
          <Toggle
            id={`ov-${key}`}
            checked={override[key].on}
            onChange={(v) => {
              setOverride((o) => ({ ...o, [key]: { ...o[key], on: v } }));
              setPreview(null);
            }}
            label="تعديل المبلغ يدوياً"
            description="يُسجل مع السبب في سجل العمليات."
          />
          {override[key].on ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <MoneyInput value={override[key].amount} onChange={(v) => setOverride((o) => ({ ...o, [key]: { ...o[key], amount: v } }))} aria-label="المبلغ اليدوي" />
              <Input value={override[key].reason} onChange={(e) => setOverride((o) => ({ ...o, [key]: { ...o[key], reason: e.target.value } }))} placeholder="سبب التعديل" />
            </div>
          ) : null}
        </div>
      </div>
    ) : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
      <Card>
        <CardHeader title="بيانات العملية" />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="شركة الطيران" required>
            <Select
              value={f.airline_id}
              onChange={(e) => {
                const a = airlines.find((x) => x.id === Number(e.target.value));
                setF((x) => ({ ...x, airline_id: e.target.value ? Number(e.target.value) : "", issue_method: a?.method ?? x.issue_method }));
                setPreview(null);
              }}
              data-ticket-airline
            >
              <option value="">اختر…</option>
              {airlines.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} {a.iata ? `(${a.iata})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="الشركة المستفيدة B2B">
            <Select value={f.company_id} onChange={(e) => set("company_id", e.target.value ? Number(e.target.value) : "")} data-ticket-company>
              <option value="">بيع مباشر (بدون شركة)</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="تاريخ الإصدار" required hint="تُطبق العمولات السارية في هذا التاريخ.">
            <DateInput value={f.issued_at || null} onChange={(v) => set("issued_at", v ?? "")} aria-label="تاريخ الإصدار" data-ticket-date />
          </Field>
          <Field label="رقم التذكرة" required>
            <Input dir="ltr" className="num" value={f.ticket_number} onChange={(e) => set("ticket_number", e.target.value)} data-ticket-number />
          </Field>
          <Field label="رقم الحجز PNR">
            <Input dir="ltr" className="num uppercase" value={f.pnr} onChange={(e) => set("pnr", e.target.value)} />
          </Field>
          <Field label="اسم المسافر">
            <Input value={f.passenger} onChange={(e) => set("passenger", e.target.value)} />
          </Field>
          <Field label="المسار">
            <Input value={f.route} onChange={(e) => set("route", e.target.value)} placeholder="NJF-IST-NJF" dir="ltr" />
          </Field>
          <Field label="طريقة الإصدار">
            <Select value={f.issue_method} onChange={(e) => set("issue_method", e.target.value as Form["issue_method"])}>
              {ISSUE_METHOD_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="العملة">
            <Select value={f.currency} onChange={(e) => set("currency", e.target.value)}>
              {currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="السعر الأساسي للتذكرة" required>
            <MoneyInput value={f.base_fare} onChange={(v) => set("base_fare", v)} aria-label="السعر الأساسي" />
          </Field>
          <Field label="الضرائب والرسوم">
            <MoneyInput value={f.taxes} onChange={(v) => set("taxes", v)} aria-label="الضرائب" />
          </Field>
          <Field label="رسوم الخدمة على الشركة">
            <MoneyInput value={f.service_fee} onChange={(v) => set("service_fee", v)} aria-label="رسوم الخدمة" />
          </Field>
          <Field label="مبلغ «الأساس الآخر»" hint="فقط إن كانت القاعدة على أساس آخر.">
            <MoneyInput value={f.other_basis_amount} onChange={(v) => set("other_basis_amount", v)} aria-label="الأساس الآخر" />
          </Field>
          <Field label="طريقة التسديد">
            <Input value={f.payment_method} onChange={(e) => set("payment_method", e.target.value)} placeholder="نقداً، تحويل، حساب آجل…" />
          </Field>
          <Field label="حالة الدفع">
            <Select value={f.payment_status} onChange={(e) => set("payment_status", e.target.value as Form["payment_status"])}>
              <option value="unpaid">غير مسدد</option>
              <option value="partial">مسدد جزئياً</option>
              <option value="paid">مسدد</option>
            </Select>
          </Field>
          <Field label="المبلغ المسدد">
            <MoneyInput value={f.paid_amount} onChange={(v) => set("paid_amount", v)} aria-label="المبلغ المسدد" />
          </Field>
          <Field label="التسوية مع شركة الطيران">
            <Select value={f.airline_settlement} onChange={(e) => set("airline_settlement", e.target.value as Form["airline_settlement"])}>
              <option value="pending">قيد التسوية</option>
              <option value="settled">تمت التسوية</option>
            </Select>
          </Field>
          <Field label="ملاحظات" className="sm:col-span-2 lg:col-span-3">
            <Textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
      </Card>

      <aside className="grid content-start gap-4 xl:sticky xl:top-6">
        <Card className="p-5">
          <p className="font-extrabold text-brand-950">مراجعة الاحتساب قبل الحفظ</p>
          <p className="mt-1 text-xs text-muted">تُحسب العمولتان من القواعد السارية في تاريخ الإصدار، وتُحفظ نسخة منها مع العملية.</p>
          <Button variant="subtle" className="mt-4 w-full" onClick={review} loading={pending && !preview} disabled={!f.airline_id || !f.base_fare} data-review-ticket>
            <Calculator className="size-4" aria-hidden="true" /> مراجعة الاحتساب
          </Button>
        </Card>
        {preview ? (
          <>
            {commissionCard("عمولة الشركة B2B", preview.company, "company")}
            {commissionCard("عمولة الاتجاه من شركة الطيران", preview.etijah, "etijah")}
            <Card className="p-5">
              <dl className="grid gap-2 text-sm">
                {[
                  ["إجمالي التذكرة", preview.math.total_fare],
                  ["صافي المستحق من الشركة", preview.math.net_due, "net"],
                  ["المستحق لشركة الطيران", preview.math.payable_to_airline],
                  ["نتيجة الاتجاه على العملية", preview.math.etijah_margin, "margin"],
                ].map(([k, v, tag]) => (
                  <div key={k as string} className="flex justify-between gap-3">
                    <dt className="text-muted">{k}</dt>
                    <dd className={`num font-black ${tag === "margin" && (v as number) < 0 ? "text-danger" : "text-brand-950"}`} data-preview-total={tag ?? undefined}>
                      {money(v as number)}
                    </dd>
                  </div>
                ))}
              </dl>
              {preview.warnings.length ? (
                <ul className="mt-3 grid gap-1.5">
                  {preview.warnings.map((w) => (
                    <li key={w} className="flex gap-2 rounded-lg bg-accent-50 px-3 py-2 text-xs font-bold text-accent-700">
                      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" /> {w}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#17663a]">
                  <Check className="size-4" aria-hidden="true" /> القواعد مطبقة بدون ملاحظات.
                </p>
              )}
              <Button variant="primary" className="mt-4 w-full" onClick={save} loading={pending} data-save-ticket>
                <Save className="size-4" aria-hidden="true" /> حفظ عملية الإصدار
              </Button>
            </Card>
          </>
        ) : null}
      </aside>
    </div>
  );
}
