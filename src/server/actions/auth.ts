"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ok, type ActionResult } from "@/lib/action-result";
import { cookies } from "next/headers";
import { passwordProblem } from "../auth/password";
import { createSession, destroySession, SESSION_COOKIE } from "../auth/session";
import { clearRateLimit, rateLimit, requestMeta, sha256 } from "../security";
import { authenticate, checkPassword, setPassword } from "../repo/users";
import { staffAction } from "./guard";

export type LoginState = { error?: string; email?: string } | undefined;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  if (!email || !password) return { error: "أدخل البريد الإلكتروني وكلمة المرور.", email };

  // Per-IP throttle on top of the per-account lockout.
  const { ipHash } = await requestMeta();
  if (!rateLimit("login", ipHash, 20, 15 * 60)) return { error: "محاولات كثيرة. انتظر 15 دقيقة ثم حاول مجدداً.", email };

  const result = await authenticate(email, password);
  if ("error" in result) {
    return {
      error: result.error === "locked" ? "تم إيقاف الدخول مؤقتاً بعد محاولات فاشلة متكررة. حاول بعد 15 دقيقة." : "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
      email,
    };
  }
  clearRateLimit("login", ipHash);
  await createSession(result.user.id);
  const next = String(formData.get("next") ?? "");
  // Only same-site staff paths are allowed as a post-login destination.
  redirect(/^\/staff\/[\w\-/?=&%.]*$/.test(next) ? next : "/staff/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/staff/login/");
}

const passwordSchema = z.object({ current: z.string().min(1, "أدخل كلمة المرور الحالية.").max(200), next: z.string().max(200) });

export async function changeOwnPasswordAction(input: { current: string; next: string }): Promise<ActionResult<null>> {
  return staffAction("catalog.view", passwordSchema, input, async (data, staff) => {
    const problem = passwordProblem(data.next);
    if (problem) return { ok: false, error: problem, fieldErrors: { next: problem } };
    if (!(await checkPassword(staff.id, data.current))) return { ok: false, error: "كلمة المرور الحالية غير صحيحة.", fieldErrors: { current: "غير صحيحة" } };
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    await setPassword(staff.id, data.next, token ? sha256(token) : undefined);
    return ok(null, "تم تغيير كلمة المرور، وتم تسجيل الخروج من الأجهزة الأخرى.");
  });
}
