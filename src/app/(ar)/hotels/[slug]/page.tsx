import { HotelPage, hotelMetadata } from "@/components/travel/HotelPage";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/hotels/[slug]">) {
  return hotelMetadata("ar", (await params).slug);
}

export default async function Page({ params }: PageProps<"/hotels/[slug]">) {
  return <HotelPage locale="ar" slug={(await params).slug} />;
}
