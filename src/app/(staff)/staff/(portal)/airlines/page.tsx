import { Plane, Plus } from "lucide-react";
import Link from "next/link";
import { Badge, Card, EmptyState, Input, LinkButton, PageHeader, Table } from "@/components/staff/ui";
import { COMMISSION_KIND_LABELS, ruleLabel } from "@/lib/commission-math";
import { countryName } from "@/lib/countries";
import { mediaSrc } from "@/lib/media";
import { can } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { mediaByIds } from "@/server/media";
import { AIRLINE_STATUS_LABELS, ISSUE_METHOD_LABELS, listAirlines } from "@/server/repo/airlines";

export const metadata = { title: "شركات الطيران" };

export default async function AirlinesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const staff = await requireStaffPage("airlines.view");
  const { q } = await searchParams;
  const airlines = await listAirlines({ q: q?.slice(0, 60) });
  const logos = await mediaByIds(airlines.map((a) => a.logo_media_id));
  const canEdit = can(staff.role, "airlines.edit");
  const seeCommission = can(staff.role, "commissions.manage") || can(staff.role, "reports.finance");

  return (
    <>
      <PageHeader
        title="شركات الطيران"
        description="القائمة المركزية لشركات الطيران التي نتعامل معها: ملف كل شركة، آلية إصدار تذاكرها، وعمولتنا منها."
        actions={
          canEdit ? (
            <LinkButton href="/staff/airlines/new/" variant="primary">
              <Plus className="size-4" aria-hidden="true" /> شركة طيران جديدة
            </LinkButton>
          ) : null
        }
      />
      <Card>
        <form className="flex gap-2 border-b border-line p-4" role="search">
          <Input name="q" defaultValue={q} placeholder="الاسم أو رمز IATA…" aria-label="بحث" className="max-w-sm" />
          <button className="rounded-xl bg-brand-50 px-4 text-sm font-bold text-brand-700 hover:bg-brand-100">بحث</button>
        </form>
        {airlines.length ? (
          <Table label="شركات الطيران">
            <thead>
              <tr>
                <th>شركة الطيران</th>
                <th>IATA</th>
                <th>البلد</th>
                <th>آلية الإصدار</th>
                {seeCommission ? <th>عمولتنا الحالية</th> : null}
                <th>التذاكر</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {airlines.map((a) => {
                const logo = a.logo_media_id ? logos.get(a.logo_media_id) : null;
                return (
                  <tr key={a.id} data-airline-row={a.iata ?? a.id}>
                    <td>
                      <Link href={`/staff/airlines/${a.id}/`} prefetch={false} className="flex items-center gap-3">
                        {logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mediaSrc(logo, 480)} alt="" className="h-9 w-14 rounded bg-white object-contain ring-1 ring-line" />
                        ) : (
                          <span className="grid h-9 w-14 place-items-center rounded bg-mist text-muted">
                            <Plane className="size-4" aria-hidden="true" />
                          </span>
                        )}
                        <span>
                          <span className="block font-bold text-brand-950 hover:underline">{a.name_ar}</span>
                          <span className="block text-xs text-muted" dir="ltr">
                            {a.name_en}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="num font-bold">{a.iata ?? "—"}</td>
                    <td>{a.country_code ? countryName(a.country_code, "ar") : "—"}</td>
                    <td>{ISSUE_METHOD_LABELS[a.issuance.method]}</td>
                    {seeCommission ? (
                      <td>
                        {a.our_rule ? (
                          <Badge tone={a.our_rule.kind === "commission" ? "success" : "neutral"}>{a.our_rule.kind === "commission" ? ruleLabel(a.our_rule) : COMMISSION_KIND_LABELS[a.our_rule.kind]}</Badge>
                        ) : (
                          <span className="text-xs text-accent-700">غير محددة</span>
                        )}
                      </td>
                    ) : null}
                    <td className="num">{a.tickets}</td>
                    <td>
                      <Badge tone={a.status === "active" ? "success" : a.status === "suspended" ? "danger" : "muted"}>{AIRLINE_STATUS_LABELS[a.status]}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState
            icon={<Plane className="size-6" />}
            title={q ? "لا توجد نتائج" : "لا توجد شركات طيران بعد"}
            text="أضف شركات الطيران التي تتعامل معها، ثم حدد آلية الإصدار والعمولات."
            action={canEdit && !q ? <LinkButton href="/staff/airlines/new/" variant="primary">إضافة شركة طيران</LinkButton> : undefined}
          />
        )}
      </Card>
    </>
  );
}
