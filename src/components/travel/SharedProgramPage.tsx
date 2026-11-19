import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ar } from "@/content/ar";
import { en } from "@/content/en";
import type { Locale } from "@/content/site";
import { asset } from "@/lib/asset";
import { getSharedProgram } from "@/server/repo/programs";
import { ProgramDetailView } from "./ProgramDetailView";
import { TravelShell } from "./TravelShell";

/** Shared links are private-ish: never indexed, and the token is not leaked as a Referer. */
export async function sharedProgramMetadata(locale: Locale, token: string): Promise<Metadata> {
  const p = await getSharedProgram(token, locale);
  return {
    title: p ? p.title : locale === "ar" ? "الرابط غير متاح" : "Link not available",
    description: p?.summary ?? undefined,
    robots: { index: false, follow: false, nocache: true },
    referrer: "no-referrer",
  };
}

/**
 * The independent link of a program: details, hotel comparison, prices and the booking /
 * enquiry form. Works only while the program is published and its link is enabled; unlisted
 * programs are reachable here even though they are hidden from the public list.
 */
export async function SharedProgramPage({ locale, token }: { locale: Locale; token: string }) {
  const p = await getSharedProgram(token, locale);
  if (!p) notFound();
  return (
    <TravelShell dict={locale === "ar" ? ar : en} languageHref={locale === "ar" ? `/en/p/${token}/` : `/p/${token}/`} floating={false}>
      <ProgramDetailView p={p} locale={locale} related={[]} pdfHref={asset(`${locale === "en" ? "/en" : ""}/p/${token}/pdf/`)} />
    </TravelShell>
  );
}
