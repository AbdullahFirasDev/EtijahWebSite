import type { Metadata } from "next";
import { ProgramsListing } from "@/components/travel/ProgramsListing";
import { TravelShell } from "@/components/travel/TravelShell";
import { ar } from "@/content/ar";
import { travel } from "@/content/travel";
import { travelPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = travelPageMetadata({ locale: "ar", title: travel.ar.meta.listTitle, description: travel.ar.meta.listDescription, path: "/programs/" });

export default async function ProgramsPage({ searchParams }: PageProps<"/programs">) {
  return (
    <TravelShell dict={ar} languageHref="/en/programs/">
      <ProgramsListing locale="ar" searchParams={await searchParams} />
    </TravelShell>
  );
}
