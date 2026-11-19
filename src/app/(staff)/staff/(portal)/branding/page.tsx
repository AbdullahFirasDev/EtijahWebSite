import { Eye, Palette } from "lucide-react";
import Link from "next/link";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/staff/ui";
import { asset } from "@/lib/asset";
import { mediaSrc } from "@/lib/media";
import { requireStaffPage } from "@/server/auth/session";
import { mediaByIds } from "@/server/media";
import { listCompanies } from "@/server/repo/companies";
import { listQuotes } from "@/server/repo/quotes";

export const metadata = { title: "ملفات PDF للشركات" };

/** Each partner's identity on the unified PDF template, with previews and their branded quotes. */
export default async function BrandingPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  await requireStaffPage("b2b.view");
  const focus = Number((await searchParams).company) || null;
  const companies = (await listCompanies()).filter((c) => !focus || c.id === focus);
  const logos = await mediaByIds(companies.map((c) => c.branding?.logo_media_id));
  const quotes = await listQuotes({ audience: "company" });

  return (
    <>
      <PageHeader
        title="ملفات PDF الخاصة بالشركات"
        description="قالب واحد موحد لكل الشركات. يتغير تلقائياً: الشعار، الألوان، اسم الشركة، بيانات التواصل، الجهة المستفيدة ورقم العرض. لا تظهر أسعار الفنادق الداخلية أو التكاليف أو الأرباح."
        actions={
          <a href={asset("/print/brand-sample/")} target="_blank" rel="noopener" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 font-bold text-brand-900 hover:bg-brand-50">
            <Eye className="size-4" aria-hidden="true" /> قالب الاتجاه
          </a>
        }
      />
      {companies.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {companies.map((c) => {
            const logo = c.branding?.logo_media_id ? logos.get(c.branding.logo_media_id) : null;
            const own = quotes.filter((q) => q.company_id === c.id).slice(0, 5);
            return (
              <Card key={c.id}>
                <div className="flex items-center justify-between gap-3 rounded-t-2xl px-5 py-4" style={{ background: c.branding.primary_color, color: "#fff" }}>
                  <div className="flex items-center gap-3">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaSrc(logo, 480)} alt="" className="h-10 w-auto rounded bg-white/95 p-1" />
                    ) : null}
                    <span className="text-lg font-black">{c.branding.display_name || c.name}</span>
                  </div>
                  <span className="rounded-full px-3 py-1 text-xs font-extrabold" style={{ background: c.branding.secondary_color, color: "#051c33" }}>
                    عرض سعر
                  </span>
                </div>
                <CardHeader
                  title={c.name}
                  description={c.branding.contact_line || [c.phone, c.email].filter(Boolean).join(" · ") || "لا توجد بيانات تواصل للملفات"}
                  actions={
                    <>
                      {!logo ? <Badge tone="accent">بلا شعار</Badge> : null}
                      <a href={asset(`/print/brand-sample/?company=${c.id}`)} target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-50 px-3 text-sm font-bold text-brand-800 hover:bg-brand-100" data-brand-preview={c.id}>
                        <Eye className="size-4" aria-hidden="true" /> معاينة القالب
                      </a>
                      <Link href={`/staff/companies/${c.id}/`} prefetch={false} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-brand-700 hover:bg-brand-50">
                        <Palette className="size-4" aria-hidden="true" /> تعديل الهوية
                      </Link>
                    </>
                  }
                />
                {own.length ? (
                  <ul className="divide-y divide-line text-sm">
                    {own.map((q) => (
                      <li key={q.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                        <Link href={`/staff/quotes/${q.id}/`} prefetch={false} className="font-bold text-brand-700 hover:underline">
                          <span className="num">{q.ref}</span> — {q.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 pb-4 text-sm text-muted">لا توجد عروض لهذه الشركة بعد.</p>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<Palette className="size-6" />} title="لا توجد شركات" />
      )}
    </>
  );
}
