"use client";

import { useEffect, useRef } from "react";
import { gsap, MOTION_OK, ScrollTrigger } from "@/lib/gsap";
import { trackProgramViewAction } from "@/server/actions/leads";

/** Counts one view per browser session (bots that don't run JavaScript are not counted). */
export function ViewTracker({ programId }: { programId: number }) {
  useEffect(() => {
    const key = `etijah:viewed:${programId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* storage blocked: still count */
    }
    void trackProgramViewAction(programId);
  }, [programId]);
  return null;
}

/**
 * The itinerary's vertical line fills as the reader scrolls through the days — a quiet
 * progress cue on long programs. Static (fully drawn) with reduced motion.
 */
export function ItineraryProgress({ targetId }: { targetId: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const line = ref.current;
    const target = document.getElementById(targetId);
    if (!line || !target) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      gsap.fromTo(
        line,
        { scaleY: 0 },
        { scaleY: 1, ease: "none", scrollTrigger: { trigger: target, start: "top 70%", end: "bottom 60%", scrub: 0.6 } },
      );
    });
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);
    return () => {
      window.removeEventListener("load", refresh);
      mm.revert();
    };
  }, [targetId]);
  return <span ref={ref} aria-hidden="true" className="absolute inset-y-2 start-[1.2rem] w-0.5 origin-top rounded-full bg-linear-to-b from-accent-500 to-brand-500" />;
}
