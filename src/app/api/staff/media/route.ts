import { can } from "@/lib/permissions";
import { getStaff } from "@/server/auth/session";
import { MAX_UPLOAD_BYTES, recentMedia, storeImage, UploadError } from "@/server/media";
import { audit } from "@/server/security";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

/** Same-origin check: uploads are cookie-authenticated, so reject cross-site form posts. */
function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Staff media library (recent uploads) for the image picker. */
export async function GET(request: Request) {
  const staff = await getStaff();
  if (!staff) return json({ error: "unauthorized" }, 401);
  const kind = new URL(request.url).searchParams.get("kind");
  return json({ items: await recentMedia(80, kind === "logo" ? "logo" : kind === "photo" ? "photo" : undefined) });
}

/** Image upload (multipart/form-data, field "file"). Returns the stored media reference. */
export async function POST(request: Request) {
  const staff = await getStaff();
  if (!staff) return json({ error: "انتهت جلستك. سجّل الدخول مجدداً." }, 401);
  if (!can(staff.role, "media.upload")) return json({ error: "لا تملك صلاحية رفع الصور." }, 403);
  if (!sameOrigin(request)) return json({ error: "طلب غير مسموح." }, 403);

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) return json({ error: "حجم الصورة أكبر من 12 ميغابايت." }, 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "تعذّرت قراءة الملف." }, 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "لم يتم اختيار ملف." }, 400);

  try {
    const kind = form.get("kind") === "logo" ? "logo" : "photo";
    const media = await storeImage(Buffer.from(await file.arrayBuffer()), file.name, staff.id, kind);
    await audit(staff.id, "upload", "media", media.id, { kind });
    return json({ media });
  } catch (error) {
    if (error instanceof UploadError) return json({ error: error.message }, 422);
    console.error("[upload]", error);
    return json({ error: "تعذّر حفظ الصورة." }, 500);
  }
}
