import { HotelEditor } from "@/components/staff/HotelEditor";
import { EmptyState, LinkButton, PageHeader } from "@/components/staff/ui";
import { countryName } from "@/lib/countries";
import { requireStaffPage } from "@/server/auth/session";
import { listDestinations } from "@/server/repo/catalog";

export const metadata = { title: "فندق جديد" };

export default async function NewHotelPage() {
  await requireStaffPage("hotels.edit");
  const destinations = listDestinations({ activeOnly: true }).map((d) => ({ id: d.id, label: `${d.name_ar} — ${countryName(d.country_code, "ar")}` }));
  return (
    <>
      <PageHeader title="فندق جديد" back={{ href: "/staff/hotels/", label: "الفنادق" }} />
      {destinations.length ? (
        <HotelEditor
          destinations={destinations}
          canDelete={false}
          initial={{
            destination_id: destinations.length === 1 ? destinations[0].id : null,
            name_ar: "",
            name_en: "",
            stars: null,
            category_ar: null,
            category_en: null,
            website_url: null,
            maps_url: null,
            address_ar: null,
            address_en: null,
            description_ar: null,
            description_en: null,
            rooms_ar: null,
            rooms_en: null,
            active: true,
            media: [],
          }}
        />
      ) : (
        <EmptyState title="أضف وجهة أولاً" text="كل فندق يتبع مدينة/وجهة. أضف الوجهة ثم عد لإضافة الفندق." action={<LinkButton href="/staff/destinations/" variant="primary">إدارة الوجهات</LinkButton>} />
      )}
    </>
  );
}
