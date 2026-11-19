import { ProfileSettings } from "@/components/staff/ProfileSettings";
import { PageHeader } from "@/components/staff/ui";
import { requireStaffPage } from "@/server/auth/session";
import { getSettings } from "@/server/repo/settings";

export const metadata = { title: "إعدادات الشركة" };

export default async function CompanySettingsPage() {
  await requireStaffPage("settings.manage");
  const s = await getSettings();
  return (
    <>
      <PageHeader title="إعدادات الشركة" description="هوية شركة الاتجاه على المستندات الصادرة بهويتها." />
      <ProfileSettings section="company" initial={{ ...s }} />
    </>
  );
}
