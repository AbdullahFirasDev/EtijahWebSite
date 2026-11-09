import type { Metadata } from "next";
import { ProgramsListing } from "@/components/travel/ProgramsListing";
import { TravelShell } from "@/components/travel/TravelShell";
import { en } from "@/content/en";
import { travel } from "@/content/travel";
import { travelPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = travelPageMetadata({ locale: "en", title: travel.en.meta.listTitle, description: travel.en.meta.listDescription, path: "/programs/" });

export default async function ProgramsPageEn({ searchParams }: PageProps<"/en/programs">) {
  return (
    <TravelShell dict={en} languageHref="/programs/">
      <ProgramsListing locale="en" searchParams={await searchParams} />
    </TravelShell>
  );
}
