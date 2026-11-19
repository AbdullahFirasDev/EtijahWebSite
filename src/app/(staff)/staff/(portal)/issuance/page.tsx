import { CreditCard, ExternalLink, FileText, KeyRound, Mail, Phone, Plane, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader } from "@/components/staff/ui";
import { requireStaffPage } from "@/server/auth/session";
import { AIRLINE_STATUS_LABELS, CREDIT_LABELS, ISSUE_METHOD_LABELS, listAirlines } from "@/server/repo/airlines";

export const metadata = { title: "آلية إصدار التذاكر" };

/** Quick reference before issuing: how each airline is issued, paid and confirmed (staff only). */
export default async function IssuancePage() {
  await requireStaffPage("airlines.view");
  const airlines = (await listAirlines()).filter((a) => a.status !== "suspended");
  return (
    <>
      <PageHeader
        title="آلية إصدار التذاكر"
        description="مرجع سريع قبل تنفيذ أي إصدار: طريقة الإصدار لكل شركة طيران، الروابط والتعليمات والدفع. النظام لا يصدر التذاكر تلقائياً ولا يحفظ كلمات المرور."
      />
      {airlines.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {airlines.map((a) => {
            const i = a.issuance;
            return (
              <Card key={a.id} className="p-5" data-issuance={a.iata ?? a.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link href={`/staff/airlines/${a.id}/#issuance`} prefetch={false} className="flex items-center gap-2 text-lg font-extrabold text-brand-950 hover:underline">
                      <Plane className="size-5 text-brand-600" aria-hidden="true" /> {a.name_ar}
                    </Link>
                    <p className="text-xs text-muted" dir="ltr">
                      {a.name_en} {a.iata ? `· ${a.iata}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="brand">{ISSUE_METHOD_LABELS[i.method]}</Badge>
                    {a.status !== "active" ? <Badge tone="muted">{AIRLINE_STATUS_LABELS[a.status]}</Badge> : null}
                  </div>
                </div>
                {i.method_note ? <p className="mt-2 text-sm text-muted">{i.method_note}</p> : null}
                <ul className="mt-3 grid gap-1.5 text-sm">
                  {i.portal_url ? (
                    <li className="flex items-center gap-2">
                      <ExternalLink className="size-4 text-brand-500" aria-hidden="true" />
                      <a href={i.portal_url} target="_blank" rel="noopener noreferrer" className="font-bold text-brand-700 underline" dir="ltr">
                        {i.portal_url}
                      </a>
                    </li>
                  ) : null}
                  {i.email ? (
                    <li className="flex items-center gap-2">
                      <Mail className="size-4 text-brand-500" aria-hidden="true" /> <span dir="ltr">{i.email}</span>
                    </li>
                  ) : null}
                  {i.phone ? (
                    <li className="flex items-center gap-2">
                      <Phone className="size-4 text-brand-500" aria-hidden="true" /> <span dir="ltr" className="num">{i.phone}</span>
                    </li>
                  ) : null}
                  <li className="flex items-center gap-2">
                    <CreditCard className="size-4 text-brand-500" aria-hidden="true" /> {i.prepayment_required ? "يتطلب الدفع المسبق" : "لا يتطلب دفعاً مسبقاً"} · {CREDIT_LABELS[i.credit]}
                    {i.credit_note ? ` (${i.credit_note})` : ""}
                  </li>
                  {i.secret_ref ? (
                    <li className="flex items-center gap-2">
                      <KeyRound className="size-4 text-brand-500" aria-hidden="true" /> بيانات الدخول في: {i.secret_ref}
                    </li>
                  ) : null}
                </ul>
                {[
                  ["تعليمات الإصدار", i.instructions],
                  ["المستندات المطلوبة", i.documents],
                  ["إرسال طلب الحجز", i.booking_request],
                  ["تأكيد الإصدار", i.confirmation],
                  ["الدفع والتسوية", i.payment],
                  ["ملاحظات الوصول", i.access_notes],
                  ["ملاحظات خاصة", i.notes],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="mt-3">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-muted">
                        <FileText className="size-3.5" aria-hidden="true" /> {k}
                      </p>
                      <p className="mt-0.5 text-sm whitespace-pre-line text-ink">{v}</p>
                    </div>
                  ))}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<ShieldCheck className="size-6" />} title="لا توجد شركات طيران" text="أضف شركات الطيران وحدد آلية إصدار كل منها." />
      )}
    </>
  );
}
