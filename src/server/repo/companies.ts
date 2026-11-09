import "server-only";
import { all, get, now, run, tx } from "../db";
import { audit } from "../security";

export interface CompanyRow {
  id: number;
  name: string;
  name_en: string | null;
  industry: string | null;
  city: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactRow {
  id: number;
  company_id: number;
  name: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  is_primary: number;
  notes: string | null;
}

export function listCompanies(q?: string) {
  return all<CompanyRow & { contacts: number; quotes: number; accepted: number; last_quote: string | null }>(
    `SELECT c.*,
       (SELECT COUNT(*) FROM company_contacts x WHERE x.company_id = c.id) AS contacts,
       (SELECT COUNT(*) FROM quotes x WHERE x.company_id = c.id) AS quotes,
       (SELECT COUNT(*) FROM quotes x WHERE x.company_id = c.id AND x.status = 'accepted') AS accepted,
       (SELECT MAX(created_at) FROM quotes x WHERE x.company_id = c.id) AS last_quote
     FROM companies c ${q ? "WHERE c.name LIKE ? OR c.name_en LIKE ? OR c.industry LIKE ?" : ""}
     ORDER BY COALESCE(last_quote, c.updated_at) DESC`,
    ...(q ? [`%${q}%`, `%${q}%`, `%${q}%`] : []),
  );
}

export const getCompany = (id: number) => get<CompanyRow>("SELECT * FROM companies WHERE id = ?", id);
export const companyContacts = (companyId: number) =>
  all<ContactRow>("SELECT * FROM company_contacts WHERE company_id = ? ORDER BY is_primary DESC, name", companyId);

export type CompanyInput = Omit<CompanyRow, "id" | "created_at" | "updated_at">;

export function saveCompany(id: number | null, input: CompanyInput, userId: number): number {
  const t = now();
  const vals = [input.name, input.name_en, input.industry, input.city, input.address, input.website, input.phone, input.email, input.notes];
  if (id) {
    run(
      "UPDATE companies SET name = ?, name_en = ?, industry = ?, city = ?, address = ?, website = ?, phone = ?, email = ?, notes = ?, updated_at = ? WHERE id = ?",
      ...vals, t, id,
    );
    audit(userId, "update", "company", id);
    return id;
  }
  const newId = run(
    "INSERT INTO companies (name, name_en, industry, city, address, website, phone, email, notes, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ...vals, userId, t, t,
  ).id;
  audit(userId, "create", "company", newId);
  return newId;
}

export type ContactInput = Omit<ContactRow, "id" | "company_id" | "is_primary"> & { is_primary: boolean };

export function saveContact(companyId: number, id: number | null, input: ContactInput): number {
  const t = now();
  return tx(() => {
    if (input.is_primary) run("UPDATE company_contacts SET is_primary = 0 WHERE company_id = ?", companyId);
    if (id) {
      run(
        "UPDATE company_contacts SET name = ?, position = ?, phone = ?, email = ?, is_primary = ?, notes = ?, updated_at = ? WHERE id = ? AND company_id = ?",
        input.name, input.position, input.phone, input.email, input.is_primary, input.notes, t, id, companyId,
      );
      return id;
    }
    const first = !get("SELECT 1 FROM company_contacts WHERE company_id = ?", companyId);
    return run(
      "INSERT INTO company_contacts (company_id, name, position, phone, email, is_primary, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      companyId, input.name, input.position, input.phone, input.email, input.is_primary || first, input.notes, t, t,
    ).id;
  });
}

export function deleteContact(companyId: number, id: number) {
  run("DELETE FROM company_contacts WHERE id = ? AND company_id = ?", id, companyId);
}

export function deleteCompany(id: number, userId: number): string | null {
  if (get("SELECT 1 FROM quotes WHERE company_id = ?", id)) return "لا يمكن حذف شركة لديها عروض أسعار محفوظة.";
  run("DELETE FROM companies WHERE id = ?", id);
  audit(userId, "delete", "company", id);
  return null;
}
