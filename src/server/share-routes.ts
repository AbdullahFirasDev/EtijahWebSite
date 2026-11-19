import "server-only";
import { programPdfResponse } from "./program-pdf";
import { programsCollection } from "./repo/programs";

/** Public PDF behind an enabled share link of a published program. */
export async function sharedProgramPdf(request: Request, token: string, locale: "ar" | "en") {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return new Response("Not found", { status: 404 });
  const p = await (await programsCollection()).findOne({ "share.token": token, "share.enabled": true, status: "published" }, { projection: { _id: 1 } });
  if (!p) return new Response("Not found", { status: 404 });
  return programPdfResponse(request, p._id, locale);
}
