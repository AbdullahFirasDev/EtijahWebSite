"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ok, type ActionResult } from "@/lib/action-result";
import { passwordProblem } from "../auth/password";
import { COMPANY_COOKIE, createSession, destroySession, SESSION_COOKIE } from "../auth/session";
import { setCompanyUserPassword, type CompanyUserDoc } from "../repo/companies";
import { authenticate, authenticateIn, checkPassword, setPassword } from "../repo/users";
import { col } from "../db";
import { verifyPassword } from "../auth/password";
import { clearRateLimit, rateLimit, requestMeta, sha256 } from "../security";
import { companyAction, staffAction } from "./guard";

export type LoginState = { error?: string; email?: string } | undefined;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  if (!email || !password) return { error: "أدخل البريد الإلكتروني وكلمة المرور.", email };

  // Per-IP throttle on top of the per-account lockout.
  const { ipHash } = await requestMeta();
  if (!(await rateLimit("login", ipHash, 20, 15 * 60))) return { error: "محاولات كثيرة. انتظر 15 دقيقة ثم حاول مجدداً.", email };

  const result = await authenticate(email, password);
  if ("error" in result) {
    return {
      error: result.error === "locked" ? "تم إيقاف الدخول مؤقتاً بعد محاولات فاشلة متكررة. حاول بعد 15 دقيقة." : "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
      email,
    };
  }
  await clearRateLimit("login", ipHash);
  await createSession("staff", result.user._id);
  const next = String(formData.get("next") ?? "");
  // Only same-site staff paths are allowed as a post-login destination.
  redirect(/^\/staff\/[\w\-/?=&%.]*$/.test(next) ? next : "/staff/");
}

export async function logoutAction() {
  await destroySession("staff");
  redirect("/staff/login/");
}

const passwordSchema = z.object({ current: z.string().min(1, "أدخل كلمة المرور الحالية.").max(200), next: z.string().max(200) });

export async function changeOwnPasswordAction(input: { current: string; next: string }): Promise<ActionResult<null>> {
  return staffAction("portal.view", passwordSchema, input, async (data, staff) => {
    const problem = passwordProblem(data.next);
    if (problem) return { ok: false, error: problem, fieldErrors: { next: problem } };
    if (!(await checkPassword(staff.id, data.current))) return { ok: false, error: "كلمة المرور الحالية غير صحيحة.", fieldErrors: { current: "غير صحيحة" } };
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    await setPassword(staff.id, data.next, token ? sha256(token) : undefined);
    return ok(null, "تم تغيير كلمة المرور، وتم تسجيل الخروج من الأجهزة الأخرى.");
  });
}

// ------------------------------------------------------------------ Partner (B2B) portal
export async function companyLoginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  if (!email || !password) return { error: "أدخل البريد الإلكتروني وكلمة المرور. / Enter your e-mail and password.", email };
  const { ipHash } = await requestMeta();
  if (!(await rateLimit("b2b-login", ipHash, 20, 15 * 60))) return { error: "محاولات كثيرة. انتظر 15 دقيقة. / Too many attempts, wait 15 minutes.", email };

  const result = await authenticateIn<CompanyUserDoc>("company_users", email, password);
  if ("error" in result) {
    return {
      error:
        result.error === "locked"
          ? "تم إيقاف الدخول مؤقتاً بعد محاولات فاشلة متكررة. / Sign-in is locked for 15 minutes."
          : "البريد الإلكتروني أو كلمة المرور غير صحيحة. / Wrong e-mail or password.",
      email,
    };
  }
  // The company must exist, be active and have its portal enabled.
  const company = await (await col<{ _id: number; status: string; portal?: { enabled?: boolean } }>("companies")).findOne({ _id: result.user.company_id });
  if (!company || company.status === "archived" || !company.portal?.enabled) return { error: "بوابة شركتك غير مفعّلة حالياً. تواصل مع الاتجاه. / Your company portal is not enabled.", email };
  await clearRateLimit("b2b-login", ipHash);
  await createSession("company", result.user._id, result.user.company_id);
  redirect("/b2b/");
}

export async function companyLogoutAction() {
  await destroySession("company");
  redirect("/b2b/login/");
}

export async function companyChangePasswordAction(input: { current: string; next: string }): Promise<ActionResult<null>> {
  return companyAction(null, passwordSchema, input, async (data, user) => {
    const problem = passwordProblem(data.next);
    if (problem) return { ok: false, error: problem, fieldErrors: { next: problem } };
    const row = await (await col<CompanyUserDoc>("company_users")).findOne({ _id: user.id });
    if (!row || !(await verifyPassword(data.current, row.password_hash))) return { ok: false, error: "كلمة المرور الحالية غير صحيحة.", fieldErrors: { current: "غير صحيحة" } };
    const token = (await cookies()).get(COMPANY_COOKIE)?.value;
    await setCompanyUserPassword(user.id, data.next, { self: true }, token ? sha256(token) : undefined);
    return ok(null, "تم تغيير كلمة المرور.");
  });
}
