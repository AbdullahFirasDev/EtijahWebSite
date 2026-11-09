import { ProgramPage, programMetadata } from "@/components/travel/ProgramPage";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/en/programs/[slug]">) {
  return programMetadata("en", (await params).slug);
}

export default async function Page({ params, searchParams }: PageProps<"/en/programs/[slug]">) {
  const { departure } = await searchParams;
  return <ProgramPage locale="en" slug={(await params).slug} departure={typeof departure === "string" ? departure : undefined} />;
}
