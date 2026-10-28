import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { LogoBadge } from "@/components/brand/Logo";
import { cairo } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "الصفحة غير موجودة | الاتجاه للسياحة والسفر",
  description: "الصفحة التي تبحث عنها غير موجودة.",
  robots: { index: false },
};

/** Bilingual 404 (the site has separate Arabic and English root layouts). */
export default function GlobalNotFound() {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="surface-dark grid min-h-svh place-items-center bg-brand-950 px-5 py-16 text-center">
        <main className="flex max-w-xl flex-col items-center">
          <LogoBadge className="size-20" idSuffix="404" />
          <p className="num mt-8 text-7xl font-black text-accent-400 sm:text-8xl">404</p>
          <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">يبدو أنك سلكت اتجاهاً آخر</h1>
          <p className="mt-4 leading-[1.9] text-white/75">الصفحة التي تبحث عنها غير موجودة أو تم نقلها.</p>
          <p lang="en" dir="ltr" className="mt-2 text-sm text-white/55">
            This page doesn’t exist or may have moved.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            {/* Root layouts differ, so these are full page loads: prefetching RSC data is wasted. */}
            <Link href="/" prefetch={false} className="inline-flex h-12 items-center rounded-full bg-accent-500 px-7 font-bold text-brand-950 transition-colors hover:bg-accent-400">
              العودة إلى الصفحة الرئيسية
            </Link>
            <Link
              href="/en/"
              prefetch={false}
              lang="en"
              className="inline-flex h-12 items-center rounded-full border border-white/30 px-7 font-bold text-white transition-colors hover:bg-white/10"
            >
              English home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
