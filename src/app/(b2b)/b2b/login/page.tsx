import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoBadge } from "@/components/brand/Logo";
import { LoginForm } from "@/components/staff/LoginForm";
import { getCompanyUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "دخول الشركات" };
export const dynamic = "force-dynamic";

export default async function B2bLoginPage() {
  if (await getCompanyUser()) redirect("/b2b/");
  return (
    <main className="surface-dark relative grid min-h-svh place-items-center overflow-hidden bg-brand-950 px-5 py-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(50rem_30rem_at_90%_0%,rgb(8_102_178/0.55),transparent_65%),radial-gradient(36rem_26rem_at_0%_100%,rgb(245_130_32/0.16),transparent_60%)]" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoBadge className="size-16" idSuffix="b2b-login" />
          <h1 className="mt-5 text-2xl font-extrabold text-white">بوابة الشركات</h1>
          <p className="mt-2 text-sm text-white/65">Partner portal — عروض الأسعار، الفنادق المتاحة لشركتكم، وطلبات البرامج.</p>
        </div>
        <div className="rounded-3xl bg-white p-7 text-ink shadow-[0_30px_80px_-30px_rgb(0_0_0/0.6)] sm:p-8">
          <LoginForm next="" realm="company" />
        </div>
        <p className="mt-6 text-center text-xs text-white/50">الحسابات تُنشأ من قبل فريق الاتجاه. لكل شركة بياناتها الخاصة فقط.</p>
      </div>
    </main>
  );
}
