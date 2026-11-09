import { PasswordForm } from "@/components/staff/AdminForms";
import { Card, PageHeader } from "@/components/staff/ui";
import { ROLE_HINTS, ROLE_LABELS } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";

export const metadata = { title: "حسابي" };

export default async function AccountPage() {
  const staff = await requireStaffPage();
  return (
    <>
      <PageHeader title="حسابي" />
      <div className="grid gap-6">
        <Card className="max-w-xl p-5">
          <p className="text-lg font-extrabold text-brand-950">{staff.name}</p>
          <p className="text-sm text-muted" dir="ltr">
            {staff.email}
          </p>
          <p className="mt-3 text-sm">
            <span className="font-bold">{ROLE_LABELS[staff.role]}:</span> <span className="text-muted">{ROLE_HINTS[staff.role]}</span>
          </p>
        </Card>
        <PasswordForm />
      </div>
    </>
  );
}
