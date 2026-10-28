"use client";

// Single place to register GSAP plugins; import gsap from here in client components.
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger, MotionPathPlugin, DrawSVGPlugin);
  gsap.defaults({ ease: "power3.out", duration: 0.9 });
}

// Dev-only handle so tests can assert animations are not duplicated under StrictMode.
if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  (window as unknown as { __gsap: unknown }).__gsap = { gsap, ScrollTrigger };
}

/** Media query used with gsap.matchMedia(): animations only run when motion is welcome. */
export const MOTION_OK = "(prefers-reduced-motion: no-preference)";

export { gsap, ScrollTrigger, useGSAP };
