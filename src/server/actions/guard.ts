import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { ZodType } from "zod";
import type { ActionResult } from "@/lib/action-result";
import type { Permission } from "@/lib/permissions";
import { AuthError, requireStaff, type StaffUser } from "../auth/session";
import { zodFailure } from "../validation";

/**
 * Runs a staff server action: authenticates, checks `permission`, validates `input` against
 * `schema`, and converts failures into an ActionResult. Never trust the UI: every action goes
 * through here.
 */
export async function staffAction<S extends ZodType, T>(
  permission: Permission,
  schema: S,
  input: unknown,
  fn: (data: S["_output"], staff: StaffUser) => Promise<ActionResult<T>> | ActionResult<T>,
): Promise<ActionResult<T>> {
  try {
    const staff = await requireStaff(permission);
    const parsed = schema.safeParse(input);
    if (!parsed.success) return zodFailure(parsed.error);
    return await fn(parsed.data, staff);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AuthError) return { ok: false, error: error.message };
    console.error("[staff action]", error);
    return { ok: false, error: "حدث خطأ غير متوقع أثناء الحفظ. حاول مرة أخرى." };
  }
}
