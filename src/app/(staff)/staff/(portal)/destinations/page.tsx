import { DestinationsManager } from "@/components/staff/DestinationsManager";
import { PageHeader } from "@/components/staff/ui";
import { GEO_COUNTRIES } from "@/data/destinations";
import { COUNTRY_CODES, countryName } from "@/lib/countries";
import { can } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { db } from "@/server/db";
import { geoCoverage } from "@/server/db/geo";
import { mediaByIds } from "@/server/media";
import { listDestinations } from "@/server/repo/catalog";

export const metadata = { title: "الوجهات" };

export default async function DestinationsPage() {
  const staff = await requireStaffPage("programs.view");
  const canEdit = can(staff.role, "destinations.edit");
  const [rows, coverage] = await Promise.all([listDestinations(), canEdit ? geoCoverage(await db(), GEO_COUNTRIES) : Promise.resolve([])]);
  const media = await mediaByIds(rows.map((r) => r.cover_media_id));
  const order = new Map(COUNTRY_CODES.map((c, i) => [c, i]));
  const present = [...new Set(rows.map((r) => r.country_code))].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
  return (
    <>
      <PageHeader title="الدول والوجهات" description="الدول والمدن والمناطق السياحية التي تُنظَّم إليها البرامج. كل فندق يتبع وجهة، وكل برنامج يرتبط بوجهة أو أكثر." />
      <DestinationsManager
        canEdit={canEdit}
        canDelete={can(staff.role, "programs.delete")}
        countries={present.map((code) => ({ code, name: countryName(code, "ar"), count: rows.filter((r) => r.country_code === code).length }))}
        reference={coverage.filter((c) => c.missing > 0).map((c) => ({ ...c, name: countryName(c.code, "ar") }))}
        items={rows.map((r) => ({
          id: r.id,
          country_code: r.country_code,
          country_name: countryName(r.country_code, "ar"),
          name_ar: r.name_ar,
          name_en: r.name_en,
          kind: r.kind ?? "city",
          airport_code: r.airport_code ?? null,
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
