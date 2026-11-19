import { UsersManager } from "@/components/staff/AdminForms";
import { PageHeader } from "@/components/staff/ui";
import { formatDateTime } from "@/lib/dates";
import { requireStaffPage } from "@/server/auth/session";
import { listUsers } from "@/server/repo/users";

export const metadata = { title: "المستخدمون والصلاحيات" };

export default async function UsersPage() {
  const staff = await requireStaffPage("users.manage");
  return (
    <>
      <PageHeader title="المستخدمون والصلاحيات" description="حسابات الموظفين وأدوارهم. لكل دور صلاحيات محددة." />
      <UsersManager me={staff.id} users={(await listUsers()).map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: !!u.active, last_login: u.last_login_at ? formatDateTime(u.last_login_at) : null }))} />
    </>
  );
}
