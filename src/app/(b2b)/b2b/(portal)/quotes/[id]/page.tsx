import { Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalRespond } from "@/components/b2b/PortalForms";
import { PricingTable } from "@/components/quote/shared";
import { QuoteStatusBadge } from "@/components/staff/StatusBadge";
import { Card } from "@/components/staff/ui";
import { quoteDict } from "@/content/quote";
import { asset } from "@/lib/asset";
import { formatDay } from "@/lib/dates";
import { companyCan, requireCompanyPage } from "@/server/auth/session";
import { buildQuoteView, getCompanyQuote } from "@/server/repo/quotes";

export const metadata = { title: "عرض سعر" };

export default async function PortalQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCompanyPage("quotes.view");
  const id = Number((await params).id);
  // Only this company's sent quotes: any other id is simply "not found".
  const q = Number.isInteger(id) ? await getCompanyQuote(user.companyId, id) : null;
  if (!q) notFound();
  const view = await buildQuoteView(q);
  const t = quoteDict[q.locale];
  return (
    <>
      <Link href="/b2b/quotes/" prefetch={false} className="text-sm font-bold text-brand-600 hover:underline">
        → عروض الأسعار
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-950">{q.title}</h1>
          <p className="text-muted">
            <span className="num">{q.ref}</span> · صالح حتى {formatDay(q.valid_until, "ar")}
          </p>
        </div>
        <QuoteStatusBadge status={q.status} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={asset(`/q/${q.token}/`)} target="_blank" rel="noopener" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 font-bold text-brand-900" data-portal-open-quote>
          <ExternalLink className="size-4" aria-hidden="true" /> العرض الكامل
        </a>
        <a href={asset(`/q/${q.token}/pdf/`)} className="inline-flex h-11 items-center gap-2 rounded-xl px-4 font-bold text-white" style={{ background: "var(--pp)" }} data-portal-pdf>
          <Download className="size-4" aria-hidden="true" /> تنزيل PDF
        </a>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="p-5">
          <PricingTable q={view} t={t} />
        </Card>
        {companyCan(user, "quotes.respond") ? <PortalRespond quoteId={q._id} canRespond={view.canRespond} /> : null}
      </div>
      {q.response_note ? (
        <p className="mt-4 rounded-xl bg-white p-4 text-sm ring-1 ring-line">
          <span className="font-bold">ردّكم:</span> {q.response_note}
        </p>
      ) : null}
    </>
  );
}
