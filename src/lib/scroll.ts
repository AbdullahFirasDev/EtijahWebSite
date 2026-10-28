"use client";

import type Lenis from "lenis";

// The active Lenis instance (null when smooth scrolling is disabled: touch, reduced motion).
let lenis: Lenis | null = null;

export const setLenis = (instance: Lenis | null) => {
  lenis = instance;
};

/** Pause/resume page scrolling, e.g. while the mobile menu is open. */
export function lockScroll(locked: boolean) {
  if (locked) lenis?.stop();
  else lenis?.start();
  document.documentElement.style.overflow = locked ? "hidden" : "";
}

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Scrolls to an in-page anchor below the fixed header, updates the URL hash,
 * and moves keyboard focus to the target section for assistive technology.
 */
export function scrollToHash(hash: string) {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  const target = id && id !== "top" ? document.getElementById(id) : null;

  if (lenis) {
    // Lenis already subtracts the root scroll-padding-top (the fixed header height).
    lenis.scrollTo(target ?? 0, { duration: 1.35 });
  } else {
    const header = document.querySelector<HTMLElement>("[data-site-header]");
    const offset = (header?.offsetHeight ?? 72) - 1;
    const top = target ? target.getBoundingClientRect().top + window.scrollY - offset : 0;
    window.scrollTo({ top, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  history.pushState(null, "", id ? `#${id}` : window.location.pathname);

  if (target) {
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }
}
