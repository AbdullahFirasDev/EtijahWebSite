import { BedDouble, FileText, Inbox } from "lucide-react";
import Link from "next/link";
import { QuoteStatusBadge } from "@/components/staff/StatusBadge";
import { Card, CardHeader, EmptyState, Stat } from "@/components/staff/ui";
import { formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { companyCan, requireCompanyPage } from "@/server/auth/session";
import { listB2bRequests, portalHotels } from "@/server/repo/b2b";
import { listCompanyQuotes } from "@/server/repo/quotes";

export const metadata = { title: "الرئيسية" };

export default async function PortalHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireCompanyPage();
  const { denied } = await searchParams;
  const [quotes, requests, hotels] = await Promise.all([
    companyCan(user, "quotes.view") ? listCompanyQuotes(user.companyId) : Promise.resolve([]),
    companyCan(user, "requests.create") ? listB2bRequests({ companyId: user.companyId }) : Promise.resolve([]),
    companyCan(user, "hotels.view") ? portalHotels(user.companyId, "ar") : Promise.resolve([]),
  ]);
  const awaiting = quotes.filter((q) => q.canRespond);
  return (
    <>
      {denied ? <p className="mb-4 rounded-xl bg-accent-50 px-4 py-3 text-sm font-bold text-accent-700">لا تملك صلاحية الوصول إلى الصفحة المطلوبة.</p> : null}
      <h1 className="text-2xl font-extrabold text-brand-950">أهلاً {user.name.split(" ")[0]}</h1>
      <p className="mt-1 text-muted">عروض الأسعار المعدّة لشركتكم، والفنادق المتاحة بأسعاركم، وطلبات البرامج.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="عروض بانتظار ردكم" value={awaiting.length} tone="accent" href={companyCan(user, "quotes.view") ? "/b2b/quotes/" : undefined} />
        <Stat label="الفنادق المتاحة" value={hotels.length} href={companyCan(user, "hotels.view") ? "/b2b/hotels/" : undefined} />
        <Stat label="طلباتنا" value={requests.length} hint={`${requests.filter((r) => r.status === "new" || r.status === "in_progress").length} قيد الإعداد`} href={companyCan(user, "requests.create") ? "/b2b/requests/" : undefined} />
      </div>
      {companyCan(user, "quotes.view") ? (
        <Card className="mt-6">
          <CardHeader title="أحدث عروض الأسعار" />
          {quotes.length ? (
            <ul role="list" className="divide-y divide-line">
              {quotes.slice(0, 6).map((q) => (
                <li key={q.id}>
                  <Link href={`/b2b/quotes/${q.id}/`} prefetch={false} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-brand-50/40" data-portal-quote={q.ref}>
                    <span>
                      <span className="block font-bold text-brand-950">{q.title}</span>
                      <span className="block text-xs text-muted">
                        <span className="num">{q.ref}</span> · صالح حتى {formatDay(q.valid_until, "ar")}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <QuoteStatusBadge status={q.status} />
                      <span className="num text-sm font-black text-brand-900">{formatMoney(q.total, q.currency, "ar")}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<FileText className="size-6" />} title="لا توجد عروض بعد" text="تظهر هنا العروض التي يعدّها فريق الاتجاه لشركتكم." />
          )}
        </Card>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        {companyCan(user, "requests.create") ? (
          <Link href="/b2b/requests/?new=1" prefetch={false} className="inline-flex h-11 items-center gap-2 rounded-xl px-5 font-bold text-white" style={{ background: "var(--pp)" }}>
            <Inbox className="size-4" aria-hidden="true" /> طلب برنامج أو عرض سعر
          </Link>
        ) : null}
        {companyCan(user, "hotels.view") ? (
          <Link href="/b2b/hotels/" prefetch={false} className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-5 font-bold text-brand-900">
            <BedDouble className="size-4" aria-hidden="true" /> تصفح الفنادق
          </Link>
        ) : null}
      </div>
    </>
  );
}
