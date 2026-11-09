import { DestinationsManager } from "@/components/staff/DestinationsManager";
import { PageHeader } from "@/components/staff/ui";
import { can } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { mediaByIds } from "@/server/media";
import { listDestinations } from "@/server/repo/catalog";

export const metadata = { title: "الوجهات" };

export default async function DestinationsPage() {
  const staff = await requireStaffPage("catalog.view");
  const rows = listDestinations();
  const media = mediaByIds(rows.map((r) => r.cover_media_id).filter((m): m is string => !!m));
  return (
    <>
      <PageHeader title="الوجهات" description="الدول والمدن التي تُنظَّم إليها البرامج. كل فندق يتبع وجهة، وكل برنامج يرتبط بوجهة أو أكثر." />
      <DestinationsManager
        canEdit={can(staff.role, "catalog.edit")}
        canDelete={can(staff.role, "catalog.delete")}
        items={rows.map((r) => ({
          id: r.id,
          country_code: r.country_code,
          name_ar: r.name_ar,
          name_en: r.name_en,
          summary_ar: r.summary_ar,
          summary_en: r.summary_en,
          cover: r.cover_media_id ? (media.get(r.cover_media_id) ?? null) : null,
          active: !!r.active,
          hotels: r.hotels,
          programs: r.programs,
        }))}
      />
    </>
  );
}
