import { Building2, Plus } from "lucide-react";
import Link from "next/link";
import { Badge, Card, EmptyState, Input, LinkButton, PageHeader, Table } from "@/components/staff/ui";
import { can } from "@/lib/permissions";
import { timeAgo } from "@/lib/dates";
import { requireStaffPage } from "@/server/auth/session";
import { listCompanies } from "@/server/repo/companies";

export const metadata = { title: "الشركات" };

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ q?: string; archived?: string }> }) {
  const staff = await requireStaffPage("b2b.view");
  const { q, archived } = await searchParams;
  const companies = await listCompanies({ q: q?.slice(0, 80), includeArchived: archived === "1" });
  const canManage = can(staff.role, "b2b.manage");
  return (
    <>
      <PageHeader
        title="الشركات B2B"
        description="الشركات التي نتعامل معها: الهوية البصرية لملفاتها، جهات الاتصال، حسابات البوابة، الفنادق والأسعار المخصصة، العمولات وسجل العروض."
        actions={
          canManage ? (
            <LinkButton href="/staff/companies/new/" variant="primary">
              <Plus className="size-4" aria-hidden="true" /> شركة جديدة
            </LinkButton>
          ) : null
        }
      />
      <Card>
        <form className="flex gap-2 border-b border-line p-4" role="search">
          <Input name="q" defaultValue={q} placeholder="ابحث باسم الشركة أو القطاع…" aria-label="بحث" className="max-w-sm" />
          <label className="inline-flex items-center gap-2 text-sm font-bold text-muted">
            <input type="checkbox" name="archived" value="1" defaultChecked={archived === "1"} className="size-4 accent-brand-600" /> المؤرشفة
          </label>
          <button className="rounded-xl bg-brand-50 px-4 text-sm font-bold text-brand-700 hover:bg-brand-100">بحث</button>
        </form>
        {companies.length ? (
          <Table label="الشركات">
            <thead>
              <tr>
                <th>الشركة</th>
                <th>المدينة</th>
                <th>البوابة</th>
                <th>المستخدمون</th>
                <th>الفنادق</th>
                <th>العروض</th>
                <th>المقبولة</th>
                <th>آخر عرض</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/staff/companies/${c.id}/`} prefetch={false} className="font-bold text-brand-950 hover:underline">
                      {c.name}
                    </Link>
                    {c.name_en ? (
                      <p className="text-xs text-muted" dir="ltr">
                        {c.name_en}
                      </p>
                    ) : null}
                  </td>
                  <td>{c.city ?? "—"}</td>
                  <td>{c.status === "archived" ? <Badge tone="muted">مؤرشفة</Badge> : c.portal.enabled ? <Badge tone="success">مفعّلة</Badge> : <Badge tone="neutral">غير مفعّلة</Badge>}</td>
                  <td className="num">{c.users}</td>
                  <td className="num">{c.hotels}</td>
                  <td className="num">{c.quotes}</td>
                  <td className="num">{c.accepted}</td>
                  <td className="text-xs text-muted">{c.last_quote ? timeAgo(c.last_quote) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<Building2 className="size-6" />} title={q ? "لا توجد نتائج" : "لا توجد شركات بعد"} action={!q ? <LinkButton href="/staff/companies/new/" variant="primary">إضافة شركة</LinkButton> : undefined} />
        )}
      </Card>
    </>
  );
}
