import { can } from "@/lib/permissions";
import { getStaff } from "@/server/auth/session";
import { basePath, pdfResponse, pdfUnavailable, renderOrigin, renderPdf } from "@/server/pdf";
import { commissionReport } from "@/server/repo/tickets";
import { audit, sha256 } from "@/server/security";
import { parseTicketFilters } from "@/server/ticket-filters";
import { buildXlsx, type Cell } from "@/server/xlsx";

/** Commission report export: Excel (.xlsx) or PDF. Finance staff only. */
export async function GET(request: Request) {
  const staff = await getStaff();
  if (!staff || !can(staff.role, "reports.finance")) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const sp = Object.fromEntries(["airline", "company", "from", "to"].map((k) => [k, url.searchParams.get(k) ?? undefined]));
  const f = parseTicketFilters(sp);
  const period = [f.from ?? "…", f.to ?? "…"].join("_");
  await audit(staff.id, `export:${url.searchParams.get("format") ?? "xlsx"}`, "report", "commissions", sp);

  if (url.searchParams.get("format") === "pdf") {
    const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
    const origin = renderOrigin(request);
    if (!origin) return new Response("PDF rendering needs NEXT_PUBLIC_SITE_URL.", { status: 503 });
    const key = sha256(qs || "all").slice(0, 16);
    try {
      // Reports change with every ticket: a fresh cache key per request.
      const pdf = await renderPdf({ resource: `report:${key}`, url: `${origin}${basePath()}/print/report/?${qs}${qs ? "&" : ""}k=${key}`, cacheKey: `r-${key}-${Date.now()}`, locale: "ar", ref: "تقرير العمولات", landscape: true });
      return pdfResponse(pdf, `Etijah-commissions-${period}.pdf`, request);
    } catch (error) {
      console.error("[report pdf]", error);
      return pdfUnavailable("ar");
    }
  }

  const r = await commissionReport(f);
  const head = ["الاسم", "العملة", "التذاكر", "إجمالي التذاكر", "عمولة الاتجاه", "عمولات الشركات", "المستحق من الشركات", "المسدد", "المتبقي", "نتيجة الاتجاه"];
  const major = (n: number) => Math.round(n) / 100;
  const sumRows = (rows: typeof r.byAirline): Cell[][] => [head, ...rows.map((x) => [x.name, x.currency, x.tickets, major(x.total_fare), major(x.etijah_commission), major(x.company_commission), major(x.net_due), major(x.paid), major(x.outstanding), major(x.margin)])];
  const listRows = (rows: typeof r.noCommission): Cell[][] => [["المرجع", "رقم التذكرة", "PNR", "الخط", "الشركة", "التاريخ", "العملة", "الإجمالي"], ...rows.map((t) => [t.ref, t.ticket_number, t.pnr, t.airline_name, t.company_name ?? "مباشر", t.issued_at, t.currency, major(t.total_fare)])];
  const xlsx = buildXlsx([
    { name: "الإجمالي", rows: sumRows(r.totals), rtl: true },
    { name: "حسب شركة الطيران", rows: sumRows(r.byAirline), rtl: true },
    { name: "حسب الشركة", rows: sumRows(r.byCompany), rtl: true },
    { name: "بدون عمولة", rows: listRows(r.noCommission), rtl: true },
    { name: "سعر صافي", rows: listRows(r.netFare), rtl: true },
  ]);
  const filename = `Etijah-commissions-${period}.xlsx`;
  return new Response(new Uint8Array(xlsx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
