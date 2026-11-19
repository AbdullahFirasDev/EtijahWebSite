import { can } from "@/lib/permissions";
import { getStaff } from "@/server/auth/session";
import { programPdfResponse } from "@/server/program-pdf";

/** Staff download of any program's PDF (drafts included). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff || !can(staff.role, "programs.view")) return new Response("Not found", { status: 404 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return new Response("Not found", { status: 404 });
  return programPdfResponse(request, id, new URL(request.url).searchParams.get("lang") === "en" ? "en" : "ar");
}
