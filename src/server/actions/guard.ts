import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { ZodType } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { CommissionError } from "@/lib/commission-math";
import type { CompanyPermission, Permission } from "@/lib/permissions";
import { AuthError, requireCompanyUser, requireStaff, type CompanyUser, type StaffUser } from "../auth/session";
import { UserFacingError } from "../errors";
import { zodFailure } from "../validation";

export { UserFacingError };

const isUserFacing = (e: unknown): e is Error => e instanceof UserFacingError || e instanceof CommissionError;

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
    if (isUserFacing(error)) return { ok: false, error: error.message };
    console.error("[staff action]", error);
    return { ok: false, error: "حدث خطأ غير متوقع أثناء الحفظ. حاول مرة أخرى." };
  }
}

/**
 * Same for the partner (B2B) portal. The company id always comes from the session, never from
 * the input, so one company can never act on another company's data.
 */
export async function companyAction<S extends ZodType, T>(
  permission: CompanyPermission | null,
  schema: S,
  input: unknown,
  fn: (data: S["_output"], user: CompanyUser) => Promise<ActionResult<T>> | ActionResult<T>,
): Promise<ActionResult<T>> {
  try {
    const user = await requireCompanyUser(permission ?? undefined);
    const parsed = schema.safeParse(input);
    if (!parsed.success) return zodFailure(parsed.error);
    return await fn(parsed.data, user);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AuthError) return { ok: false, error: error.message };
    if (isUserFacing(error)) return { ok: false, error: error.message };
    console.error("[company action]", error);
    return { ok: false, error: "حدث خطأ غير متوقع. حاول مرة أخرى. / Something went wrong, please try again." };
  }
}
