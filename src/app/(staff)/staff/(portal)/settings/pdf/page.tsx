import { Eye } from "lucide-react";
import Link from "next/link";
import { ProfileSettings } from "@/components/staff/ProfileSettings";
import { Card, CardHeader, PageHeader } from "@/components/staff/ui";
import { asset } from "@/lib/asset";
import { requireStaffPage } from "@/server/auth/session";
import { listCompanies } from "@/server/repo/companies";
import { getSettings } from "@/server/repo/settings";

export const metadata = { title: "قوالب PDF" };

export default async function PdfTemplatesPage() {
  await requireStaffPage("settings.manage");
  const [s, companies] = await Promise.all([getSettings(), listCompanies()]);
  return (
    <>
      <PageHeader title="قوالب PDF" description="قالب موحد لعروض الأسعار وملفات البرامج. يتغير فقط الشعار والألوان والاسم وبيانات التواصل حسب الجهة المصدرة." />
      <div className="grid gap-6">
        <ProfileSettings section="pdf" initial={{ ...s }} />
        <Card>
          <CardHeader title="معاينة القالب" description="صفحة نموذجية معلّمة بوضوح كنموذج؛ لا تُرسل لأحد." />
          <div className="flex flex-wrap gap-2 p-5">
            {(["ar", "en"] as const).map((l) => (
              <a key={l} href={asset(`/print/brand-sample/?lang=${l}`)} target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-50 px-4 text-sm font-bold text-brand-800 hover:bg-brand-100">
                <Eye className="size-4" aria-hidden="true" /> هوية الاتجاه ({l === "ar" ? "عربي" : "English"})
              </a>
            ))}
            {companies.slice(0, 12).map((c) => (
              <a key={c.id} href={asset(`/print/brand-sample/?company=${c.id}`)} target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line px-4 text-sm font-bold text-brand-900 hover:bg-brand-50">
                <span className="size-3 rounded-full" style={{ background: c.branding.primary_color }} aria-hidden="true" /> {c.name}
              </a>
            ))}
            <Link href="/staff/branding/" prefetch={false} className="inline-flex h-10 items-center px-2 text-sm font-bold text-brand-600 hover:underline">
              كل هويات الشركات
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
