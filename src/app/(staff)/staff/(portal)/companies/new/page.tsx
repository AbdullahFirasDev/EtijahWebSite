import { CompanyEditor } from "@/components/staff/CompanyEditor";
import { PageHeader } from "@/components/staff/ui";
import { requireStaffPage } from "@/server/auth/session";

export const metadata = { title: "شركة جديدة" };

export default async function NewCompanyPage() {
  await requireStaffPage("b2b.manage");
  return (
    <>
      <PageHeader title="شركة جديدة" back={{ href: "/staff/companies/", label: "الشركات" }} />
      <CompanyEditor initial={{ id: null, name: "", name_en: null, industry: null, city: null, address: null, website: null, phone: null, email: null, notes: null }} />
    </>
  );
}
