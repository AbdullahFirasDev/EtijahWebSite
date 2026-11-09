import { site } from "@/content/site";
import { all } from "@/server/db";
import { renderQuotePdf } from "@/server/pdf";
import { resolveQuoteAccess } from "@/server/quote-access";
import { addQuoteEvent } from "@/server/repo/quotes";
import { rateLimit, requestMeta, sha256 } from "@/server/security";

// Bump when the print layout changes, so cached PDFs are regenerated.
const LAYOUT_VERSION = "4";

const PRIVATE_HOST = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

/**
 * Where the headless browser loads the print page. Never trusts an arbitrary Host header
 * (that would let a client point the server's browser at any site): PDF_RENDER_ORIGIN, the
 * request origin when it is the public site or a local/private address, else the public site.
 */
function renderOrigin(request: Request): string | null {
  if (process.env.PDF_RENDER_ORIGIN) return process.env.PDF_RENDER_ORIGIN.replace(/\/$/, "");
  const requested = new URL(request.url);
  const publicOrigin = site.url ? new URL(site.url).origin : null;
  if (requested.origin === publicOrigin || PRIVATE_HOST.test(requested.hostname)) return requested.origin;
  return publicOrigin;
}

/** Quote PDF: rendered from the print page by headless Chromium, cached per quote version. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await resolveQuoteAccess(token);
  if (!access || access.mode === "render") return new Response("Not found", { status: 404 });
  const q = access.quote;

  const meta = await requestMeta();
  if (!rateLimit("quote-pdf", `${meta.ipHash}:${q.id}`, 20, 600)) return new Response("Too many requests", { status: 429 });

  // Anything that changes the document changes the cache key (quote, hotels, media).
  const hotelsStamp = all<{ updated_at: string }>(
    "SELECT h.updated_at FROM quote_hotels qh JOIN hotels h ON h.id = qh.hotel_id WHERE qh.quote_id = ? ORDER BY h.id",
    q.id,
  )
    .map((h) => h.updated_at)
    .join("|");
  const cacheKey = `${q.id}-${sha256([q.updated_at, q.status, q.token, hotelsStamp, LAYOUT_VERSION].join("#")).slice(0, 20)}`;

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const origin = renderOrigin(request);
  if (!origin) return new Response("PDF rendering needs NEXT_PUBLIC_SITE_URL or PDF_RENDER_ORIGIN.", { status: 503 });
  let pdf: Buffer;
  try {
    pdf = await renderQuotePdf({ quoteId: q.id, url: `${origin}${basePath}/q/${q.token}/print/`, cacheKey, locale: q.locale, ref: q.ref });
  } catch (error) {
    console.error("[quote pdf]", error);
    const msg =
      q.locale === "ar"
        ? "تعذّر إنشاء ملف PDF حالياً. يمكنك استخدام «طباعة ← حفظ كـ PDF» من صفحة المعاينة."
        : "The PDF could not be generated right now. You can use Print → Save as PDF from the preview page.";
    return new Response(msg, { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  if (access.mode === "client") addQuoteEvent(q.id, "pdf_downloaded", { label: "client" });

  const inline = new URL(request.url).searchParams.has("inline");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="Etijah-${q.ref}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
}
