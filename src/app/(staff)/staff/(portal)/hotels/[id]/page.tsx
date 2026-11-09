import { notFound } from "next/navigation";
import { HotelEditor } from "@/components/staff/HotelEditor";
import { PageHeader } from "@/components/staff/ui";
import { countryName } from "@/lib/countries";
import type { MediaRef } from "@/lib/media";
import { can } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { mediaByIds } from "@/server/media";
import { getHotel, hotelMediaIds, listDestinations } from "@/server/repo/catalog";

export const metadata = { title: "تعديل فندق" };

export default async function EditHotelPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffPage("hotels.edit");
  const hotel = getHotel(Number((await params).id));
  if (!hotel) notFound();
  const ids = hotelMediaIds(hotel.id);
  const media = mediaByIds(ids);
  const destinations = listDestinations().map((d) => ({ id: d.id, label: `${d.name_ar} — ${countryName(d.country_code, "ar")}` }));

  return (
    <>
      <PageHeader title={hotel.name_ar} description={hotel.name_en} back={{ href: "/staff/hotels/", label: "الفنادق" }} />
      <HotelEditor
        destinations={destinations}
        canDelete={can(staff.role, "catalog.delete")}
        initial={{ ...hotel, active: !!hotel.active, media: ids.map((m) => media.get(m)).filter((m): m is MediaRef => !!m) }}
      />
    </>
  );
}
