import { notFound } from "next/navigation";
import { QuoteWebView } from "@/components/quote/QuoteWebView";
import { resolveQuoteAccess } from "@/server/quote-access";
import { buildQuoteView } from "@/server/repo/quotes";

export const dynamic = "force-dynamic";

export default async function QuotePage({ params }: PageProps<"/q/[token]">) {
  const { token } = await params;
  const access = await resolveQuoteAccess(token);
  // Unknown, draft, revoked or expired links all look the same: not found.
  if (!access || access.mode === "render") notFound();
  return <QuoteWebView q={await buildQuoteView(access.quote)} token={token} mode={access.mode} editorHref={access.mode === "staff" ? `/staff/quotes/${access.quote._id}/` : undefined} />;
}
