import { FileDown, FileSpreadsheet } from "lucide-react";
import { CommissionReportView } from "@/components/staff/CommissionReportView";
import { Card, Input, PageHeader, Select } from "@/components/staff/ui";
import { asset } from "@/lib/asset";
import { requireStaffPage } from "@/server/auth/session";
import { airlineOptions } from "@/server/repo/airlines";
import { listCompanies } from "@/server/repo/companies";
import { commissionReport } from "@/server/repo/tickets";
import { parseTicketFilters, type Search } from "@/server/ticket-filters";

export const metadata = { title: "تقارير العمولات" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireStaffPage("reports.finance");
  const sp = await searchParams;
  const f = parseTicketFilters(sp);
  const [report, airlines, companies] = await Promise.all([commissionReport(f), airlineOptions(), listCompanies()]);
  const qs = new URLSearchParams(Object.entries({ airline: sp.airline, company: sp.company, from: sp.from, to: sp.to }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <PageHeader
        title="تقارير العمولات"
        description="إجمالي عمولاتنا حسب شركة الطيران، عمولات كل شركة، المستحقات والمسدد، والعمليات بدون عمولة أو بالسعر الصافي. المبالغ بعملات مختلفة لا تُجمع معاً."
        actions={
          <>
            <a href={asset(`/staff/reports/export/?format=xlsx${qs ? `&${qs}` : ""}`)} className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 font-bold text-brand-900 hover:bg-brand-50" data-export-xlsx>
              <FileSpreadsheet className="size-4 text-[#17663a]" aria-hidden="true" /> تصدير Excel
            </a>
            <a href={asset(`/staff/reports/export/?format=pdf${qs ? `&${qs}` : ""}`)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 font-bold text-white hover:bg-brand-700" data-export-pdf>
              <FileDown className="size-4" aria-hidden="true" /> تصدير PDF
            </a>
          </>
        }
      />
      <Card className="mb-6">
        <form className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-5" role="search">
          <Select name="company" defaultValue={sp.company ?? ""} aria-label="الشركة">
            <option value="">كل الشركات</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select name="airline" defaultValue={sp.airline ?? ""} aria-label="شركة الطيران">
            <option value="">كل الخطوط</option>
            {airlines.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-xs font-bold text-muted">
            من <Input type="date" name="from" dir="ltr" defaultValue={sp.from} className="num" />
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-muted">
            إلى <Input type="date" name="to" dir="ltr" defaultValue={sp.to} className="num" />
          </label>
          <button className="h-11 rounded-xl bg-brand-50 px-4 text-sm font-bold text-brand-700 hover:bg-brand-100">عرض التقرير</button>
        </form>
      </Card>
      <CommissionReportView report={report} />
    </>
  );
}
