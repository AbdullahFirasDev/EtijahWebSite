import { FilePlus2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanyEditor, ContactsManager } from "@/components/staff/CompanyEditor";
import { QuoteStatusBadge } from "@/components/staff/StatusBadge";
import { Card, CardHeader, EmptyState, LinkButton, PageHeader, Table } from "@/components/staff/ui";
import { formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { companyContacts, getCompany } from "@/server/repo/companies";
import { listQuotes } from "@/server/repo/quotes";

export const metadata = { title: "الشركة" };

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffPage("b2b.manage");
  const company = getCompany(Number((await params).id));
  if (!company) notFound();
  const contacts = companyContacts(company.id);
  const quotes = listQuotes({ companyId: company.id });

  return (
    <>
      <PageHeader
        title={company.name}
        description={company.industry ?? undefined}
        back={{ href: "/staff/companies/", label: "الشركات" }}
        actions={
          <LinkButton href={`/staff/quotes/new/?company=${company.id}`} variant="accent">
            <FilePlus2 className="size-4" aria-hidden="true" /> عرض سعر جديد
          </LinkButton>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="grid content-start gap-6">
          <CompanyEditor key={company.updated_at} canDelete={can(staff.role, "b2b.delete")} initial={company} />
          <Card>
            <CardHeader title="سجل عروض الأسعار" description="كل العروض المرسلة لهذه الشركة وحالتها." />
            {quotes.length ? (
              <Table label="عروض الشركة">
                <thead>
                  <tr>
                    <th>الرقم</th>
                    <th>العنوان</th>
                    <th>الحالة</th>
                    <th>الإجمالي</th>
                    <th>أُنشئ</th>
                    <th>أُرسل</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => (
                    <tr key={q.id}>
                      <td>
                        <Link href={`/staff/quotes/${q.id}/`} prefetch={false} className="num font-bold text-brand-700 hover:underline">
                          {q.ref}
                        </Link>
                      </td>
                      <td className="max-w-[14rem] truncate">{q.title}</td>
                      <td>
                        <QuoteStatusBadge status={q.status} />
                      </td>
                      <td className="num whitespace-nowrap">{formatMoney(q.total, q.currency, "ar")}</td>
                      <td className="text-xs whitespace-nowrap">{formatDay(q.created_at.slice(0, 10), "ar")}</td>
                      <td className="text-xs whitespace-nowrap">{q.sent_at ? formatDay(q.sent_at.slice(0, 10), "ar") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState title="لم تُرسل عروض بعد" action={<LinkButton href={`/staff/quotes/new/?company=${company.id}`} variant="primary">إنشاء أول عرض</LinkButton>} />
            )}
          </Card>
        </div>
        <div className="content-start">
          <ContactsManager companyId={company.id} contacts={contacts.map((c) => ({ ...c, is_primary: !!c.is_primary }))} />
        </div>
      </div>
    </>
  );
}
