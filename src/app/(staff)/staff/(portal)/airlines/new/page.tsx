import { AirlineEditor } from "@/components/staff/AirlineEditor";
import { PageHeader } from "@/components/staff/ui";
import { requireStaffPage } from "@/server/auth/session";
import { airlineToForm, countryOptions } from "@/server/airline-form";

export const metadata = { title: "شركة طيران جديدة" };

export default async function NewAirlinePage() {
  await requireStaffPage("airlines.edit");
  return (
    <>
      <PageHeader title="شركة طيران جديدة" description="بعد الحفظ يمكنك تحديد عمولة الاتجاه منها وعمولات الشركات." back={{ href: "/staff/airlines/", label: "شركات الطيران" }} />
      <AirlineEditor initial={await airlineToForm(null)} canEdit countries={countryOptions()} />
    </>
  );
}
