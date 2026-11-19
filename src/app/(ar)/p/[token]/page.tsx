import { SharedProgramPage, sharedProgramMetadata } from "@/components/travel/SharedProgramPage";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  return sharedProgramMetadata("ar", (await params).token);
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  return <SharedProgramPage locale="ar" token={(await params).token} />;
}
