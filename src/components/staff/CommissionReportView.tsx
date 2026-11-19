import { formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { CommissionReport } from "@/server/repo/tickets";

type Row = CommissionReport["byAirline"][number];

function SumTable({ title, rows, nameHeader, print }: { title: string; rows: Row[]; nameHeader: string; print?: boolean }) {
  const m = (n: number, c: string) => formatMoney(n, c, "ar");
  return (
    <section className={print ? "mb-6 break-inside-avoid" : "rounded-2xl border border-line bg-white"} data-report-table={title}>
      <h2 className={print ? "mb-2 text-base font-extrabold text-brand-950" : "border-b border-line px-5 py-3 font-extrabold text-brand-950"}>{title}</h2>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm [&_td]:border-t [&_td]:border-line [&_td]:px-3 [&_td]:py-2 [&_th]:bg-mist [&_th]:px-3 [&_th]:py-2 [&_th]:text-start [&_th]:text-xs [&_th]:text-muted">
            <thead>
              <tr>
                <th>{nameHeader}</th>
                <th>العملة</th>
                <th>التذاكر</th>
                <th>إجمالي التذاكر</th>
                <th>عمولة الاتجاه</th>
                <th>عمولات الشركات</th>
                <th>المستحق من الشركات</th>
                <th>المسدد</th>
                <th>المتبقي</th>
                <th>نتيجة الاتجاه</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.key}-${r.currency}`}>
                  <td className="font-bold text-brand-950">{r.name}</td>
                  <td className="num">{r.currency}</td>
                  <td className="num">{r.tickets}</td>
                  <td className="num">{m(r.total_fare, r.currency)}</td>
                  <td className="num font-bold text-brand-700">{m(r.etijah_commission, r.currency)}</td>
                  <td className="num">{m(r.company_commission, r.currency)}</td>
                  <td className="num">{m(r.net_due, r.currency)}</td>
                  <td className="num">{m(r.paid, r.currency)}</td>
                  <td className={`num font-bold ${r.outstanding > 0 ? "text-accent-700" : ""}`}>{m(r.outstanding, r.currency)}</td>
                  <td className={`num font-bold ${r.margin < 0 ? "text-danger" : "text-[#17663a]"}`}>{m(r.margin, r.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 py-4 text-sm text-muted">لا توجد عمليات في الفترة المحددة.</p>
      )}
    </section>
  );
}

function TicketList({ title, rows, print }: { title: string; rows: CommissionReport["noCommission"]; print?: boolean }) {
  return (
    <section className={print ? "mb-6 break-inside-avoid" : "rounded-2xl border border-line bg-white"}>
      <h2 className={print ? "mb-2 text-base font-extrabold text-brand-950" : "border-b border-line px-5 py-3 font-extrabold text-brand-950"}>
        {title} <span className="num text-sm font-bold text-muted">({rows.length})</span>
      </h2>
      {rows.length ? (
        <table className="w-full text-sm [&_td]:border-t [&_td]:border-line [&_td]:px-3 [&_td]:py-2 [&_th]:bg-mist [&_th]:px-3 [&_th]:py-2 [&_th]:text-start [&_th]:text-xs [&_th]:text-muted">
          <thead>
            <tr>
              <th>المرجع</th>
              <th>التذكرة</th>
              <th>الخط</th>
              <th>الشركة</th>
              <th>التاريخ</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td className="num">{t.ref}</td>
                <td className="num" dir="ltr">
                  {t.ticket_number}
                </td>
                <td>{t.airline_name}</td>
                <td>{t.company_name ?? "مباشر"}</td>
                <td className="text-xs">{formatDay(t.issued_at, "ar")}</td>
                <td className="num">{formatMoney(t.total_fare, t.currency, "ar")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="px-5 py-4 text-sm text-muted">لا توجد.</p>
      )}
    </section>
  );
}

/** Commission report body: shared by the staff page and the PDF print page. */
export function CommissionReportView({ report, print }: { report: CommissionReport; print?: boolean }) {
  return (
    <div className={print ? "" : "grid gap-6"}>
      <SumTable title="الإجمالي (لكل عملة)" rows={report.totals} nameHeader="" print={print} />
      <SumTable title="عمولاتنا حسب شركة الطيران" rows={report.byAirline} nameHeader="شركة الطيران" print={print} />
      <SumTable title="عمولات كل شركة B2B" rows={report.byCompany} nameHeader="الشركة" print={print} />
      <TicketList title="عمليات لا توجد عليها عمولة للاتجاه" rows={report.noCommission} print={print} />
      <TicketList title="عمليات بنظام السعر الصافي (Net Fare)" rows={report.netFare} print={print} />
    </div>
  );
}
