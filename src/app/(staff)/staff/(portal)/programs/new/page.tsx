import { ProgramWizard } from "@/components/staff/ProgramWizard";
import { PageHeader } from "@/components/staff/ui";
import { can } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { catalogOptions } from "@/server/editor-options";
import { emptyProgramForm } from "@/server/program-form";

export const metadata = { title: "إنشاء برنامج جديد" };

export default async function NewProgramPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const staff = await requireStaffPage("programs.edit");
  const { type } = await searchParams;
  const costs = can(staff.role, "hotels.costs");
  const options = await catalogOptions({ includeCosts: costs });
  return (
    <>
      <PageHeader
        title="إنشاء برنامج جديد"
        description="معالج من 7 خطوات. يمكنك الانتقال بين الخطوات بحرية والحفظ كمسودة في أي وقت دون فقدان عملك."
        back={{ href: "/staff/programs/", label: "البرامج السياحية" }}
      />
      <ProgramWizard
        initial={emptyProgramForm(options.defaultCurrency, type === "custom" ? "custom" : "fixed")}
        meta={{ id: null, code: null, status: "draft", updated_at: null, share: null }}
        options={options}
        rights={{ pricing: can(staff.role, "programs.pricing"), override: can(staff.role, "pricing.override"), publish: can(staff.role, "programs.publish"), costs }}
      />
    </>
  );
}
