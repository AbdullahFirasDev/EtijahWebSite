import { FilePlus2, FileText } from "lucide-react";
import Link from "next/link";
import { QuoteStatusBadge } from "@/components/staff/StatusBadge";
import { Card, EmptyState, Input, LinkButton, PageHeader, Select, Table } from "@/components/staff/ui";
import { formatDay, timeAgo } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { QUOTE_STATUS_LABELS, QUOTE_STATUSES } from "@/lib/travel-labels";
import { requireStaffPage } from "@/server/auth/session";
import { listQuotes } from "@/server/repo/quotes";

export const metadata = { title: "عروض الأسعار" };

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; audience?: string }> }) {
  await requireStaffPage("quotes.manage");
  const sp = await searchParams;
  const status = sp.status === "open" || QUOTE_STATUSES.includes(sp.status as never) ? sp.status : undefined;
  const audience = sp.audience === "company" || sp.audience === "traveler" ? sp.audience : undefined;
  const quotes = await listQuotes({ status, q: sp.q?.slice(0, 80), audience });

  return (
    <>
      <PageHeader
        title={status === "open" ? "العروض المرسلة (بانتظار الرد)" : "عروض الأسعار"}
        description="عروض للشركات بهويتها البصرية، وعروض مخصصة للمسافرين، مع رابط آمن وملف PDF وسجل كامل للإرسال والمشاهدة والرد."
        actions={
          <LinkButton href="/staff/quotes/new/" variant="accent">
            <FilePlus2 className="size-4" aria-hidden="true" /> عرض سعر جديد
          </LinkButton>
        }
      />
      <Card>
        <form className="flex flex-wrap gap-2 border-b border-line p-4" role="search">
          <Input name="q" defaultValue={sp.q} placeholder="الرقم، العنوان، أو الشركة…" aria-label="بحث" className="max-w-xs" />
          <Select name="status" defaultValue={status ?? ""} aria-label="الحالة" className="w-48">
            <option value="">كل الحالات</option>
            <option value="open">بانتظار الرد</option>
            {QUOTE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {QUOTE_STATUS_LABELS[s].ar}
              </option>
            ))}
          </Select>
          <Select name="audience" defaultValue={audience ?? ""} aria-label="المستلم" className="w-44">
            <option value="">كل المستلمين</option>
            <option value="company">الشركات</option>
            <option value="traveler">المسافرون</option>
          </Select>
          <button className="rounded-xl bg-brand-50 px-4 text-sm font-bold text-brand-700 hover:bg-brand-100">تصفية</button>
        </form>
        {quotes.length ? (
          <Table label="عروض الأسعار">
            <thead>
              <tr>
                <th>الرقم</th>
                <th>المستلم</th>
                <th>العرض</th>
                <th>الإجمالي</th>
                <th>الحالة</th>
                <th>صالح حتى</th>
                <th>المشاهدات</th>
                <th>آخر تحديث</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id}>
                  <td>
                    <Link href={`/staff/quotes/${q.id}/`} prefetch={false} className="num font-bold text-brand-700 hover:underline">
                      {q.ref}
                    </Link>
                    <p className="text-xs text-muted">{q.audience === "company" ? "شركة" : "مسافر"}</p>
                  </td>
                  <td className="font-bold text-brand-950">{q.recipient}</td>
                  <td className="max-w-[16rem] truncate">{q.title}</td>
                  <td className="num font-bold whitespace-nowrap">{formatMoney(q.total, q.currency, "ar")}</td>
                  <td>
                    <QuoteStatusBadge status={q.status} />
                  </td>
                  <td className="text-xs whitespace-nowrap">{formatDay(q.valid_until, "ar")}</td>
                  <td className="num">{q.view_count}</td>
                  <td className="text-xs whitespace-nowrap text-muted">
                    {timeAgo(q.updated_at)}
                    {q.owner ? <span className="block">{q.owner}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={<FileText className="size-6" />} title="لا توجد عروض" text="أنشئ عرض سعر مخصصاً لشركة، ثم شاركه برابط آمن أو ملف PDF." action={<LinkButton href="/staff/quotes/new/" variant="primary">إنشاء عرض</LinkButton>} />
        )}
      </Card>
    </>
  );
}
