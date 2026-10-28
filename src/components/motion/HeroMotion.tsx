"use client";

import { useRef, type ReactNode } from "react";
import { gsap, MOTION_OK, ScrollTrigger, useGSAP } from "@/lib/gsap";

/**
 * Hero motion that needs JavaScript: a plane with a contrail looping along the flight
 * path (paused while the hero is off-screen) and scroll parallax. The entrance itself
 * is pure CSS (globals.css) so content never waits on this script.
 */
export function HeroMotion({ children, labelledBy }: { children: ReactNode; labelledBy: string }) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const mm = gsap.matchMedia();

      mm.add(MOTION_OK, () => {
        const q = gsap.utils.selector(root);

        const route = q<SVGPathElement>("[data-route='main']")[0];
        const plane = q("[data-plane]")[0];
        const trail = q("[data-trail]")[0];
        const loop = gsap.timeline({ repeat: -1, repeatDelay: 2.2, paused: true, delay: 1.6 });
        if (route && plane && trail) {
          const duration = 12;
          loop
            .set([plane, trail], { opacity: 1 })
            .to(
              plane,
              { motionPath: { path: route, align: route, alignOrigin: [0.5, 0.5], autoRotate: true }, duration, ease: "none" },
              0,
            )
            .fromTo(trail, { drawSVG: "0% 0%" }, { drawSVG: "78% 100%", duration, ease: "none" }, 0)
            .to([plane, trail], { opacity: 0, duration: 1.2, ease: "power1.in" }, duration - 1.2);
        }

        const visibility = ScrollTrigger.create({
          trigger: root,
          start: "top top",
          end: "bottom top",
          onToggle: (self) => (self.isActive ? loop.play() : loop.pause()),
        });
        if (visibility.isActive) loop.play();

        // Scroll-out parallax: image drifts slower than the page, copy lifts and fades.
        const scrub = { trigger: root, start: "top top", end: "bottom top", scrub: true };
        gsap.to(q("[data-hero-media]"), { yPercent: 16, ease: "none", scrollTrigger: scrub });
        gsap.to(q("[data-hero-content]"), { y: -70, opacity: 0.15, ease: "none", scrollTrigger: scrub });
      });

      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <section
      ref={ref}
      id="top"
      aria-labelledby={labelledBy}
      className="surface-dark relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-brand-950"
    >
      {children}
    </section>
  );
}
