import { HotelPage, hotelMetadata } from "@/components/travel/HotelPage";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/en/hotels/[slug]">) {
  return hotelMetadata("en", (await params).slug);
}

export default async function Page({ params }: PageProps<"/en/hotels/[slug]">) {
  return <HotelPage locale="en" slug={(await params).slug} />;
}
