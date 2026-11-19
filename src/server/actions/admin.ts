"use server";

import { z } from "zod";
import { ok, type ActionResult } from "@/lib/action-result";
import { CURRENCY_CODES } from "@/lib/money";
import { ROLES } from "@/lib/permissions";
import { passwordProblem } from "../auth/password";
import { companyUserEmailTaken } from "../repo/companies";
import { saveSettings } from "../repo/settings";
import { countAdmins, createUser, emailTaken, getUser, setPassword, updateUser } from "../repo/users";
import { audit } from "../security";
import { email, id, int, reqText } from "../validation";
import { staffAction } from "./guard";

const createSchema = z.object({ name: reqText(2, 80, "الاسم"), email, role: z.enum(ROLES), password: z.string().max(200) });

export async function createUserAction(input: z.input<typeof createSchema>): Promise<ActionResult<{ id: number }>> {
  return staffAction("users.manage", createSchema, input, async (data, staff) => {
    const problem = passwordProblem(data.password);
    if (problem) return { ok: false, error: problem, fieldErrors: { password: problem } };
    if ((await emailTaken(data.email)) || (await companyUserEmailTaken(data.email))) return { ok: false, error: "هذا البريد مستخدم لحساب آخر.", fieldErrors: { email: "مستخدم" } };
    const newId = await createUser(data);
    await audit(staff.id, "create", "user", newId, { role: data.role });
    return ok({ id: newId }, "تم إنشاء حساب الموظف.");
  });
}

const updateSchema = z.object({ id, name: reqText(2, 80, "الاسم"), email, role: z.enum(ROLES), active: z.boolean() });

export async function updateUserAction(input: z.input<typeof updateSchema>): Promise<ActionResult<null>> {
  return staffAction("users.manage", updateSchema, input, async (data, staff) => {
    const user = await getUser(data.id);
    if (!user) return { ok: false, error: "المستخدم غير موجود." };
    if (await emailTaken(data.email, data.id)) return { ok: false, error: "هذا البريد مستخدم لحساب آخر." };
    const losingAdmin = user.role === "admin" && user.active && (data.role !== "admin" || !data.active);
    if (losingAdmin && (await countAdmins()) <= 1) return { ok: false, error: "يجب أن يبقى مدير نظام فعّال واحد على الأقل." };
    if (data.id === staff.id && !data.active) return { ok: false, error: "لا يمكنك إيقاف حسابك." };
    await updateUser(data.id, data);
    await audit(staff.id, "update", "user", data.id, { before: { role: user.role, active: user.active }, after: { role: data.role, active: data.active } });
    return ok(null, "تم تحديث الحساب.");
  });
}

export async function resetUserPasswordAction(input: { id: number; password: string }): Promise<ActionResult<null>> {
  return staffAction("users.manage", z.object({ id, password: z.string().max(200) }), input, async (data, staff) => {
    const problem = passwordProblem(data.password);
    if (problem) return { ok: false, error: problem };
    if (!(await getUser(data.id))) return { ok: false, error: "المستخدم غير موجود." };
    await setPassword(data.id, data.password);
    await audit(staff.id, "reset_password", "user", data.id);
    return ok(null, "تم تعيين كلمة مرور جديدة، وأُنهيت جلسات المستخدم.");
  });
}

const currencyEnum = z.enum(CURRENCY_CODES as [string, ...string[]]);
const settingsSchema = z
  .object({
    currencies: z.array(currencyEnum).min(1, "فعّل عملة واحدة على الأقل."),
    default_currency: currencyEnum,
    quote_validity_days: int(1, 180, "مدة صلاحية العرض"),
    quote_terms_ar: z.string().trim().max(8000),
    quote_terms_en: z.string().trim().max(8000),
  })
  .refine((s) => s.currencies.includes(s.default_currency), { message: "العملة الافتراضية يجب أن تكون مفعّلة.", path: ["default_currency"] });

export async function saveSettingsAction(input: z.input<typeof settingsSchema>): Promise<ActionResult<null>> {
  return staffAction("settings.manage", settingsSchema, input, async (data, staff) => {
    await saveSettings(data as never);
    await audit(staff.id, "update", "settings", "system", data);
    return ok(null, "تم حفظ الإعدادات.");
  });
}

const profileSchema = z.object({
  company_name_ar: reqText(2, 120, "اسم الشركة بالعربية"),
  company_name_en: reqText(2, 120, "اسم الشركة بالإنجليزية"),
  company_phone: z.string().trim().max(60),
  company_email: z.string().trim().max(200),
  company_address_ar: z.string().trim().max(300),
  company_address_en: z.string().trim().max(300),
  pdf_show_hotel_photos: z.boolean(),
  pdf_footer_note_ar: z.string().trim().max(400),
  pdf_footer_note_en: z.string().trim().max(400),
});

/** Etijah's own identity and the unified PDF template options. */
export async function saveCompanyProfileAction(input: z.input<typeof profileSchema>): Promise<ActionResult<null>> {
  return staffAction("settings.manage", profileSchema, input, async (data, staff) => {
    await saveSettings(data);
    await audit(staff.id, "update", "settings", "profile", data);
    return ok(null, "تم حفظ بيانات الشركة وإعدادات القالب.");
  });
}

