"use server";

import { z } from "zod";
import { ok, type ActionResult } from "@/lib/action-result";
import { CURRENCY_CODES } from "@/lib/money";
import { ROLES } from "@/lib/permissions";
import { passwordProblem } from "../auth/password";
import { countAdmins, createUser, emailTaken, getUser, setPassword, updateUser } from "../repo/users";
import { saveSettings } from "../repo/settings";
import { audit } from "../security";
import { id, int, reqText } from "../validation";
import { staffAction } from "./guard";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), { message: "البريد الإلكتروني غير صالح." });

const createSchema = z.object({ name: reqText(2, 80, "الاسم"), email, role: z.enum(ROLES), password: z.string().max(200) });

export async function createUserAction(input: z.input<typeof createSchema>): Promise<ActionResult<{ id: number }>> {
  return staffAction("users.manage", createSchema, input, async (data, staff) => {
    const problem = passwordProblem(data.password);
    if (problem) return { ok: false, error: problem, fieldErrors: { password: problem } };
    if (emailTaken(data.email)) return { ok: false, error: "هذا البريد مستخدم لحساب آخر.", fieldErrors: { email: "مستخدم" } };
    const newId = await createUser(data);
    audit(staff.id, "create", "user", newId, { role: data.role });
    return ok({ id: newId }, "تم إنشاء حساب الموظف.");
  });
}

const updateSchema = z.object({ id, name: reqText(2, 80, "الاسم"), email, role: z.enum(ROLES), active: z.boolean() });

export async function updateUserAction(input: z.input<typeof updateSchema>): Promise<ActionResult<null>> {
  return staffAction("users.manage", updateSchema, input, (data, staff) => {
    const user = getUser(data.id);
    if (!user) return { ok: false, error: "المستخدم غير موجود." };
    if (emailTaken(data.email, data.id)) return { ok: false, error: "هذا البريد مستخدم لحساب آخر." };
    const losingAdmin = user.role === "admin" && user.active && (data.role !== "admin" || !data.active);
    if (losingAdmin && countAdmins() <= 1) return { ok: false, error: "يجب أن يبقى مدير نظام فعّال واحد على الأقل." };
    if (data.id === staff.id && !data.active) return { ok: false, error: "لا يمكنك إيقاف حسابك." };
    updateUser(data.id, data);
    audit(staff.id, "update", "user", data.id, { role: data.role, active: data.active });
    return ok(null, "تم تحديث الحساب.");
  });
}

export async function resetUserPasswordAction(input: { id: number; password: string }): Promise<ActionResult<null>> {
  return staffAction("users.manage", z.object({ id, password: z.string().max(200) }), input, async (data, staff) => {
    const problem = passwordProblem(data.password);
    if (problem) return { ok: false, error: problem };
    if (!getUser(data.id)) return { ok: false, error: "المستخدم غير موجود." };
    await setPassword(data.id, data.password);
    audit(staff.id, "reset_password", "user", data.id);
    return ok(null, "تم تعيين كلمة مرور جديدة، وأُنهيت جلسات المستخدم.");
  });
}

const settingsSchema = z
  .object({
    currencies: z.array(z.enum(CURRENCY_CODES as [string, ...string[]])).min(1, "فعّل عملة واحدة على الأقل."),
    default_currency: z.enum(CURRENCY_CODES as [string, ...string[]]),
    quote_validity_days: int(1, 180, "مدة صلاحية العرض"),
    quote_terms_ar: z.string().trim().max(8000),
    quote_terms_en: z.string().trim().max(8000),
  })
  .refine((s) => s.currencies.includes(s.default_currency), { message: "العملة الافتراضية يجب أن تكون مفعّلة.", path: ["default_currency"] });

export async function saveSettingsAction(input: z.input<typeof settingsSchema>): Promise<ActionResult<null>> {
  return staffAction("settings.manage", settingsSchema, input, (data, staff) => {
    saveSettings(data as never);
    audit(staff.id, "update", "settings", null);
    return ok(null, "تم حفظ الإعدادات.");
  });
}
