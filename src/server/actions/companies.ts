"use server";

import { z } from "zod";
import { ok, type ActionResult } from "@/lib/action-result";
import { deleteCompany, deleteContact, getCompany, saveCompany, saveContact } from "../repo/companies";
import { get } from "../db";
import { id, optEmail, optText, optUrl, reqText } from "../validation";
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
});

export async function saveCompanyAction(input: z.input<typeof companySchema>): Promise<ActionResult<{ id: number }>> {
  return staffAction("b2b.manage", companySchema, input, (data, staff) => {
    if (data.id && !getCompany(data.id)) return { ok: false, error: "الشركة غير موجودة." };
    const { id: companyId, ...fields } = data;
    const savedId = saveCompany(companyId, fields, staff.id);
    return ok({ id: savedId }, "تم حفظ بيانات الشركة.");
  });
}

export async function deleteCompanyAction(companyId: number): Promise<ActionResult<null>> {
  return staffAction("b2b.delete", id, companyId, (cid, staff) => {
    const problem = deleteCompany(cid, staff.id);
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
  return staffAction("b2b.manage", contactSchema, input, (data) => {
    if (!getCompany(data.company_id)) return { ok: false, error: "الشركة غير موجودة." };
    if (data.id && !get("SELECT 1 FROM company_contacts WHERE id = ? AND company_id = ?", data.id, data.company_id)) return { ok: false, error: "جهة الاتصال غير موجودة." };
    const { company_id, id: contactId, ...fields } = data;
    return ok({ id: saveContact(company_id, contactId, fields) }, "تم حفظ جهة الاتصال.");
  });
}

export async function deleteContactAction(input: { company_id: number; id: number }): Promise<ActionResult<null>> {
  return staffAction("b2b.manage", z.object({ company_id: id, id }), input, (data) => {
    deleteContact(data.company_id, data.id);
    return ok(null, "تم حذف جهة الاتصال.");
  });
}
