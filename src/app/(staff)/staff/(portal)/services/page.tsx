import { ServicesManager } from "@/components/staff/ServicesManager";
import { PageHeader } from "@/components/staff/ui";
import { can } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { listServices } from "@/server/repo/catalog";

export const metadata = { title: "الخدمات" };

export default async function ServicesPage() {
  const staff = await requireStaffPage("programs.view");
  return (
    <>
      <PageHeader title="الخدمات" description="قائمة الخدمات التي يمكن تحديدها كمشمولة أو غير مشمولة في كل برنامج (طيران، فندق، نقل، تأشيرة…)." />
      <ServicesManager
        canEdit={can(staff.role, "services.edit")}
        canDelete={can(staff.role, "programs.delete")}
        items={(await listServices()).map((s) => ({ id: s.id, icon: s.icon, name_ar: s.name_ar, name_en: s.name_en, sort: s.sort, active: !!s.active, programs: s.programs }))}
      />
    </>
  );
}
