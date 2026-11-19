import { sharedProgramPdf } from "@/server/share-routes";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  return sharedProgramPdf(request, (await params).token, "ar");
}
