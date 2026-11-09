import { Eye, MapPinned, Plus } from "lucide-react";
import Link from "next/link";
import { ProgramStatusBadge } from "@/components/staff/StatusBadge";
import { Badge, Card, EmptyState, Input, LinkButton, PageHeader, Select, Table } from "@/components/staff/ui";
import { asset } from "@/lib/asset";
import { formatDay, timeAgo } from "@/lib/dates";
import { mediaSrc } from "@/lib/media";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/permissions";
import { KIND_LABELS, PROGRAM_STATUS_LABELS, PROGRAM_STATUSES } from "@/lib/travel-labels";
import { requireStaffPage } from "@/server/auth/session";
import { mediaByIds } from "@/server/media";
import { listProgramsStaff } from "@/server/repo/programs";

export const metadata = { title: "البرامج السياحية" };

export default async function ProgramsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; kind?: string }> }) {
  const staff = await requireStaffPage("catalog.view");
  const sp = await searchParams;
  const status = PROGRAM_STATUSES.includes(sp.status as never) ? sp.status : undefined;
  const kind = sp.kind === "group" || sp.kind === "package" ? sp.kind : undefined;
  const programs = listProgramsStaff({ status, kind, q: sp.q?.slice(0, 80) });
  const media = mediaByIds(programs.map((p) => p.cover_media_id).filter((m): m is string => !!m));
  const canEdit = can(staff.role, "catalog.edit");

  return (
    <>
      <PageHeader
        title="البرامج السياحية"
        description="أنشئ البرامج والكروبات، احفظها كمسودات، ثم انشرها للمسافرين عند اكتمالها."
        actions={
          canEdit ? (
            <LinkButton href="/staff/programs/new/" variant="primary">
              <Plus className="size-4" aria-hidden="true" /> برنامج جديد
            </LinkButton>
          ) : null
        }
      />
      <Card>
        <form className="flex flex-wrap gap-2 border-b border-line p-4" role="search">
          <Input name="q" defaultValue={sp.q} placeholder="ابحث بالعنوان أو الرمز…" aria-label="بحث" className="max-w-xs" />
          <Select name="status" defaultValue={status ?? ""} aria-label="الحالة" className="w-40">
            <option value="">كل الحالات</option>
            {PROGRAM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROGRAM_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <Select name="kind" defaultValue={kind ?? ""} aria-label="النوع" className="w-40">
            <option value="">كل الأنواع</option>
            <option value="package">{KIND_LABELS.package.ar}</option>
            <option value="group">{KIND_LABELS.group.ar}</option>
          </Select>
          <button className="rounded-xl bg-brand-50 px-4 text-sm font-bold text-brand-700 hover:bg-brand-100">تصفية</button>
        </form>
        {programs.length ? (
          <Table label="البرامج">
            <thead>
              <tr>
                <th>البرنامج</th>
                <th>النوع</th>
                <th>الحالة</th>
                <th>يبدأ من</th>
                <th>أقرب موعد</th>
                <th>المشاهدات</th>
                <th>الطلبات</th>
                <th>آخر تعديل</th>
                <th className="w-0" />
              </tr>
            </thead>
            <tbody>
              {programs.map((p) => {
                const cover = p.cover_media_id ? media.get(p.cover_media_id) : null;
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={canEdit ? `/staff/programs/${p.id}/` : `/staff/preview/program/${p.id}/`} prefetch={false} className="flex items-center gap-3">
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mediaSrc(cover, 480)} alt="" className="h-12 w-16 rounded-lg object-cover" />
                        ) : (
                          <span className="grid h-12 w-16 place-items-center rounded-lg bg-mist text-muted">
                            <MapPinned className="size-5" aria-hidden="true" />
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block max-w-[18rem] truncate font-bold text-brand-950 hover:underline">{p.title_ar}</span>
                          <span className="block text-xs text-muted">
                            <span className="num">{p.code}</span> · {p.destinations ?? "بدون وجهة"} · <span className="num">{p.duration_days}</span> أيام
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td>{KIND_LABELS[p.kind].ar}</td>
                    <td>
                      <span className="flex items-center gap-1">
                        <ProgramStatusBadge status={p.status} />
                        {p.featured ? <Badge tone="accent">مميز</Badge> : null}
                      </span>
                    </td>
                    <td className="num whitespace-nowrap">{p.price_from != null ? formatMoney(p.price_from, p.currency, "ar") : "—"}</td>
                    <td className="whitespace-nowrap">{p.next_departure ? formatDay(p.next_departure, "ar") : p.kind === "package" ? "مرن" : "—"}</td>
                    <td className="num">{p.view_count}</td>
                    <td className="num">
                      {p.leads}
                      {p.new_leads ? <Badge tone="accent" className="ms-1">{p.new_leads} جديد</Badge> : null}
                    </td>
                    <td className="text-xs whitespace-nowrap text-muted">{timeAgo(p.updated_at)}</td>
                    <td>
                      {p.status === "published" ? (
                        <a href={asset(`/programs/${p.slug}/`)} target="_blank" rel="noopener" aria-label={`عرض ${p.title_ar} في الموقع`} className="grid size-9 place-items-center rounded-lg text-brand-700 hover:bg-brand-50">
                          <Eye className="size-4" aria-hidden="true" />
                        </a>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            icon={<MapPinned className="size-6" />}
            title={sp.q || status || kind ? "لا توجد برامج مطابقة" : "لا توجد برامج بعد"}
            text="ابدأ ببرنامج كامل: وجهة، فنادق، أسعار، برنامج يومي وصور، ثم انشره للمسافرين."
            action={canEdit ? <LinkButton href="/staff/programs/new/" variant="primary">إنشاء برنامج</LinkButton> : undefined}
          />
        )}
      </Card>
    </>
  );
}
