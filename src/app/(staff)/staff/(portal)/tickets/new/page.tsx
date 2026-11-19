import { TicketForm } from "@/components/staff/TicketForm";
import { PageHeader } from "@/components/staff/ui";
import { requireStaffPage } from "@/server/auth/session";
import { listAirlines } from "@/server/repo/airlines";
import { listCompanies } from "@/server/repo/companies";
import { getSettings } from "@/server/repo/settings";

export const metadata = { title: "تسجيل عملية إصدار" };

export default async function NewTicketPage() {
  await requireStaffPage("tickets.manage");
  const [airlines, companies, settings] = await Promise.all([listAirlines(), listCompanies(), getSettings()]);
  return (
    <>
      <PageHeader title="تسجيل عملية إصدار تذكرة" description="سجّل التذكرة بعد إصدارها من نظام شركة الطيران. يحتسب النظام العمولتين تلقائياً حسب القواعد السارية في تاريخ الإصدار، وتراجعهما قبل الحفظ." back={{ href: "/staff/tickets/", label: "سجلات الإصدارات" }} />
      <TicketForm
        airlines={airlines.filter((a) => a.status !== "suspended").map((a) => ({ id: a.id, name: a.name_ar, iata: a.iata, method: a.issuance.method }))}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        currencies={settings.currencies}
      />
    </>
  );
}
