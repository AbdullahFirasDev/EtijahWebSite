import { ToursManager } from "@/components/staff/ToursManager";
import { PageHeader } from "@/components/staff/ui";
import { can } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { getSettings } from "@/server/repo/settings";
import { listTours } from "@/server/repo/tours";

export const metadata = { title: "الجولات المسجلة" };

export default async function ToursPage() {
  const staff = await requireStaffPage("programs.view");
  const canCosts = can(staff.role, "hotels.costs");
  const [tours, settings] = await Promise.all([listTours({ includeCosts: canCosts }), getSettings()]);
  return (
    <>
      <PageHeader title="الجولات المسجلة" description="مكتبة الجولات السياحية والرحلات اليومية: تُسجل مرة واحدة ثم تُضاف إلى أيام البرامج السياحية وعروض الأسعار مع وصفها وسعرها." />
      <ToursManager
        canEdit={can(staff.role, "tours.edit")}
        canCosts={canCosts}
        currencies={settings.currencies as string[]}
        defaultCurrency={settings.default_currency as string}
        items={tours}
      />
    </>
  );
}
