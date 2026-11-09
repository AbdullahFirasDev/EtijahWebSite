import { Eye } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProgramDetailView } from "@/components/travel/ProgramDetailView";
import { requireStaffPage } from "@/server/auth/session";
import { getProgramPreview } from "@/server/repo/programs";

export const metadata = { title: "معاينة برنامج" };
export const dynamic = "force-dynamic";

/** Staff-only preview of a program exactly as travelers will see it (drafts included). */
export default async function ProgramPreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string }> }) {
  await requireStaffPage("catalog.view");
  const id = Number((await params).id);
  const locale = (await searchParams).lang === "en" ? "en" : "ar";
  const p = getProgramPreview(id, locale);
  if (!p) notFound();
  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"} lang={locale} className="bg-mist">
      <div className="fixed inset-x-0 top-0 z-50 flex flex-wrap items-center justify-center gap-3 bg-accent-500 px-4 py-2 text-sm font-bold text-brand-950" dir="rtl">
        <Eye className="size-4" aria-hidden="true" /> معاينة للموظفين — الحجز معطّل في المعاينة.
        <Link href={`/staff/preview/program/${id}/?lang=${locale === "ar" ? "en" : "ar"}`} prefetch={false} className="underline">
          {locale === "ar" ? "English preview" : "المعاينة بالعربية"}
        </Link>
        <Link href={`/staff/programs/${id}/`} prefetch={false} className="underline">
          العودة إلى المحرر
        </Link>
      </div>
      <ProgramDetailView p={p} locale={locale} related={[]} preview />
    </div>
  );
}
