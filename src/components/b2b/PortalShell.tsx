"use client";

import { BedDouble, FileText, Inbox, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Toaster } from "@/components/staff/Toaster";
import { mediaSrc, type MediaRef } from "@/lib/media";
import type { CompanyPermission } from "@/lib/permissions";
import { companyLogoutAction } from "@/server/actions/auth";

/** Partner portal frame in the company's own identity (logo and colours). */
export function PortalShell({
  company,
  user,
  children,
}: {
  company: { name: string; logo: MediaRef | null; primary: string; secondary: string };
  user: { name: string; permissions: CompanyPermission[] };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const items = [
    { href: "/b2b/", label: "الرئيسية", icon: <LayoutDashboard className="size-4" />, show: true },
    { href: "/b2b/quotes/", label: "عروض الأسعار", icon: <FileText className="size-4" />, show: user.permissions.includes("quotes.view") },
    { href: "/b2b/hotels/", label: "الفنادق والأسعار", icon: <BedDouble className="size-4" />, show: user.permissions.includes("hotels.view") },
    { href: "/b2b/requests/", label: "طلباتنا", icon: <Inbox className="size-4" />, show: user.permissions.includes("requests.create") },
    { href: "/b2b/account/", label: "حسابي", icon: <UserRound className="size-4" />, show: true },
  ].filter((i) => i.show);
  const active = (href: string) => (href === "/b2b/" ? pathname === "/b2b" || pathname === "/b2b/" : pathname.startsWith(href.replace(/\/$/, "")));

  return (
    <Toaster>
      <div className="min-h-svh bg-mist" style={{ ["--pp" as string]: company.primary, ["--ps" as string]: company.secondary }} data-portal-company={company.name}>
        <header className="text-white" style={{ background: company.primary }}>
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              {company.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaSrc(company.logo, 480)} alt="" className="h-11 w-auto rounded-md bg-white/95 p-1" />
              ) : null}
              <div className="leading-tight">
                <p className="text-lg font-black" data-portal-name>
                  {company.name}
                </p>
                <p className="text-xs opacity-80">بوابة الشركة · بالتعاون مع الاتجاه للسياحة والسفر</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="font-bold">{user.name}</span>
              <form action={companyLogoutAction}>
                <button type="submit" className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-bold ring-1 ring-white/40 hover:bg-white/10">
                  <LogOut className="size-4" aria-hidden="true" /> خروج
                </button>
              </form>
            </div>
          </div>
          <nav aria-label="قائمة البوابة" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
            {items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                prefetch={false}
                aria-current={active(i.href) ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-t-xl px-4 py-2 text-sm font-bold ${active(i.href) ? "bg-mist text-brand-950" : "text-white/85 hover:bg-white/10"}`}
              >
                {i.icon} {i.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </Toaster>
  );
}
