import { notFound } from "next/navigation";
import { TicketPayment } from "@/components/staff/TicketPayment";
import { Badge, Card, CardHeader, PageHeader } from "@/components/staff/ui";
import { COMMISSION_BASIS_LABELS, COMMISSION_KIND_LABELS, COMMISSION_METHOD_LABELS, ruleLabel } from "@/lib/commission-math";
import { formatDateTime, formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { col } from "@/server/db";
import { ISSUE_METHOD_LABELS } from "@/server/repo/airlines";
import { getTicket, PAYMENT_STATUS_LABELS, type CommissionSnapshot } from "@/server/repo/tickets";
import { recentAudit } from "@/server/security";

export const metadata = { title: "عملية إصدار" };

function Snapshot({ title, c, currency }: { title: string; c: CommissionSnapshot | null; currency: string }) {
  return (
    <Card className="p-5" data-snapshot={title}>
      <p className="text-sm font-extrabold text-brand-950">{title}</p>
      {c ? (
        <>
          <p className="num mt-2 text-2xl font-black text-brand-700">{formatMoney(c.amount, currency, "ar")}</p>
          <dl className="mt-2 grid gap-1 text-xs text-muted">
            <div>القاعدة المستخدمة: {c.rule_id ? `#${c.rule_id}` : "لا توجد قاعدة"}</div>
            <div>
              النوع: {COMMISSION_KIND_LABELS[c.kind]} {c.kind === "commission" ? `· ${COMMISSION_METHOD_LABELS[c.method]} · ${ruleLabel(c)}` : ""}
            </div>
            {c.kind === "commission" && c.method === "percent" ? <div>الأساس: {COMMISSION_BASIS_LABELS[c.basis]}</div> : null}
            {c.overridden ? (
              <div className="font-bold text-accent-700">
                معدّل يدوياً — المحسوب {formatMoney(c.computed_amount, currency, "ar")} · السبب: {c.override_reason}
              </div>
            ) : null}
          </dl>
          <p className="mt-2 text-[0.7rem] text-muted">نسخة محفوظة لحظة التسجيل: لا تتغير بتعديل قواعد العمولة لاحقاً.</p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">بيع مباشر — لا توجد شركة B2B.</p>
      )}
    </Card>
  );
}

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffPage("tickets.view");
  const id = Number((await params).id);
  const t = Number.isInteger(id) ? await getTicket(id) : null;
  if (!t) notFound();
  const [airline, company, staffUser, history] = await Promise.all([
    (await col("airlines")).findOne({ _id: t.airline_id }, { projection: { name_ar: 1, iata: 1 } }),
    t.company_id ? (await col("companies")).findOne({ _id: t.company_id }, { projection: { name: 1 } }) : null,
    (await col("staff_users")).findOne({ _id: t.staff_id }, { projection: { name: 1 } }),
    recentAudit("ticket", t._id),
  ]);
  const m = (n: number) => formatMoney(n, t.currency, "ar");

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="num">{t.ref}</span> {t.status === "void" ? <Badge tone="danger">ملغاة</Badge> : <Badge tone="success">مُصدرة</Badge>}
          </span>
        }
        description={`${airline?.name_ar ?? ""} · ${company?.name ?? "بيع مباشر"} · ${formatDay(t.issued_at, "ar")}`}
        back={{ href: "/staff/tickets/", label: "سجلات الإصدارات" }}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader title="بيانات التذكرة" />
            <dl className="grid gap-3 p-5 text-sm sm:grid-cols-3">
              {[
                ["رقم التذكرة", <span key="n" className="num" dir="ltr">{t.ticket_number}</span>],
                ["PNR", <span key="p" className="num" dir="ltr">{t.pnr ?? "—"}</span>],
                ["المسافر", t.passenger ?? "—"],
                ["المسار", t.route ?? "—"],
                ["طريقة الإصدار", ISSUE_METHOD_LABELS[t.issue_method]],
                ["الموظف المسؤول", staffUser?.name ?? "—"],
                ["السعر الأساسي", m(t.base_fare)],
                ["الضرائب", m(t.taxes)],
                ["إجمالي التذكرة", m(t.total_fare)],
                ["رسوم الخدمة", m(t.service_fee)],
                ["صافي المستحق من الشركة", <span key="d" className="num font-black text-brand-700" data-net-due>{m(t.net_due)}</span>],
                ["المستحق لشركة الطيران", m(t.payable_to_airline)],
                ["نتيجة الاتجاه", <span key="g" className={`num font-black ${t.etijah_margin < 0 ? "text-danger" : "text-[#17663a]"}`}>{m(t.etijah_margin)}</span>],
                ["حالة الدفع", `${PAYMENT_STATUS_LABELS[t.payment_status]} (${m(t.paid_amount)})`],
                ["التسوية مع الخط", t.airline_settlement === "settled" ? "تمت" : "قيد التسوية"],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-xs font-bold text-muted">{k}</dt>
                  <dd className="mt-0.5 font-bold text-brand-950">{v}</dd>
                </div>
              ))}
            </dl>
            {t.void_reason ? <p className="border-t border-line px-5 py-3 text-sm font-bold text-danger">سبب الإلغاء: {t.void_reason}</p> : null}
          </Card>
          <TicketPayment
            id={t._id}
            netDue={t.net_due}
            canEdit={can(staff.role, "tickets.manage")}
            voided={t.status === "void"}
            initial={{ payment_status: t.payment_status, paid_amount: t.paid_amount, payment_method: t.payment_method, airline_settlement: t.airline_settlement, notes: t.notes }}
          />
          <Card>
            <CardHeader title="سجل العمليات" />
            <ul className="divide-y divide-line text-sm">
              {history.map((h, i) => (
                <li key={i} className="flex justify-between gap-3 px-5 py-2.5">
                  <span className="font-bold">{h.action === "create" ? "تسجيل العملية" : h.action === "payment" ? "تحديث الدفع" : h.action === "void" ? "إلغاء" : h.action}</span>
                  <span className="text-xs text-muted">
                    {h.user_name ?? "—"} · {formatDateTime(h.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <aside className="grid content-start gap-4">
          <Snapshot title="عمولة الشركة B2B" c={t.company_commission} currency={t.currency} />
          <Snapshot title="عمولة الاتجاه" c={t.etijah_commission} currency={t.currency} />
        </aside>
      </div>
    </>
  );
}
