import { FileText } from "lucide-react";
import Link from "next/link";
import { QuoteStatusBadge } from "@/components/staff/StatusBadge";
import { Card, EmptyState, Table } from "@/components/staff/ui";
import { formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireCompanyPage } from "@/server/auth/session";
import { listCompanyQuotes } from "@/server/repo/quotes";

export const metadata = { title: "عروض الأسعار" };

export default async function PortalQuotesPage() {
  const user = await requireCompanyPage("quotes.view");
  const quotes = await listCompanyQuotes(user.companyId);
  return (
    <>
      <h1 className="mb-6 text-2xl font-extrabold text-brand-950">عروض الأسعار</h1>
      <Card>
        {quotes.length ? (
          <Table label="عروض الأسعار">
            <thead>
              <tr>
                <th>الرقم</th>
                <th>العرض</th>
                <th>الإجمالي</th>
                <th>الحالة</th>
                <th>صالح حتى</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} data-portal-quote={q.ref}>
                  <td>
                    <Link href={`/b2b/quotes/${q.id}/`} prefetch={false} className="num font-bold text-brand-700 hover:underline">
                      {q.ref}
                    </Link>
                  </td>
                  <td>{q.title}</td>
                  <td className="num font-bold">{formatMoney(q.total, q.currency, "ar")}</td>
                  <td>
                    <QuoteStatusBadge status={q.status} />
                  </td>
                  <td className="text-xs">{formatDay(q.valid_until, "ar")}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<FileText className="size-6" />} title="لا توجد عروض بعد" />
        )}
      </Card>
    </>
  );
}
