import { notFound } from "next/navigation";
import { ProgramEditor, type ProgramFormState } from "@/components/staff/ProgramEditor";
import { PageHeader } from "@/components/staff/ui";
import { can } from "@/lib/permissions";
import type { MediaRef } from "@/lib/media";
import { requireStaffPage } from "@/server/auth/session";
import { get } from "@/server/db";
import { catalogOptions } from "@/server/editor-options";
import { mediaByIds } from "@/server/media";
import { getProgramEditor } from "@/server/repo/programs";

export const metadata = { title: "تعديل برنامج" };

export default async function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffPage("catalog.edit");
  const p = getProgramEditor(Number((await params).id));
  if (!p) notFound();
  const o = catalogOptions();
  const media = mediaByIds([...(p.cover_media_id ? [p.cover_media_id] : []), ...p.gallery]);
  const leads = get<{ n: number }>("SELECT COUNT(*) AS n FROM leads WHERE program_id = ?", p.id)!.n;

  const initial: ProgramFormState = {
    ...p,
    cover: p.cover_media_id ? (media.get(p.cover_media_id) ?? null) : null,
    gallery: p.gallery.map((m) => media.get(m)).filter((m): m is MediaRef => !!m),
    prices: p.prices,
    hotels: p.hotels,
    services: Object.fromEntries(p.services.map((s) => [s.service_id, { state: s.included ? "included" : "excluded", note_ar: s.note_ar, note_en: s.note_en }])),
    departures: p.departures.map((d) => ({ ...d, key: `d${d.id}` })),
  };

  return (
    <>
      <PageHeader title={p.title_ar} description={p.title_en ?? undefined} back={{ href: "/staff/programs/", label: "البرامج" }} />
      <ProgramEditor
        initial={initial}
        meta={{ id: p.id, code: p.code, slug: p.slug, status: p.status, view_count: p.view_count, leads }}
        publicUrl={p.status === "published" ? `/programs/${p.slug}/` : null}
        destinations={o.destinations}
        hotels={o.hotels}
        services={o.services}
        currencies={o.currencies}
        permissions={{ publish: can(staff.role, "catalog.publish"), delete: can(staff.role, "catalog.delete") }}
      />
    </>
  );
}
