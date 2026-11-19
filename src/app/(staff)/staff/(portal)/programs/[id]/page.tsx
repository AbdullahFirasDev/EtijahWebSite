import { Eye } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProgramActions, ProgramExportPanel } from "@/components/staff/ProgramPanels";
import { ProgramWizard } from "@/components/staff/ProgramWizard";
import { ProgramStatusBadge } from "@/components/staff/StatusBadge";
import { Badge, PageHeader } from "@/components/staff/ui";
import { site } from "@/content/site";
import { can } from "@/lib/permissions";
import { TYPE_LABELS } from "@/lib/travel-labels";
import { requireStaffPage } from "@/server/auth/session";
import { col } from "@/server/db";
import { catalogOptions } from "@/server/editor-options";
import { programToForm } from "@/server/program-form";
import { getProgramEditor } from "@/server/repo/programs";

export const metadata = { title: "برنامج سياحي" };

export default async function EditProgramPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ step?: string }> }) {
  const staff = await requireStaffPage("programs.view");
  const id = Number((await params).id);
  const step = Number((await searchParams).step ?? 0) || 0;
  const p = Number.isInteger(id) ? await getProgramEditor(id) : null;
  if (!p) notFound();
  const costs = can(staff.role, "hotels.costs");
  const [options, { form, meta }, leads] = await Promise.all([catalogOptions({ includeCosts: costs }), programToForm(p, { includeCosts: costs }), (await col("leads")).countDocuments({ program_id: p.id })]);
  const canEdit = can(staff.role, "programs.edit");

  return (
    <>
      <PageHeader
        title={p.title_ar}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="num">{p.code}</span>
            <Badge tone={p.type === "fixed" ? "accent" : "brand"}>{TYPE_LABELS[p.type].ar}</Badge>
            <ProgramStatusBadge status={p.status} />
            <span>
              {p.view_count} مشاهدة ·{" "}
              <Link href={`/staff/requests/?program=${p.id}`} prefetch={false} className="font-bold text-brand-600 hover:underline">
                {leads} طلب
              </Link>
            </span>
          </span>
        }
        back={{ href: "/staff/programs/", label: "البرامج السياحية" }}
        actions={
          <>
            <Link href={`/staff/preview/program/${p.id}/`} prefetch={false} target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-brand-700 hover:bg-brand-50">
              <Eye className="size-4" aria-hidden="true" /> معاينة
            </Link>
            <ProgramActions id={p.id} status={p.status} canPublish={can(staff.role, "programs.publish")} canEdit={canEdit} canDelete={can(staff.role, "programs.delete")} />
          </>
        }
      />
      <div className="mb-6">
        <ProgramExportPanel id={p.id} title={p.title_ar} status={p.status} share={p.share} siteUrl={site.url} canShare={can(staff.role, "programs.publish")} />
      </div>
      {canEdit ? (
        <ProgramWizard
          key={p.updated_at}
          initialStep={step}
          initial={form}
          meta={meta}
          options={options}
          rights={{ pricing: can(staff.role, "programs.pricing"), override: can(staff.role, "pricing.override"), publish: can(staff.role, "programs.publish"), costs }}
        />
      ) : (
        <p className="rounded-2xl bg-white p-6 text-sm text-muted ring-1 ring-line">
          لديك صلاحية الاطلاع فقط. استخدم «معاينة» لرؤية البرنامج كما يراه المسافر، أو خيارات التصدير أعلاه.
        </p>
      )}
    </>
  );
}
