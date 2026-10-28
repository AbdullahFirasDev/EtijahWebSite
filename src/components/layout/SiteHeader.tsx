"use client";

import { Globe2, Menu, Phone, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Logo } from "@/components/brand/Logo";
import { WhatsAppIcon } from "@/components/ui/icons";
import { site, telUrl, whatsappUrl } from "@/content/site";
import type { Dictionary, NavKey } from "@/content/types";
import { formatIndex } from "@/lib/format";
import { lockScroll, scrollToHash } from "@/lib/scroll";

const NAV_ORDER: NavKey[] = ["services", "why", "destinations", "process", "about", "contact"];

export function SiteHeader({ dict }: { dict: Dictionary }) {
  const { nav } = dict;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<NavKey | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Solid header once the page leaves the very top.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 24);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Highlight the section currently in the middle of the viewport.
  useEffect(() => {
    const sections = NAV_ORDER.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id as NavKey);
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) toggleRef.current?.focus();
  }, []);

  // Lock scrolling and move focus into the dialog while it is open.
  useEffect(() => {
    if (!open) return;
    lockScroll(true);
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const mq = window.matchMedia("(min-width: 64rem)");
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener("change", onChange);
    return () => {
      lockScroll(false);
      mq.removeEventListener("change", onChange);
    };
  }, [open]);

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusables = panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const onMenuLink = (event: MouseEvent<HTMLAnchorElement>, hash: string) => {
    event.preventDefault();
    close(false);
    // Wait for the scroll lock to release before scrolling.
    requestAnimationFrame(() => scrollToHash(hash));
  };

  const solid = scrolled || open;

  return (
    <header
      data-site-header
      data-solid={solid}
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,color] duration-500 ease-out-expo ${
        scrolled && !open
          ? "bg-white/85 text-brand-950 shadow-[0_1px_0_rgb(5_28_51/0.06),0_12px_32px_-18px_rgb(5_28_51/0.28)] backdrop-blur-xl"
          : "surface-dark text-white"
      }`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-accent-500 focus:px-5 focus:py-2.5 focus:font-bold focus:text-brand-950"
      >
        {nav.skip}
      </a>

      <div className={`container-site flex items-center justify-between gap-6 transition-[height] duration-500 ease-out-expo ${scrolled ? "h-[4.25rem]" : "h-20 lg:h-[5.25rem]"}`}>
        <a href="#top" aria-label={nav.home} className="relative z-[51] rounded-xl">
          <Logo locale={dict.locale} tone={scrolled && !open ? "light" : "dark"} idSuffix="header" />
        </a>

        <nav aria-label={dict.locale === "ar" ? "التنقل الرئيسي" : "Main navigation"} className="hidden lg:block">
          <ul role="list" className="flex items-center gap-1 xl:gap-2">
            {NAV_ORDER.map((key) => (
              <li key={key}>
                <a
                  href={`#${key}`}
                  aria-current={active === key ? "location" : undefined}
                  className={`group relative rounded-full px-3 py-2 text-[0.95rem] font-semibold transition-colors xl:px-3.5 ${
                    scrolled
                      ? active === key ? "text-brand-600" : "text-brand-950/80 hover:text-brand-600"
                      : active === key ? "text-white" : "text-white/80 hover:text-white"
                  }`}
                >
                  {nav.links[key]}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-3 -bottom-0.5 h-0.5 origin-center scale-x-0 rounded-full bg-accent-500 transition-transform duration-500 ease-out-expo group-hover:scale-x-100 ${
                      active === key ? "scale-x-100" : ""
                    }`}
                  />
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href={nav.language.href}
            hrefLang={nav.language.hrefLang}
            lang={nav.language.hrefLang}
            aria-label={nav.language.aria}
            prefetch={false}
            className={`hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold transition-colors sm:inline-flex ${
              scrolled ? "text-brand-700 hover:bg-brand-50" : "text-white/90 hover:bg-white/10"
            }`}
          >
            <Globe2 className="size-4" strokeWidth={1.8} aria-hidden="true" />
            {nav.language.label}
          </Link>

          <a
            href={whatsappUrl(dict.general.whatsappText)}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden h-11 items-center gap-2 rounded-full bg-accent-500 px-5 text-[0.95rem] font-bold text-brand-950 transition-[background-color,box-shadow,transform] duration-300 hover:bg-accent-400 hover:shadow-glow motion-safe:hover:-translate-y-0.5 lg:inline-flex"
          >
            <WhatsAppIcon className="size-5" />
            {nav.cta}
            <span className="sr-only">{dict.general.opensInNewTab}</span>
          </a>

          <button
            ref={toggleRef}
            type="button"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? nav.close : nav.menu}
            onClick={() => setOpen((v) => !v)}
            className={`relative z-[51] grid size-11 place-items-center rounded-full border transition-colors lg:hidden ${
              scrolled && !open ? "border-brand-100 text-brand-950 hover:bg-brand-50" : "border-white/25 text-white hover:bg-white/10"
            }`}
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={nav.menu}
        hidden={!open}
        onKeyDown={onPanelKeyDown}
        className="surface-dark fixed inset-0 z-50 overflow-y-auto bg-brand-950 lg:hidden"
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_100%_0%,rgb(8_102_178/0.55),transparent_60%),radial-gradient(40rem_30rem_at_0%_100%,rgb(245_130_32/0.14),transparent_60%)]" />
        <div className="container-site relative flex min-h-full flex-col pt-28 pb-10">
          <nav aria-label={dict.locale === "ar" ? "قائمة التنقل" : "Menu navigation"}>
            <ol role="list" className="flex flex-col">
              {NAV_ORDER.map((key, i) => (
                <li key={key} className="border-b border-white/10 motion-safe:animate-[menu-in_0.7s_var(--ease-out-expo)_both]" style={{ animationDelay: `${60 + i * 55}ms` }}>
                  <a
                    href={`#${key}`}
                    onClick={(e) => onMenuLink(e, `#${key}`)}
                    className="flex items-baseline justify-between gap-4 py-4 text-[1.75rem] font-extrabold text-white transition-colors hover:text-accent-300"
                  >
                    {nav.links[key]}
                    <span aria-hidden="true" className="num text-sm font-semibold text-white/40">
                      {formatIndex(i + 1, dict.locale)}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-auto grid gap-3 pt-10 sm:grid-cols-2">
            <a
              href={whatsappUrl(dict.general.whatsappText)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-13 items-center justify-center gap-2 rounded-full bg-accent-500 font-bold text-brand-950"
            >
              <WhatsAppIcon className="size-5" />
              {nav.cta}
              <span className="sr-only">{dict.general.opensInNewTab}</span>
            </a>
            <a href={telUrl} className="flex h-13 items-center justify-center gap-2 rounded-full border border-white/25 font-bold text-white">
              <Phone className="size-5" aria-hidden="true" />
              <span dir="ltr" className="num">
                {site.phone.display}
              </span>
            </a>
            <Link
              href={nav.language.href}
              hrefLang={nav.language.hrefLang}
              lang={nav.language.hrefLang}
              prefetch={false}
              className="flex h-12 items-center justify-center gap-2 rounded-full text-sm font-bold text-white/80 hover:text-white sm:col-span-2"
            >
              <Globe2 className="size-4" aria-hidden="true" />
              {nav.language.label}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
