import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { LogoBadge } from "@/components/brand/Logo";
import { CommissionReportView } from "@/components/staff/CommissionReportView";
import { formatDateTime, formatDay } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { getStaff } from "@/server/auth/session";
import { RENDER_COOKIE, verifyRenderCookie } from "@/server/pdf";
import { col } from "@/server/db";
import { commissionReport } from "@/server/repo/tickets";
import { parseTicketFilters, type Search } from "@/server/ticket-filters";

export const dynamic = "force-dynamic";
export const metadata = { title: "تقرير العمولات" };

/** Landscape A4 commission report (PDF source). Finance staff, or the renderer with a signed cookie. */
export default async function ReportPrintPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const staff = await getStaff();
  const allowed = (staff && can(staff.role, "reports.finance")) || (sp.k && (await verifyRenderCookie(`report:${sp.k}`, (await cookies()).get(RENDER_COOKIE)?.value)));
  if (!allowed) notFound();
  const f = parseTicketFilters(sp);
  const [report, company, airline] = await Promise.all([
    commissionReport(f),
    f.companyId ? (await col("companies")).findOne({ _id: f.companyId }, { projection: { name: 1 } }) : null,
    f.airlineId ? (await col("airlines")).findOne({ _id: f.airlineId }, { projection: { name_ar: 1 } }) : null,
  ]);
  return (
    <div className="bg-white p-[10mm] text-ink" style={{ fontSize: "9.5pt" }}>
      <style>{`@page { size: A4 landscape; margin: 10mm 0 14mm; } html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}</style>
      <header className="mb-6 flex items-center justify-between border-b-2 border-brand-950 pb-3">
        <div className="flex items-center gap-3">
          <LogoBadge className="size-12" idSuffix="report" />
          <div>
            <p className="text-lg font-black text-brand-950">تقرير العمولات والمستحقات</p>
            <p className="text-xs text-muted">الاتجاه للسياحة والسفر — للاستخدام الداخلي</p>
          </div>
        </div>
        <div className="text-end text-xs text-muted">
          <p>
            الفترة: {f.from ? formatDay(f.from, "ar") : "من البداية"} ← {f.to ? formatDay(f.to, "ar") : "حتى اليوم"}
          </p>
          <p>
            {company ? `الشركة: ${company.name}` : "كل الشركات"} · {airline ? `الخط: ${airline.name_ar}` : "كل الخطوط"}
          </p>
          <p>أُعدّ: {formatDateTime(new Date().toISOString())}</p>
        </div>
      </header>
      <CommissionReportView report={report} print />
    </div>
  );
}
