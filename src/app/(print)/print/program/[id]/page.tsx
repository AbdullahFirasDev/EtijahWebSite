import { notFound } from "next/navigation";
import { ProgramPrintView } from "@/components/travel/ProgramPrintView";
import { canOpenProgramPrint, shareUrlFor } from "@/server/program-pdf";
import { getProgramPreview } from "@/server/repo/programs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Program" };

/** A4 program document: the PDF source and the on-screen PDF preview (staff or renderer only). */
export default async function ProgramPrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string }> }) {
  const id = Number((await params).id);
  const locale = (await searchParams).lang === "en" ? "en" : "ar";
  if (!Number.isInteger(id) || !(await canOpenProgramPrint(id))) notFound();
  const p = await getProgramPreview(id, locale);
  if (!p) notFound();
  return <ProgramPrintView p={p} locale={locale} url={p.shareToken ? shareUrlFor(p.shareToken, locale) : null} />;
}
