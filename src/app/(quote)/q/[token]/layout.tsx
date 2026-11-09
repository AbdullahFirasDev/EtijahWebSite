import type { Metadata, Viewport } from "next";
import "../../../globals.css";
import { quoteDict } from "@/content/quote";
import { cairo } from "@/lib/fonts";
import { getQuoteByToken } from "@/server/repo/quotes";

export const viewport: Viewport = { themeColor: "#051c33", colorScheme: "light" };

/**
 * Private quote pages: never indexed, and the secret URL is not sent as a Referer to hotel
 * sites. Link previews only show a generic title (no company or price details).
 */
export async function generateMetadata({ params }: LayoutProps<"/q/[token]">): Promise<Metadata> {
  const q = getQuoteByToken((await params).token);
  const locale = q?.locale ?? "ar";
  return {
    title: q ? quoteDict[locale].privateTitle(q.ref) : "Etijah",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    referrer: "no-referrer",
  };
}

/** Root layout for client quote pages; language and direction follow the quote. */
export default async function QuoteLayout({ children, params }: LayoutProps<"/q/[token]">) {
  const q = getQuoteByToken((await params).token);
  const locale = q?.locale ?? "ar";
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={cairo.variable} data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
