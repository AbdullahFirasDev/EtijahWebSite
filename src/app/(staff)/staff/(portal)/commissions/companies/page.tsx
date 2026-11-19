import Link from "next/link";
import { RulesManager } from "@/components/staff/RulesManager";
import { PageHeader, Select } from "@/components/staff/ui";
import { requireStaffPage } from "@/server/auth/session";
import { airlineOptions, listRules } from "@/server/repo/airlines";
import { listCompanies } from "@/server/repo/companies";
import { getSettings } from "@/server/repo/settings";

export const metadata = { title: "عمولات الشركات" };

export default async function CompanyCommissionsPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  await requireStaffPage("commissions.manage");
  const sp = await searchParams;
  const companyId = /^\d+$/.test(sp.company ?? "") ? Number(sp.company) : undefined;
  const [rules, airlines, companies, settings] = await Promise.all([listRules({ scope: "company", ...(companyId ? { companyId } : {}) }), airlineOptions(), listCompanies(), getSettings()]);
  const company = companies.find((c) => c.id === companyId);
  return (
    <>
      <PageHeader
        title="عمولات الشركات حسب الخطوط الجوية"
        description="عمولة كل شركة B2B من كل خط طيران على حدة، مع تاريخ بداية ونهاية وسجل تاريخي. لا تُفترض مساواتها لعمولة الاتجاه."
        actions={
          <form className="flex gap-2">
            <Select name="company" defaultValue={companyId ?? ""} aria-label="الشركة" className="w-64">
              <option value="">كل الشركات</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <button className="rounded-xl bg-brand-50 px-4 text-sm font-bold text-brand-700 hover:bg-brand-100">عرض</button>
          </form>
        }
      />
      {company ? (
        <p className="mb-4 text-sm">
          يمكن أيضاً إدارة هذه العمولات من{" "}
          <Link href={`/staff/companies/${company.id}/?tab=commissions`} prefetch={false} className="font-bold text-brand-600 underline">
            ملف {company.name}
          </Link>
          .
        </p>
      ) : null}
      <RulesManager
        scope="company"
        title={company ? `عمولات ${company.name}` : "كل عمولات الشركات"}
        description="أضف نسبة جديدة بتاريخ بدايتها؛ تُغلق النسبة السابقة تلقائياً وتبقى في السجل."
        rules={rules}
        airlines={airlines}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        currencies={settings.currencies}
        fixedCompanyId={companyId}
        canEdit
      />
    </>
  );
}
