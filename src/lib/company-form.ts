// Empty company form (plain module: usable from server pages and client components).
import type { CompanyForm } from "@/components/staff/CompanyEditor";

export const emptyCompanyForm = (): CompanyForm => ({
  id: null,
  name: "",
  name_en: null,
  industry: null,
  city: null,
  address: null,
  website: null,
  phone: null,
  email: null,
  notes: null,
  terms: null,
  status: "active",
  portal_enabled: false,
  branding: { logo: null, primary_color: "#0b3a66", secondary_color: "#f28c28", display_name: null, display_name_en: null, contact_line: null },
});
