"use client";

import { useEffect, useRef, useState } from "react";
import { PLANE_PATH } from "@/components/ui/icons";
import type { Locale } from "@/content/site";
import { formatIndex } from "@/lib/format";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";

interface Step {
  title: string;
  text: string;
}

const ROUTE_H = 64;

/** Wave route through the centres of N equal columns, ordered by reading direction. */
function buildRoute(width: number, count: number, rtl: boolean) {
  const xs = Array.from({ length: count }, (_, i) => ((2 * i + 1) / (2 * count)) * width).map((x) => (rtl ? width - x : x));
  const mid = ROUTE_H / 2;
  let d = `M${xs[0]} ${mid}`;
  for (let i = 1; i < xs.length; i++) {
    const cx = (xs[i - 1] + xs[i]) / 2;
    const lift = i % 2 ? -mid * 1.25 : mid * 1.25;
    d += ` Q${cx} ${mid + lift} ${xs[i]} ${mid}`;
  }
  return d;
}

export function ProcessTimeline({ steps, locale, stepLabel }: { steps: Step[]; locale: Locale; stepLabel: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const routeBoxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const rtl = locale === "ar";

  useEffect(() => {
    const box = routeBoxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const d = width ? buildRoute(width, steps.length, rtl) : "";

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;
      const nodes = gsap.utils.toArray<HTMLElement>("[data-step]", root);
      const setActive = (progress: number) =>
        nodes.forEach((node, i) => node.toggleAttribute("data-active", progress >= i / Math.max(1, nodes.length - 1) - 0.02));

      const mm = gsap.matchMedia();

      // Desktop: plane flies the wave route while the line draws in.
      mm.add(`${MOTION_OK} and (min-width: 64rem)`, () => {
        const route = root.querySelector<SVGPathElement>("[data-route-progress]");
        const plane = root.querySelector<SVGGElement>("[data-route-plane]");
        if (!route || !plane || !d) return;
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: root,
            start: "top 72%",
            end: "bottom 62%",
            scrub: 0.8,
            onUpdate: (self) => setActive(self.progress),
          },
        });
        tl.fromTo(route, { drawSVG: "0%" }, { drawSVG: "100%" }, 0)
          .fromTo(plane, { opacity: 0 }, { opacity: 1, duration: 0.06 }, 0)
          .to(plane, { motionPath: { path: route, align: route, alignOrigin: [0.5, 0.5], autoRotate: true }, duration: 1 }, 0);
        setActive(0);
      });

      // Stacked layout: a vertical progress line fills as the steps scroll past.
      mm.add(`${MOTION_OK} and (max-width: 63.99rem)`, () => {
        const fill = root.querySelector("[data-line-fill]");
        if (!fill) return;
        gsap.fromTo(
          fill,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: { trigger: root, start: "top 70%", end: "bottom 70%", scrub: 0.6, onUpdate: (self) => setActive(self.progress) },
          },
        );
        setActive(0);
      });

      // Reduced motion: everything is simply shown as complete.
      mm.add("(prefers-reduced-motion: reduce)", () => setActive(1));

      return () => mm.revert();
    },
    { scope: rootRef, dependencies: [d], revertOnUpdate: true },
  );

  return (
    <div ref={rootRef} className="relative mt-16 lg:mt-20">
      {/* Desktop route */}
      <div ref={routeBoxRef} aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 hidden h-16 lg:block">
        {d ? (
          <svg width={width} height={ROUTE_H} viewBox={`0 0 ${width} ${ROUTE_H}`} className="overflow-visible">
            <defs>
              <linearGradient id="process-grad" x1={rtl ? "1" : "0"} x2={rtl ? "0" : "1"} y1="0" y2="0">
                <stop offset="0" stopColor="#0866B2" />
                <stop offset="1" stopColor="#F58220" />
              </linearGradient>
            </defs>
            <path d={d} fill="none" stroke="#B3D5F2" strokeWidth="1.6" className="route-dash" />
            <path data-route-progress d={d} fill="none" stroke="url(#process-grad)" strokeWidth="2.5" strokeLinecap="round" />
            <g data-route-plane opacity="0" fill="#0866B2">
              <path d={PLANE_PATH} transform="scale(1.25)" />
            </g>
          </svg>
        ) : null}
      </div>

      {/* Stacked-layout line */}
      <div aria-hidden="true" className="absolute top-8 bottom-8 w-0.5 rounded-full bg-brand-100 lg:hidden ltr:left-8 rtl:right-8">
        <div data-line-fill className="h-full w-full origin-top rounded-full bg-linear-to-b from-brand-600 to-accent-500" />
      </div>

      <ol role="list" className="relative grid gap-10 lg:grid-cols-4 lg:gap-0">
        {steps.map((step, i) => (
          <li key={step.title} data-step className="group relative flex gap-6 lg:flex-col lg:items-center lg:gap-0 lg:px-5 lg:text-center">
            <span className="relative z-10 grid size-16 shrink-0 place-items-center rounded-full border-2 border-brand-100 bg-white text-xl font-black text-brand-600 shadow-soft transition-[background-color,border-color,color,box-shadow] duration-500 group-data-active:border-brand-600 group-data-active:bg-brand-600 group-data-active:text-white group-data-active:shadow-lift">
              <span className="sr-only">
                {stepLabel} {i + 1}:
              </span>
              <span aria-hidden="true" className="num">
                {formatIndex(i + 1, locale)}
              </span>
              <span
                aria-hidden="true"
                className="absolute -top-0.5 size-3.5 scale-0 rounded-full border-2 border-white bg-accent-500 transition-transform duration-500 group-data-active:scale-100 ltr:-right-0.5 rtl:-left-0.5"
              />
            </span>
            <div className="pt-2 lg:pt-8">
              <h3 className="text-xl font-bold text-brand-950">{step.title}</h3>
              <p className="mt-2.5 leading-[1.95] text-muted lg:mx-auto lg:max-w-[16rem]">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
