import { HotelEditor } from "@/components/staff/HotelEditor";
import { EmptyState, LinkButton, PageHeader } from "@/components/staff/ui";
import { requireStaffPage } from "@/server/auth/session";
import { destinationOptions } from "@/server/editor-options";

export const metadata = { title: "فندق جديد" };

export default async function NewHotelPage() {
  await requireStaffPage("hotels.edit");
  const { destinations, countries } = await destinationOptions({ activeOnly: true });
  return (
    <>
      <PageHeader title="فندق جديد" back={{ href: "/staff/hotels/", label: "مكتبة الفنادق" }} description="أدخل بيانات الفندق وأنواع غرفه، ثم أضف أسعار الليلة بعد الحفظ." />
      {destinations.length ? (
        <HotelEditor
          destinations={destinations}
          countries={countries}
          canDelete={false}
          canEdit
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
            amenities: [],
            contact: { phone: null, email: null, person: null },
            internal_notes: null,
            status: "active",
            media: [],
            room_types: [
              { id: null, name_ar: "غرفة مزدوجة", name_en: "Double room", max_pax: 2, notes: null },
              { id: null, name_ar: "غرفة ثلاثية", name_en: "Triple room", max_pax: 3, notes: null },
            ],
          }}
        />
      ) : (
        <EmptyState title="أضف وجهة أولاً" text="كل فندق يتبع مدينة/وجهة. أضف الوجهة ثم عد لإضافة الفندق." action={<LinkButton href="/staff/destinations/" variant="primary">إدارة الوجهات</LinkButton>} />
      )}
    </>
  );
}
