import type { ReactNode } from "react";
import { FloatingWhatsApp } from "@/components/layout/FloatingWhatsApp";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import type { Dictionary } from "@/content/types";

/** Header, footer and floating WhatsApp around the travel pages (programs, hotels). */
export function TravelShell({ dict, languageHref, children, floating = true }: { dict: Dictionary; languageHref: string; children: ReactNode; floating?: boolean }) {
  return (
    <>
      <SiteHeader dict={dict} page={{ languageHref, current: "offers" }} />
      <main id="main" tabIndex={-1} className="bg-mist">
        {children}
      </main>
      <SiteFooter dict={dict} page />
      {/* Program pages have their own sticky booking bar with WhatsApp on mobile. */}
      {floating ? <FloatingWhatsApp dict={dict} /> : null}
    </>
  );
}

/** Decorative dashed flight route used behind dark heroes (matches the home page motif). */
export function RouteLines({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 1200 400" preserveAspectRatio="none" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}>
      <path d="M-20 330 C 260 120, 520 380, 780 170 S 1120 60, 1240 120" fill="none" stroke="rgb(245 130 32 / 0.55)" strokeWidth="1.5" className="route-dash route-flow" />
      <path d="M-20 380 C 300 260, 640 420, 900 260 S 1180 220, 1240 260" fill="none" stroke="rgb(255 255 255 / 0.18)" strokeWidth="1" className="route-dash" />
    </svg>
  );
}
