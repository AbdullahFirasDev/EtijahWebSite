import "server-only";
import { cookies } from "next/headers";
import { can } from "@/lib/permissions";
import { getStaff } from "./auth/session";
import { RENDER_COOKIE, verifyRenderCookie } from "./pdf";
import { clientLinkOpen, getQuoteByToken, type QuoteRow } from "./repo/quotes";

export type QuoteAccessMode = "client" | "staff" | "render";

/**
 * Who may open /q/<token>:
 *  - staff with B2B access: always (preview; views are not counted, responses disabled)
 *  - the PDF renderer: with a short-lived signed cookie
 *  - anyone holding the link: only once sent, while the link is neither revoked nor expired
 */
export async function resolveQuoteAccess(token: string): Promise<{ quote: QuoteRow; mode: QuoteAccessMode } | null> {
  const quote = getQuoteByToken(token);
  if (!quote) return null;
  const staff = await getStaff();
  if (staff && can(staff.role, "b2b.manage")) return { quote, mode: "staff" };
  if (verifyRenderCookie(quote.id, (await cookies()).get(RENDER_COOKIE)?.value)) return { quote, mode: "render" };
  if (clientLinkOpen(quote)) return { quote, mode: "client" };
  return null;
}
