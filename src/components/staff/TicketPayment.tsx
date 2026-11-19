"use client";

import { Ban, Save } from "lucide-react";
import { useState } from "react";
import { updateTicketPaymentAction, voidTicketAction } from "@/server/actions/airlines";
import { MoneyInput } from "./fields";
import { Button, Card, CardHeader, Field, Input, Select, Textarea } from "./ui";
import { useActionRunner } from "./useActionRunner";

export function TicketPayment({
  id,
  initial,
  netDue,
  canEdit,
  voided,
}: {
  id: number;
  initial: { payment_status: "unpaid" | "partial" | "paid"; paid_amount: number; payment_method: string | null; airline_settlement: "pending" | "settled"; notes: string | null };
  netDue: number;
  canEdit: boolean;
  voided: boolean;
}) {
  const [f, setF] = useState(initial);
  const [reason, setReason] = useState("");
  const { run, pending } = useActionRunner();
  return (
    <Card>
      <CardHeader title="الدفع والتسوية" description="تحديث حالة الدفع لا يغير المبالغ أو العمولات المسجلة." />
      <fieldset disabled={!canEdit || voided} className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="حالة الدفع">
          <Select value={f.payment_status} onChange={(e) => setF({ ...f, payment_status: e.target.value as typeof f.payment_status, paid_amount: e.target.value === "paid" ? netDue : f.paid_amount })} data-payment-status>
            <option value="unpaid">غير مسدد</option>
            <option value="partial">مسدد جزئياً</option>
            <option value="paid">مسدد</option>
          </Select>
        </Field>
        <Field label="المبلغ المسدد">
          <MoneyInput key={f.payment_status} value={f.paid_amount} onChange={(v) => setF({ ...f, paid_amount: v ?? 0 })} aria-label="المبلغ المسدد" />
        </Field>
        <Field label="طريقة التسديد">
          <Input value={f.payment_method ?? ""} onChange={(e) => setF({ ...f, payment_method: e.target.value || null })} />
        </Field>
        <Field label="التسوية مع شركة الطيران">
          <Select value={f.airline_settlement} onChange={(e) => setF({ ...f, airline_settlement: e.target.value as typeof f.airline_settlement })}>
            <option value="pending">قيد التسوية</option>
            <option value="settled">تمت التسوية</option>
          </Select>
        </Field>
        <Field label="ملاحظات" className="sm:col-span-2">
          <Textarea rows={2} value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value || null })} />
        </Field>
        <div className="flex flex-wrap justify-between gap-2 sm:col-span-2">
          <div className="flex gap-2">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب الإلغاء" className="w-56" aria-label="سبب الإلغاء" />
            <Button variant="danger" disabled={pending || reason.trim().length < 3} onClick={() => run(() => voidTicketAction({ id, reason }), { confirm: "إلغاء العملية؟ لن تُحتسب في التقارير." })}>
              <Ban className="size-4" aria-hidden="true" /> إلغاء العملية
            </Button>
          </div>
          <Button variant="primary" loading={pending} onClick={() => run(() => updateTicketPaymentAction({ id, ...f }))} data-save-payment>
            <Save className="size-4" aria-hidden="true" /> حفظ الدفع
          </Button>
        </div>
      </fieldset>
    </Card>
  );
}
