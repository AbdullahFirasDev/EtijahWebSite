"use client";

import Lenis from "lenis";
import { useEffect } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { scrollToHash, setLenis } from "@/lib/scroll";

/**
 * Lenis smooth scrolling (desktop pointers only, never with reduced motion), driven by
 * GSAP's ticker so ScrollTrigger stays in sync. Also routes same-page anchor clicks
 * through scrollToHash so every anchor lands below the fixed header.
 */
export function SmoothScroll() {
  useEffect(() => {
    const smooth =
      window.matchMedia("(prefers-reduced-motion: no-preference)").matches &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    let lenis: Lenis | null = null;
    const tick = (time: number) => lenis?.raf(time * 1000);

    if (smooth) {
      lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.95, autoRaf: false });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      setLenis(lenis);
    }

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href*='#']");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank") return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || !url.hash) return;
      event.preventDefault();
      scrollToHash(url.hash);
    };
    document.addEventListener("click", onClick);

    // ScrollTrigger re-measures on window load itself; only fonts that settle later need a refresh.
    document.fonts?.ready.then(() => document.readyState === "complete" && ScrollTrigger.refresh()).catch(() => {});

    return () => {
      document.removeEventListener("click", onClick);
      gsap.ticker.remove(tick);
      if (lenis) gsap.ticker.lagSmoothing(500, 33);
      lenis?.destroy();
      setLenis(null);
    };
  }, []);

  return null;
}
