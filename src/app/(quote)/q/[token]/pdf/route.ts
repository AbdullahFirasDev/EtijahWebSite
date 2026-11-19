import { basePath, pdfResponse, pdfUnavailable, renderOrigin, renderPdf } from "@/server/pdf";
import { col } from "@/server/db";
import { resolveQuoteAccess } from "@/server/quote-access";
import { addQuoteEvent, buildQuoteView } from "@/server/repo/quotes";
import { rateLimit, requestMeta, sha256 } from "@/server/security";

// Bump when the print layout changes, so cached PDFs are regenerated.
const LAYOUT_VERSION = "5";

/** Quote PDF: rendered from the print page by headless Chromium, cached per quote version. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await resolveQuoteAccess(token);
  if (!access || access.mode === "render") return new Response("Not found", { status: 404 });
  const q = access.quote;

  const meta = await requestMeta();
  if (!(await rateLimit("quote-pdf", `${meta.ipHash}:${q._id}`, 20, 600))) return new Response("Too many requests", { status: 429 });

  // Anything that changes the document changes the cache key (quote, hotels, company identity, settings).
  const hotels = await (await col<{ _id: number; updated_at: string }>("hotels")).find({ _id: { $in: q.hotels.map((h) => h.hotel_id) } }, { projection: { updated_at: 1 } }).sort({ _id: 1 }).toArray();
  const company = q.company_id ? await (await col<{ _id: number; updated_at: string }>("companies")).findOne({ _id: q.company_id }, { projection: { updated_at: 1 } }) : null;
  const view = await buildQuoteView(q);
  const cacheKey = `${q._id}-${sha256([q.updated_at, q.status, q.token, hotels.map((h) => h.updated_at).join("|"), company?.updated_at ?? "", JSON.stringify(view.brand), view.footerNote ?? "", String(view.showHotelPhotos), LAYOUT_VERSION].join("#")).slice(0, 20)}`;

  const origin = renderOrigin(request);
  if (!origin) return new Response("PDF rendering needs NEXT_PUBLIC_SITE_URL.", { status: 503 });
  let pdf: Buffer;
  try {
    pdf = await renderPdf({
      resource: `quote:${q._id}`,
      url: `${origin}${basePath()}/q/${q.token}/print/`,
      cacheKey,
      locale: q.locale,
      ref: q.ref,
      footer: { name: view.brand.name, contact: view.brand.contactLines[0] ?? null },
    });
  } catch (error) {
    console.error("[quote pdf]", error);
    return pdfUnavailable(q.locale);
  }

  if (access.mode === "client") await addQuoteEvent(q._id, "pdf_downloaded", { label: "client" });
  const prefix = view.brand.kind === "company" ? view.brand.name.replace(/\s+/g, "-").slice(0, 40) : "Etijah";
  return pdfResponse(pdf, `${prefix}-${q.ref}.pdf`, request);
}
