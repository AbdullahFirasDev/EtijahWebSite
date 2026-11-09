import { ProgramPage, programMetadata } from "@/components/travel/ProgramPage";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/programs/[slug]">) {
  return programMetadata("ar", (await params).slug);
}

export default async function Page({ params, searchParams }: PageProps<"/programs/[slug]">) {
  const { departure } = await searchParams;
  return <ProgramPage locale="ar" slug={(await params).slug} departure={typeof departure === "string" ? departure : undefined} />;
}
