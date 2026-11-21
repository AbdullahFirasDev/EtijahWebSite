"use client";

import {
  BadgePercent,
  BedDouble,
  Binoculars,
  BookOpenCheck,
  Building2,
  ChartColumn,
  ClipboardList,
  ExternalLink,
  FilePlus2,
  FileStack,
  FileText,
  Globe2,
  History,
  Inbox,
  KeyRound,
  Landmark,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MapPinned,
  Menu,
  MessagesSquare,
  Palette,
  Plane,
  Receipt,
  Search,
  Send,
  Settings,
  Sparkles,
  Ticket,
  UserCog,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  keywords?: string;
}

const ic = "size-[1.1rem] shrink-0";

export function StaffShell({ user, badges, children }: { user: { name: string; role: Role }; badges: { leads: number; b2b: number }; children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [openedAt, setOpenedAt] = useState(pathname);
  const searchRef = useRef<HTMLInputElement>(null);
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    setOpen(false);
    setQuery("");
  }

  const groups: { title: string | null; icon?: ReactNode; items: NavItem[] }[] = useMemo(
    () => [
      { title: null, items: [{ href: "/staff/", label: "لوحة المتابعة", icon: <LayoutDashboard className={ic} />, permission: "portal.view" }] },
      {
        title: "البرامج السياحية",
        icon: <MapPinned className="size-3.5" />,
        items: [
          { href: "/staff/programs/", label: "جميع البرامج", icon: <MapPinned className={ic} />, permission: "programs.view", keywords: "برنامج رحلات" },
          { href: "/staff/programs/?view=fixed", label: "البرامج العامة", icon: <BookOpenCheck className={ic} />, permission: "programs.view", keywords: "كروب موعد ثابت fixed" },
          { href: "/staff/programs/?view=custom", label: "البرامج الخاصة", icon: <Sparkles className={ic} />, permission: "programs.view", keywords: "حسب الطلب custom" },
          { href: "/staff/programs/new/", label: "إنشاء برنامج جديد", icon: <FilePlus2 className={ic} />, permission: "programs.edit", keywords: "جديد wizard" },
          { href: "/staff/groups/", label: "الكروبات والمقاعد", icon: <UsersRound className={ic} />, permission: "programs.view", keywords: "مقاعد مواعيد" },
          { href: "/staff/destinations/", label: "الدول والوجهات", icon: <Globe2 className={ic} />, permission: "programs.view", keywords: "مدن دول" },
          { href: "/staff/hotels/", label: "مكتبة الفنادق", icon: <BedDouble className={ic} />, permission: "hotels.view", keywords: "فندق أسعار غرف" },
          { href: "/staff/services/", label: "الخدمات", icon: <ListChecks className={ic} />, permission: "programs.view" },
          { href: "/staff/tours/", label: "الجولات المسجلة", icon: <Binoculars className={ic} />, permission: "programs.view", keywords: "جولة رحلة يومية tour excursion" },
          { href: "/staff/requests/", label: "طلبات المسافرين", icon: <Inbox className={ic} />, permission: "leads.view", badge: badges.leads, keywords: "حجز طلب" },
        ],
      },
      {
        title: "الشركات B2B",
        icon: <Building2 className="size-3.5" />,
        items: [
          { href: "/staff/companies/", label: "الشركات", icon: <Building2 className={ic} />, permission: "b2b.view", keywords: "شركاء وكلاء" },
          { href: "/staff/company-users/", label: "حسابات المستخدمين", icon: <KeyRound className={ic} />, permission: "b2b.users", keywords: "دخول بوابة" },
          { href: "/staff/quotes/", label: "عروض الأسعار", icon: <FileText className={ic} />, permission: "quotes.manage", keywords: "عرض سعر" },
          { href: "/staff/quotes/?status=open", label: "العروض المرسلة", icon: <Send className={ic} />, permission: "quotes.manage" },
          { href: "/staff/b2b-requests/", label: "الطلبات والتعديلات", icon: <MessagesSquare className={ic} />, permission: "quotes.manage", badge: badges.b2b, keywords: "طلب تعديل" },
          { href: "/staff/branding/", label: "ملفات PDF للشركات", icon: <Palette className={ic} />, permission: "b2b.view", keywords: "هوية شعار ألوان" },
        ],
      },
      {
        title: "الطيران والعمولات",
        icon: <Plane className="size-3.5" />,
        items: [
          { href: "/staff/airlines/", label: "شركات الطيران", icon: <Plane className={ic} />, permission: "airlines.view", keywords: "خطوط IATA" },
          { href: "/staff/commissions/companies/", label: "عمولات الشركات", icon: <BadgePercent className={ic} />, permission: "commissions.manage", keywords: "نسبة" },
          { href: "/staff/commissions/etijah/", label: "عمولات شركة الاتجاه", icon: <WalletCards className={ic} />, permission: "commissions.manage", keywords: "عمولتنا net" },
          { href: "/staff/issuance/", label: "آلية إصدار التذاكر", icon: <ClipboardList className={ic} />, permission: "airlines.view", keywords: "GDS بوابة إصدار" },
          { href: "/staff/tickets/", label: "سجلات الإصدارات", icon: <Ticket className={ic} />, permission: "tickets.view", keywords: "تذكرة PNR" },
          { href: "/staff/reports/", label: "التقارير", icon: <ChartColumn className={ic} />, permission: "reports.finance", keywords: "excel مستحقات" },
        ],
      },
      {
        title: "الإعدادات والإدارة",
        icon: <Settings className="size-3.5" />,
        items: [
          { href: "/staff/users/", label: "الموظفون والصلاحيات", icon: <UserCog className={ic} />, permission: "users.manage" },
          { href: "/staff/settings/", label: "العملات وإعدادات النظام", icon: <Landmark className={ic} />, permission: "settings.manage", keywords: "عملة" },
          { href: "/staff/settings/company/", label: "إعدادات الشركة", icon: <Receipt className={ic} />, permission: "settings.manage" },
          { href: "/staff/settings/pdf/", label: "قوالب PDF", icon: <FileStack className={ic} />, permission: "settings.manage", keywords: "قالب" },
          { href: "/staff/audit/", label: "سجل العمليات", icon: <History className={ic} />, permission: "audit.view", keywords: "audit تدقيق" },
        ],
      },
    ],
    [badges.leads, badges.b2b],
  );

  const visible = groups.map((g) => ({ ...g, items: g.items.filter((i) => can(user.role, i.permission)) })).filter((g) => g.items.length);
  const q = query.trim().toLowerCase();
  const filtered = q ? visible.map((g) => ({ ...g, items: g.items.filter((i) => `${i.label} ${i.keywords ?? ""} ${g.title ?? ""}`.toLowerCase().includes(q)) })).filter((g) => g.items.length) : visible;
  const firstMatch = filtered[0]?.items[0];

  // Ctrl/⌘+K focuses the quick search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (window.matchMedia("(min-width: 1024px)").matches) searchRef.current?.focus();
        else setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (href: string) => {
    const [path, qs] = href.split("?");
    const clean = path.replace(/\/$/, "");
    if (href === "/staff/") return pathname === "/staff" || pathname === "/staff/";
    if (qs) {
      const [k, v] = qs.split("=");
      return pathname.replace(/\/$/, "") === clean && search.get(k) === v;
    }
    // A plain list link is not active when a filtered sibling (?view=…) is the current page.
    if (pathname.replace(/\/$/, "") === clean && (search.get("view") || search.get("status") === "open") && visible.some((g) => g.items.some((i) => i.href.startsWith(`${path}?`)))) return false;
    if (clean === "/staff/settings") return pathname.replace(/\/$/, "") === clean;
    return pathname.startsWith(clean);
  };

  const nav = (
    <nav aria-label="قائمة البوابة" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pt-3 pb-5">
      {filtered.length ? (
        filtered.map((g) => (
          <div key={g.title ?? "main"}>
            {g.title ? (
              <p className="mb-1.5 flex items-center gap-1.5 px-3 text-[0.7rem] font-bold text-white/45">
                {g.icon}
                {g.title}
              </p>
            ) : null}
            <ul role="list" className="space-y-0.5">
              {g.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      prefetch={false}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[0.9rem] font-semibold transition-colors ${active ? "bg-white text-brand-950 shadow-sm" : "text-white/80 hover:bg-white/8 hover:text-white"}`}
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
        ))
      ) : (
        <p className="px-3 text-sm text-white/60">لا توجد وظيفة بهذا الاسم.</p>
      )}
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
      <div className="px-3 pt-3">
        <label className="relative block">
          <span className="sr-only">بحث سريع في الوظائف</span>
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-white/50" aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && firstMatch) router.push(firstMatch.href);
              if (e.key === "Escape") setQuery("");
            }}
            placeholder="بحث سريع… (Ctrl+K)"
            data-quick-search
            className="h-10 w-full rounded-xl border border-white/15 bg-white/8 ps-9 pe-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-white/40 focus:bg-white/12"
          />
        </label>
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
      <div className="min-h-svh bg-mist lg:grid lg:grid-cols-[17rem_1fr]">
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
          <div className="mx-auto max-w-[86rem]">{children}</div>
        </main>
      </div>
    </Toaster>
  );
}
