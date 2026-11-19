import "server-only";
import { cookies } from "next/headers";
import { can } from "@/lib/permissions";
import { getCompanyUser, getStaff } from "./auth/session";
import { RENDER_COOKIE, verifyRenderCookie } from "./pdf";
import { clientLinkOpen, getQuoteByToken, type QuoteDoc } from "./repo/quotes";

export type QuoteAccessMode = "client" | "staff" | "render";

/**
 * Who may open /q/<token>:
 *  - staff with quote access: always (preview; views are not counted, responses disabled)
 *  - the PDF renderer: with a short-lived signed cookie bound to this quote
 *  - anyone holding the link: only once sent, while the link is neither revoked nor expired
 */
export async function resolveQuoteAccess(token: string): Promise<{ quote: QuoteDoc; mode: QuoteAccessMode } | null> {
  const quote = await getQuoteByToken(token);
  if (!quote) return null;
  const staff = await getStaff();
  if (staff && can(staff.role, "quotes.manage")) return { quote, mode: "staff" };
  if (await verifyRenderCookie(`quote:${quote._id}`, (await cookies()).get(RENDER_COOKIE)?.value)) return { quote, mode: "render" };
  if (clientLinkOpen(quote)) return { quote, mode: "client" };
  // A signed-in partner user may always open their own company's sent quotes.
  const cu = await getCompanyUser();
  if (cu && quote.company_id === cu.companyId && quote.status !== "draft") return { quote, mode: "client" };
  return null;
}
