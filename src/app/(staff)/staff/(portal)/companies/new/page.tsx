import { CompanyEditor } from "@/components/staff/CompanyEditor";
import { emptyCompanyForm } from "@/lib/company-form";
import { PageHeader } from "@/components/staff/ui";
import { requireStaffPage } from "@/server/auth/session";

export const metadata = { title: "شركة جديدة" };

export default async function NewCompanyPage() {
  await requireStaffPage("b2b.manage");
  return (
    <>
      <PageHeader title="شركة جديدة" description="أدخل بيانات الشركة وهويتها البصرية. بعد الحفظ يمكنك إضافة جهات الاتصال والمستخدمين والفنادق والعمولات." back={{ href: "/staff/companies/", label: "الشركات" }} />
      <CompanyEditor initial={emptyCompanyForm()} />
    </>
  );
}
