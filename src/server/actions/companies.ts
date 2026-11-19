"use server";

import { z } from "zod";
import { ok, type ActionResult } from "@/lib/action-result";
import { isCurrency } from "@/lib/money";
import { COMPANY_PERMISSIONS } from "@/lib/permissions";
import { BOARDS } from "@/lib/travel-labels";
import { passwordProblem } from "../auth/password";
import { mediaExist } from "../media";
import { B2B_REQUEST_STATUSES, getB2bRequest, setB2bRequestStatus } from "../repo/b2b";
import { getHotel, RATE_BASES } from "../repo/catalog";
import {
  companyUserEmailTaken,
  createCompanyUser,
  deleteCompany,
  deleteContact,
  getCompany,
  getCompanyUserDoc,
  removeCompanyHotel,
  saveCompany,
  saveContact,
  setCompanyHotel,
  setCompanyUserPassword,
  updateCompanyUser,
} from "../repo/companies";
import { emailTaken } from "../repo/users";
import { email, hexColor, id, int, mediaId, money, optEmail, optText, optUrl, reqText } from "../validation";
import { staffAction } from "./guard";

const companySchema = z.object({
  id: id.nullable(),
  name: reqText(2, 160, "اسم الشركة"),
  name_en: optText(160),
  industry: optText(100),
  city: optText(80),
  address: optText(250),
  website: optUrl,
  phone: optText(40),
  email: optEmail,
  notes: optText(3000),
  terms: optText(6000),
  status: z.enum(["active", "archived"]),
  portal_enabled: z.boolean(),
  branding: z.object({
    logo_media_id: mediaId.nullable(),
    primary_color: hexColor,
    secondary_color: hexColor,
    display_name: optText(160),
    display_name_en: optText(160),
    contact_line: optText(200),
  }),
});

export async function saveCompanyAction(input: z.input<typeof companySchema>): Promise<ActionResult<{ id: number }>> {
  return staffAction("b2b.manage", companySchema, input, async (data, staff) => {
    if (data.id && !(await getCompany(data.id))) return { ok: false, error: "الشركة غير موجودة." };
    if (!(await mediaExist([data.branding.logo_media_id]))) return { ok: false, error: "الشعار غير موجود. أعد رفعه." };
    const { id: companyId, ...fields } = data;
    const savedId = await saveCompany(companyId, fields, staff.id);
    return ok({ id: savedId }, "تم حفظ بيانات الشركة.");
  });
}

export async function deleteCompanyAction(companyId: number): Promise<ActionResult<null>> {
  return staffAction("b2b.delete", id, companyId, async (cid, staff) => {
    const problem = await deleteCompany(cid, staff.id);
    return problem ? { ok: false, error: problem } : ok(null, "تم حذف الشركة.");
  });
}

const contactSchema = z.object({
  company_id: id,
  id: id.nullable(),
  name: reqText(2, 120, "اسم جهة الاتصال"),
  position: optText(100),
  phone: optText(40),
  email: optEmail,
  is_primary: z.boolean(),
  notes: optText(1000),
});

export async function saveContactAction(input: z.input<typeof contactSchema>): Promise<ActionResult<{ id: number }>> {
  return staffAction("b2b.manage", contactSchema, input, async (data) => {
    const company = await getCompany(data.company_id);
    if (!company) return { ok: false, error: "الشركة غير موجودة." };
    if (data.id && !company.contacts.some((c) => c.id === data.id)) return { ok: false, error: "جهة الاتصال غير موجودة." };
    const { company_id, id: contactId, ...fields } = data;
    return ok({ id: await saveContact(company_id, contactId, fields) }, "تم حفظ جهة الاتصال.");
  });
}

export async function deleteContactAction(input: { company_id: number; id: number }): Promise<ActionResult<null>> {
  return staffAction("b2b.manage", z.object({ company_id: id, id }), input, async (data) => {
    await deleteContact(data.company_id, data.id);
    return ok(null, "تم حذف جهة الاتصال.");
  });
}

// ------------------------------------------------------------------ Partner portal accounts
const permissions = z.array(z.enum(COMPANY_PERMISSIONS)).max(COMPANY_PERMISSIONS.length);

const newUserSchema = z.object({ company_id: id, name: reqText(2, 80, "الاسم"), email, phone: optText(40), permissions, password: z.string().max(200) });

export async function createCompanyUserAction(input: z.input<typeof newUserSchema>): Promise<ActionResult<{ id: number }>> {
  return staffAction("b2b.users", newUserSchema, input, async (data, staff) => {
    if (!(await getCompany(data.company_id))) return { ok: false, error: "الشركة غير موجودة." };
    const problem = passwordProblem(data.password);
    if (problem) return { ok: false, error: problem, fieldErrors: { password: problem } };
    if ((await companyUserEmailTaken(data.email)) || (await emailTaken(data.email))) return { ok: false, error: "هذا البريد مستخدم لحساب آخر.", fieldErrors: { email: "مستخدم" } };
    const newId = await createCompanyUser(data.company_id, { ...data, permissions: [...new Set(data.permissions)] }, staff.id);
    return ok({ id: newId }, "تم إنشاء حساب مستخدم الشركة. أرسل له رابط الدخول وكلمة المرور.");
  });
}

const updateUserSchema = z.object({ id, company_id: id, name: reqText(2, 80, "الاسم"), email, phone: optText(40), permissions, active: z.boolean() });

export async function updateCompanyUserAction(input: z.input<typeof updateUserSchema>): Promise<ActionResult<null>> {
  return staffAction("b2b.users", updateUserSchema, input, async (data, staff) => {
    const u = await getCompanyUserDoc(data.id);
    // The account must belong to the company being edited.
    if (!u || u.company_id !== data.company_id) return { ok: false, error: "المستخدم غير موجود." };
    if ((await companyUserEmailTaken(data.email, data.id)) || (await emailTaken(data.email))) return { ok: false, error: "هذا البريد مستخدم لحساب آخر." };
    const { id: userId, company_id: _c, ...fields } = data;
    await updateCompanyUser(userId, { ...fields, permissions: [...new Set(fields.permissions)] }, staff.id);
    return ok(null, "تم تحديث الحساب.");
  });
}

export async function resetCompanyUserPasswordAction(input: { id: number; company_id: number; password: string }): Promise<ActionResult<null>> {
  return staffAction("b2b.users", z.object({ id, company_id: id, password: z.string().max(200) }), input, async (data, staff) => {
    const u = await getCompanyUserDoc(data.id);
    if (!u || u.company_id !== data.company_id) return { ok: false, error: "المستخدم غير موجود." };
    const problem = passwordProblem(data.password);
    if (problem) return { ok: false, error: problem };
    await setCompanyUserPassword(data.id, data.password, { staffId: staff.id });
    return ok(null, "تم تعيين كلمة مرور جديدة، وأُنهيت جلسات المستخدم.");
  });
}

// ------------------------------------------------------------------ Hotel access & company prices
const companyRateSchema = z.object({
  rate_id: z.string().max(64).nullable(),
  room_type_id: z.string().max(64).nullable(),
  room_label: optText(120),
  board: z.enum(BOARDS).nullable(),
  basis: z.enum(RATE_BASES),
  occupancy: int(1, 20, "عدد الأشخاص"),
  currency: z.string().refine(isCurrency, { message: "العملة غير مدعومة." }),
  price: money.refine((v) => v > 0, { message: "السعر يجب أن يكون أكبر من صفر." }),
});

/** Grants (or updates) a company's access to a library hotel, with its own prices. */
export async function setCompanyHotelAction(input: { company_id: number; hotel_id: number; rates: unknown[] | null; note: string | null }): Promise<ActionResult<null>> {
  return staffAction(
    "b2b.manage",
    z.object({ company_id: id, hotel_id: id, rates: z.array(companyRateSchema).max(100).nullable(), note: optText(500) }),
    input,
    async (data, staff) => {
      if (!(await getCompany(data.company_id))) return { ok: false, error: "الشركة غير موجودة." };
      const hotel = await getHotel(data.hotel_id);
      if (!hotel || hotel.status !== "active") return { ok: false, error: "الفندق غير موجود أو مؤرشف." };
      await setCompanyHotel(data.company_id, data.hotel_id, data.rates, data.note, staff.id);
      return ok(null, data.rates ? "تم حفظ أسعار الشركة لهذا الفندق." : "أُتيح الفندق للشركة بأسعار البيع المقترحة. عدّلها حسب الاتفاق.");
    },
  );
}

export async function removeCompanyHotelAction(input: { company_id: number; hotel_id: number }): Promise<ActionResult<null>> {
  return staffAction("b2b.manage", z.object({ company_id: id, hotel_id: id }), input, async (data, staff) => {
    await removeCompanyHotel(data.company_id, data.hotel_id, staff.id);
    return ok(null, "أُلغي وصول الشركة إلى هذا الفندق.");
  });
}

// ------------------------------------------------------------------ Partner requests
export async function setB2bRequestStatusAction(input: { id: number; status: string; note: string | null }): Promise<ActionResult<null>> {
  return staffAction("quotes.manage", z.object({ id, status: z.enum(B2B_REQUEST_STATUSES), note: optText(1000) }), input, async (data, staff) => {
    if (!(await getB2bRequest(data.id))) return { ok: false, error: "الطلب غير موجود." };
    await setB2bRequestStatus(data.id, data.status, data.note, staff.id);
    return ok(null, "تم تحديث الطلب.");
  });
}
