import { Building2, Plus } from "lucide-react";
import Link from "next/link";
import { Card, EmptyState, Input, LinkButton, PageHeader, Table } from "@/components/staff/ui";
import { timeAgo } from "@/lib/dates";
import { requireStaffPage } from "@/server/auth/session";
import { listCompanies } from "@/server/repo/companies";

export const metadata = { title: "الشركات" };

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaffPage("b2b.manage");
  const { q } = await searchParams;
  const companies = listCompanies(q?.slice(0, 80));
  return (
    <>
      <PageHeader
        title="الشركات وجهات الاتصال"
        description="العملاء من الشركات والمؤسسات، جهات الاتصال فيها، وسجل عروض الأسعار المرسلة إليها. بيانات خاصة لا تظهر في الموقع."
        actions={
          <LinkButton href="/staff/companies/new/" variant="primary">
            <Plus className="size-4" aria-hidden="true" /> شركة جديدة
          </LinkButton>
        }
      />
      <Card>
        <form className="flex gap-2 border-b border-line p-4" role="search">
          <Input name="q" defaultValue={q} placeholder="ابحث باسم الشركة أو القطاع…" aria-label="بحث" className="max-w-sm" />
          <button className="rounded-xl bg-brand-50 px-4 text-sm font-bold text-brand-700 hover:bg-brand-100">بحث</button>
        </form>
        {companies.length ? (
          <Table label="الشركات">
            <thead>
              <tr>
                <th>الشركة</th>
                <th>القطاع</th>
                <th>المدينة</th>
                <th>جهات الاتصال</th>
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
                  <td>{c.industry ?? "—"}</td>
                  <td>{c.city ?? "—"}</td>
                  <td className="num">{c.contacts}</td>
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
