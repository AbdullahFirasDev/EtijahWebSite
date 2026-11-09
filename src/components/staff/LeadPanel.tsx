"use client";

import { Mail, Phone, Send } from "lucide-react";
import { useState } from "react";
import { WhatsAppIcon } from "@/components/ui/icons";
import { waLink } from "@/lib/phone";
import { LEAD_STATUS_LABELS, LEAD_STATUSES, type LeadStatus } from "@/lib/travel-labels";
import { logLeadContactAction, updateLeadAction } from "@/server/actions/leads";
import { Button, Card, CardHeader, Field, Select, Textarea } from "./ui";
import { useActionRunner } from "./useActionRunner";

interface Props {
  lead: { id: number; ref: string; status: LeadStatus; assigned_to: number | null; full_name: string; phone: string; email: string | null; program_title: string; locale: "ar" | "en" };
  staff: { id: number; name: string }[];
  canManage: boolean;
}

export function LeadPanel({ lead, staff, canManage }: Props) {
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [note, setNote] = useState("");
  const [assignee, setAssignee] = useState<number | null>(lead.assigned_to);
  const { run, pending } = useActionRunner();

  const greeting =
    lead.locale === "en"
      ? `Hello ${lead.full_name}, this is Etijah Travel & Tourism regarding your request ${lead.ref} for "${lead.program_title}".`
      : `مرحباً ${lead.full_name}، معك فريق الاتجاه للسياحة والسفر بخصوص طلبك رقم ${lead.ref} لبرنامج «${lead.program_title}».`;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader title="التواصل مع المسافر" />
        <div className="grid gap-2 p-4">
          <a
            href={waLink(lead.phone, greeting)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => canManage && run(() => logLeadContactAction({ id: lead.id, channel: "whatsapp" }), { refresh: true })}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1fa855] font-bold text-white hover:bg-[#178a45]"
          >
            <WhatsAppIcon className="size-5" /> مراسلة عبر واتساب
          </a>
          <a href={`tel:${lead.phone}`} onClick={() => canManage && run(() => logLeadContactAction({ id: lead.id, channel: "phone" }), { refresh: true })} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line font-bold text-brand-900 hover:bg-brand-50">
            <Phone className="size-4" aria-hidden="true" /> اتصال
          </a>
          {lead.email ? (
            <a href={`mailto:${lead.email}?subject=${encodeURIComponent(`${lead.ref} — ${lead.program_title}`)}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line font-bold text-brand-900 hover:bg-brand-50">
              <Mail className="size-4" aria-hidden="true" /> بريد إلكتروني
            </a>
          ) : null}
        </div>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader title="متابعة الطلب" />
          <div className="grid gap-4 p-4">
            <Field label="الحالة" htmlFor="lead-status" hint={status === "confirmed" ? "عند التأكيد تُخصم مقاعد المسافرين من موعد الكروب تلقائياً." : undefined}>
              <Select id="lead-status" value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)}>
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {LEAD_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="الموظف المسؤول" htmlFor="lead-assignee">
              <Select id="lead-assignee" value={assignee ?? ""} onChange={(e) => setAssignee(e.target.value ? Number(e.target.value) : null)}>
                <option value="">غير مُسند</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="ملاحظة داخلية" htmlFor="lead-note" hint="تظهر في سجل الطلب للموظفين فقط.">
              <Textarea id="lead-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: تم إرسال الأسعار، بانتظار تأكيد الدفع…" />
            </Field>
            <Button
              variant="primary"
              loading={pending}
              onClick={() =>
                run(
                  () =>
                    updateLeadAction({
                      id: lead.id,
                      status: status !== lead.status ? status : undefined,
                      note: note || null,
                      assigned_to: assignee !== lead.assigned_to ? assignee : undefined,
                    }),
                  { onOk: () => setNote("") },
                )
              }
            >
              <Send className="size-4 rtl:-scale-x-100" aria-hidden="true" /> حفظ التحديث
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
