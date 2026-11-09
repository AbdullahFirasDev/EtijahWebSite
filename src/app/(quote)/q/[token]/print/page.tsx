import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { QuotePrintView } from "@/components/quote/QuotePrintView";
import { site } from "@/content/site";
import { asset } from "@/lib/asset";
import { resolveQuoteAccess } from "@/server/quote-access";
import { buildQuoteView } from "@/server/repo/quotes";

export const dynamic = "force-dynamic";

/** A4 print layout: the PDF source, and the on-screen "PDF preview". */
export default async function QuotePrintPage({ params }: PageProps<"/q/[token]/print">) {
  const { token } = await params;
  const access = await resolveQuoteAccess(token);
  if (!access) notFound();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = site.url ?? (host ? `${proto}://${host}` : null);
  return <QuotePrintView q={buildQuoteView(access.quote)} token={token} onlineUrl={origin ? `${origin.replace(/\/$/, "")}${site.url ? "" : asset("")}/q/${token}/` : null} showToolbar={access.mode !== "render"} />;
}
