import { PortalPassword } from "@/components/b2b/PortalForms";
import { Card, CardHeader } from "@/components/staff/ui";
import { COMPANY_PERMISSION_LABELS } from "@/lib/permissions";
import { requireCompanyPage } from "@/server/auth/session";

export const metadata = { title: "حسابي" };

export default async function PortalAccountPage() {
  const user = await requireCompanyPage();
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader title={user.name} description={user.email} />
        <div className="p-5 text-sm">
          <p className="font-bold text-brand-950">صلاحياتك:</p>
          <ul className="mt-2 list-disc ps-5 text-muted">
            {user.permissions.map((p) => (
              <li key={p}>{COMPANY_PERMISSION_LABELS[p]}</li>
            ))}
          </ul>
        </div>
      </Card>
      <Card>
        <CardHeader title="تغيير كلمة المرور" />
        <div className="p-5">
          <PortalPassword />
        </div>
      </Card>
    </div>
  );
}
