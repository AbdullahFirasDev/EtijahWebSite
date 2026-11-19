import Link from "next/link";
import { CompanyUsersManager } from "@/components/staff/B2bManagers";
import { Card, PageHeader } from "@/components/staff/ui";
import { requireStaffPage } from "@/server/auth/session";
import { listCompanies, listCompanyUsers } from "@/server/repo/companies";

export const metadata = { title: "حسابات مستخدمي الشركات" };

export default async function CompanyUsersPage() {
  await requireStaffPage("b2b.users");
  const [users, companies] = await Promise.all([listCompanyUsers(), listCompanies({ includeArchived: true })]);
  const name = new Map(companies.map((c) => [c.id, c.name]));
  return (
    <>
      <PageHeader title="حسابات مستخدمي الشركات" description="كل حسابات بوابة الشركات. لإنشاء حساب جديد افتح ملف الشركة ← «حسابات المستخدمين»." />
      <Card className="mb-6 p-4 text-sm">
        <p className="font-bold text-brand-950">الشركات:</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {companies.map((c) => (
            <Link key={c.id} href={`/staff/companies/${c.id}/?tab=users`} prefetch={false} className="rounded-full bg-mist px-3 py-1 font-bold text-brand-800 hover:bg-brand-50">
              {c.name} <span className="num text-muted">({c.users})</span>
            </Link>
          ))}
        </div>
      </Card>
      <CompanyUsersManager companyId={null} portalEnabled showCompany users={users.map((u) => ({ ...u, company_name: name.get(u.company_id) ?? "—" }))} />
    </>
  );
}
