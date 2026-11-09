"use client";

import {
  BedDouble,
  Building2,
  ExternalLink,
  FileText,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MapPin,
  MapPinned,
  Menu,
  Settings,
  UserCog,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LogoBadge } from "@/components/brand/Logo";
import { asset } from "@/lib/asset";
import { can, ROLE_LABELS, type Permission, type Role } from "@/lib/permissions";
import { logoutAction } from "@/server/actions/auth";
import { Toaster } from "./Toaster";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  permission: Permission;
  badge?: number;
}

const ic = "size-[1.15rem] shrink-0";

export function StaffShell({ user, newLeads, children }: { user: { name: string; role: Role }; newLeads: number; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    setOpen(false);
  }

  const groups: { title: string | null; items: NavItem[] }[] = [
    { title: null, items: [{ href: "/staff/", label: "لوحة المتابعة", icon: <LayoutDashboard className={ic} />, permission: "catalog.view" }] },
    {
      title: "المبيعات",
      items: [
        { href: "/staff/requests/", label: "طلبات المسافرين", icon: <Inbox className={ic} />, permission: "leads.view", badge: newLeads },
        { href: "/staff/quotes/", label: "عروض أسعار الشركات", icon: <FileText className={ic} />, permission: "b2b.manage" },
        { href: "/staff/companies/", label: "الشركات وجهات الاتصال", icon: <Building2 className={ic} />, permission: "b2b.manage" },
      ],
    },
    {
      title: "العروض والمحتوى",
      items: [
        { href: "/staff/programs/", label: "البرامج السياحية", icon: <MapPinned className={ic} />, permission: "catalog.view" },
        { href: "/staff/groups/", label: "الكروبات والمقاعد", icon: <UsersRound className={ic} />, permission: "catalog.view" },
        { href: "/staff/hotels/", label: "الفنادق", icon: <BedDouble className={ic} />, permission: "catalog.view" },
        { href: "/staff/destinations/", label: "الوجهات", icon: <MapPin className={ic} />, permission: "catalog.view" },
        { href: "/staff/services/", label: "الخدمات", icon: <ListChecks className={ic} />, permission: "catalog.view" },
      ],
    },
    {
      title: "الإدارة",
      items: [
        { href: "/staff/users/", label: "المستخدمون والصلاحيات", icon: <UserCog className={ic} />, permission: "users.manage" },
        { href: "/staff/settings/", label: "الإعدادات", icon: <Settings className={ic} />, permission: "settings.manage" },
      ],
    },
  ];

  const isActive = (href: string) => (href === "/staff/" ? pathname === "/staff" || pathname === "/staff/" : pathname.startsWith(href.replace(/\/$/, "")));

  const nav = (
    <nav aria-label="قائمة البوابة" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
      {groups.map((g) => {
        const items = g.items.filter((i) => can(user.role, i.permission));
        if (!items.length) return null;
        return (
          <div key={g.title ?? "main"}>
            {g.title ? <p className="mb-2 px-3 text-[0.7rem] font-bold text-white/45">{g.title}</p> : null}
            <ul role="list" className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      prefetch={false}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.92rem] font-semibold transition-colors ${
                        active ? "bg-white text-brand-950 shadow-sm" : "text-white/80 hover:bg-white/8 hover:text-white"
                      }`}
                    >
                      <span className={active ? "text-brand-600" : "text-white/55"}>{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                      {item.badge ? (
                        <span className="num grid min-w-6 place-items-center rounded-full bg-accent-500 px-1.5 text-xs font-black text-brand-950" aria-label={`${item.badge} جديد`}>
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  const sidebar = (
    <div className="surface-dark flex h-full flex-col bg-brand-950">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <LogoBadge className="size-10" idSuffix="staff" />
        <div className="leading-tight">
          <p className="font-black text-white">بوابة الموظفين</p>
          <p className="text-xs text-white/60">الاتجاه للسياحة والسفر</p>
        </div>
      </div>
      {nav}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="grid size-9 place-items-center rounded-full bg-white/10 text-white">
            <UserRound className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-bold text-white">{user.name}</p>
            <p className="text-xs text-white/55">{ROLE_LABELS[user.role]}</p>
          </div>
        </div>
        <div className="mt-1 grid grid-cols-3 gap-1">
          <Link href="/staff/account/" prefetch={false} className="rounded-lg px-2 py-2 text-center text-xs font-bold text-white/75 hover:bg-white/10 hover:text-white">
            حسابي
          </Link>
          <a href={asset("/")} target="_blank" rel="noopener" className="inline-flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-bold text-white/75 hover:bg-white/10 hover:text-white">
            الموقع <ExternalLink className="size-3" aria-hidden="true" />
          </a>
          <form action={logoutAction}>
            <button type="submit" className="inline-flex w-full items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-bold text-white/75 hover:bg-white/10 hover:text-white">
              <LogOut className="size-3.5" aria-hidden="true" /> خروج
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <Toaster>
      <div className="min-h-svh bg-mist lg:grid lg:grid-cols-[16.5rem_1fr]">
        <a href="#staff-main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[90] focus:rounded-xl focus:bg-accent-500 focus:px-4 focus:py-2 focus:font-bold focus:text-brand-950">
          تخطَّ إلى المحتوى
        </a>
        <aside className="sticky top-0 hidden h-svh lg:block">{sidebar}</aside>

        {/* Mobile top bar + drawer */}
        <div className="surface-dark sticky top-0 z-40 flex items-center justify-between bg-brand-950 px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2.5">
            <LogoBadge className="size-9" idSuffix="staff-m" />
            <p className="font-black text-white">بوابة الموظفين</p>
          </div>
          <button type="button" onClick={() => setOpen(true)} aria-label="فتح القائمة" aria-expanded={open} className="grid size-10 place-items-center rounded-xl border border-white/20 text-white">
            <Menu className="size-5" aria-hidden="true" />
          </button>
        </div>
        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="قائمة البوابة">
            <button type="button" aria-label="إغلاق القائمة" onClick={() => setOpen(false)} className="absolute inset-0 bg-brand-950/60 backdrop-blur-sm" />
            <div className="absolute inset-y-0 start-0 w-[85%] max-w-xs shadow-2xl motion-safe:animate-[menu-in_0.3s_var(--ease-out-expo)_both]">
              {sidebar}
              <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق القائمة" className="absolute end-3 top-4 grid size-9 place-items-center rounded-xl bg-white/10 text-white">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}

        <main id="staff-main" tabIndex={-1} className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[84rem]">{children}</div>
        </main>
      </div>
    </Toaster>
  );
}
