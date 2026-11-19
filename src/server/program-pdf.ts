import "server-only";
import { cookies } from "next/headers";
import { site } from "@/content/site";
import { can } from "@/lib/permissions";
import { getStaff } from "./auth/session";
import { col } from "./db";
import { basePath, pdfResponse, pdfUnavailable, RENDER_COOKIE, renderOrigin, renderPdf, verifyRenderCookie } from "./pdf";
import { getProgramDoc } from "./repo/programs";
import { rateLimit, requestMeta, sha256 } from "./security";

const LAYOUT_VERSION = "1";

/** Staff (any status) or the PDF renderer (signed cookie for this program) may open the print page. */
export async function canOpenProgramPrint(id: number) {
  const staff = await getStaff();
  if (staff && can(staff.role, "programs.view")) return true;
  return verifyRenderCookie(`program:${id}`, (await cookies()).get(RENDER_COOKIE)?.value);
}

/** Renders a program's A4 page to PDF (cached per program version, hotels and language). */
export async function programPdfResponse(request: Request, programId: number, locale: "ar" | "en") {
  const p = await getProgramDoc(programId);
  if (!p) return new Response("Not found", { status: 404 });
  const meta = await requestMeta();
  if (!(await rateLimit("program-pdf", `${meta.ipHash}:${p._id}`, 20, 600))) return new Response("Too many requests", { status: 429 });
  const hotels = await (await col<{ _id: number; updated_at: string }>("hotels")).find({ _id: { $in: p.hotel_options.map((o) => o.hotel_id) } }, { projection: { updated_at: 1 } }).toArray();
  const deps = await (await col<{ _id: number; updated_at: string }>("departures")).find({ program_id: p._id }, { projection: { updated_at: 1 } }).toArray();
  const cacheKey = `p${p._id}${locale}-${sha256([p.updated_at, p.status, ...hotels.map((h) => h.updated_at), ...deps.map((d) => d.updated_at), LAYOUT_VERSION].join("#")).slice(0, 20)}`;
  const origin = renderOrigin(request);
  if (!origin) return new Response("PDF rendering needs NEXT_PUBLIC_SITE_URL.", { status: 503 });
  try {
    const pdf = await renderPdf({ resource: `program:${p._id}`, url: `${origin}${basePath()}/print/program/${p._id}/?lang=${locale}`, cacheKey, locale, ref: p.code });
    return pdfResponse(pdf, `${locale === "ar" ? "Etijah" : "Etijah"}-${p.code}-${p.slug}.pdf`, request);
  } catch (error) {
    console.error("[program pdf]", error);
    return pdfUnavailable(locale);
  }
}

export const shareUrlFor = (token: string, locale: "ar" | "en") => (site.url ? `${site.url}${locale === "en" ? "/en" : ""}/p/${token}/` : null);
