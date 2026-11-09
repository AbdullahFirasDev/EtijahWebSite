import { SettingsForm } from "@/components/staff/AdminForms";
import { PageHeader } from "@/components/staff/ui";
import { requireStaffPage } from "@/server/auth/session";
import { getSettings } from "@/server/repo/settings";

export const metadata = { title: "الإعدادات" };

export default async function SettingsPage() {
  await requireStaffPage("settings.manage");
  const s = getSettings();
  return (
    <>
      <PageHeader title="الإعدادات" description="العملات وإعدادات عروض أسعار الشركات." />
      <SettingsForm initial={{ ...s, currencies: [...s.currencies] }} />
    </>
  );
}
