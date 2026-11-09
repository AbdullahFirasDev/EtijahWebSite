import { featuredPrograms } from "@/server/repo/programs";

export const dynamic = "force-dynamic";

/**
 * Featured published offers for the home page strip. Public data only (the same fields the
 * public offers page shows); no drafts, no company or pricing internals.
 */
export function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") === "en" ? "en" : "ar";
  let cards: ReturnType<typeof featuredPrograms> = [];
  try {
    cards = featuredPrograms(locale, 3);
  } catch (error) {
    console.error("[featured programs]", error);
  }
  return Response.json({ cards }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
