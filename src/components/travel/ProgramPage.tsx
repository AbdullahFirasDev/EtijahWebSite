import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ar } from "@/content/ar";
import { en } from "@/content/en";
import type { Locale } from "@/content/site";
import { mediaUrl } from "@/lib/media";
import { travelPageMetadata } from "@/lib/seo";
import { asset } from "@/lib/asset";
import { getPublicProgram, relatedPrograms } from "@/server/repo/programs";
import { ProgramDetailView } from "./ProgramDetailView";
import { TravelShell } from "./TravelShell";

export async function programMetadata(locale: Locale, slug: string): Promise<Metadata> {
  const p = await getPublicProgram(slug, locale);
  if (!p) return { title: locale === "ar" ? "العرض غير متاح" : "Offer not available", robots: { index: false } };
  return travelPageMetadata({
    locale,
    title: p.title,
    description: p.summary ?? p.description?.slice(0, 160) ?? p.title,
    path: `/programs/${p.slug}/`,
    image: p.cover ? mediaUrl(p.cover.id, p.cover.widths.at(-1)!) : null,
  });
}

export async function ProgramPage({ locale, slug, departure }: { locale: Locale; slug: string; departure?: string }) {
  const p = await getPublicProgram(slug, locale);
  if (!p) notFound();
  const initial = departure && /^\d+$/.test(departure) ? Number(departure) : null;
  const related = await relatedPrograms(p, locale);
  const pdfHref = p.shareToken ? asset(`${locale === "en" ? "/en" : ""}/p/${p.shareToken}/pdf/`) : null;
  return (
    <TravelShell dict={locale === "ar" ? ar : en} languageHref={locale === "ar" ? `/en/programs/${p.slug}/` : `/programs/${p.slug}/`} floating={false}>
      <ProgramDetailView p={p} locale={locale} related={related} initialDeparture={initial} pdfHref={pdfHref} />
    </TravelShell>
  );
}
