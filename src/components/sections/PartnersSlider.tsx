"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { gsap, MOTION_OK, ScrollTrigger } from "@/lib/gsap";

export interface PartnerCard {
  id: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Logo width as a share of its card (see partnerLogoWidth). */
  logoWidth: string;
}

interface PartnersSliderProps {
  rows: PartnerCard[][];
  rtl: boolean;
  labels: { pause: string; play: string };
  /** Section heading, laid out beside the pause button. */
  children: ReactNode;
}

/**
 * Minimum cards in one loop period. At the largest card size (14rem + gutter) this keeps a
 * period wider than the widest lane (120rem), so the loop never shows a gap.
 */
const MIN_PERIOD_CARDS = 10;
/** Cruising speed in CSS px per second. */
const SPEED = 38;

interface Lane {
  el: HTMLElement;
  track: HTMLElement;
  /** +1 travels right, -1 travels left. */
  dir: number;
  x: number;
  /** Width of one loop period in px. */
  period: number;
  /** 0 = stopped … 1 = cruising. Eased, so stops and starts are never abrupt. */
  play: number;
  hover: boolean;
  drag: { id: number; lastX: number; lastT: number; v: number } | null;
  /** Leftover velocity (px/s) from a flick or the entrance; decays to zero. */
  fling: number;
}

/**
 * Infinite two-row logo slider. Rows glide in opposite directions, speed up and follow the
 * page's scroll direction, ease to a stop under the mouse, and can be dragged or flicked.
 * The pause button stops all automatic motion (WCAG 2.2.2). With reduced motion the rows
 * render as a static, wrapped grid without the duplicate logos.
 */
export function PartnersSlider({ rows, rtl, labels, children }: PartnersSliderProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const mm = gsap.matchMedia();

    mm.add(MOTION_OK, () => {
      const lanes: Lane[] = gsap.utils.toArray<HTMLElement>("[data-lane]", root).map((el, i) => ({
        el,
        track: el.querySelector<HTMLElement>("[data-track]")!,
        // The top row travels with the reading direction (rightwards in Arabic), the next against it.
        dir: (rtl ? 1 : -1) * (i % 2 ? -1 : 1),
        x: 0,
        period: 0,
        play: 0,
        hover: false,
        drag: null,
        fling: 0,
      }));

      const measure = () => {
        for (const lane of lanes) {
          const items = lane.track.children;
          const first = items[0] as HTMLElement | undefined;
          const twin = items[items.length / 2] as HTMLElement | undefined;
          lane.period = first && twin ? Math.abs(twin.offsetLeft - first.offsetLeft) : 0;
        }
      };
      measure();
      const resize = new ResizeObserver(measure);
      lanes.forEach((lane) => resize.observe(lane.track));

      // Copies follow the original in reading order: to its left in RTL, to its right in LTR.
      const wrap = (lane: Lane) => {
        if (lane.period) lane.x = rtl ? gsap.utils.wrap(0, lane.period, lane.x) : gsap.utils.wrap(-lane.period, 0, lane.x);
      };

      let visible = false;
      let entered = false;
      let boost = 0;
      let boostTarget = 0;
      let flow = 1;
      let flowTarget = 1;

      const setVisible = (active: boolean) => {
        visible = active;
        if (!active || entered) return;
        entered = true;
        // Duplicates start lazy; fetch them now (same URLs, so this hits the cache).
        root.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => (img.loading = "eager"));
        // Entrance: the rows sweep in from opposite sides, then settle to cruising speed.
        lanes.forEach((lane) => (lane.fling = lane.dir * 900));
      };

      const trigger = ScrollTrigger.create({
        trigger: root,
        start: "top bottom",
        end: "bottom top",
        onToggle: (self) => setVisible(self.isActive),
        onUpdate: (self) => {
          boostTarget = Math.min(Math.abs(self.getVelocity()) / 400, 4);
          flowTarget = self.direction;
        },
      });
      setVisible(trigger.isActive);

      const tick = (_time: number, deltaMs: number) => {
        if (!visible) return;
        const dt = Math.min(deltaMs, 50) / 1000;
        const approach = (rate: number) => 1 - Math.exp(-rate * dt);
        boostTarget -= boostTarget * approach(2.5);
        boost += (boostTarget - boost) * approach(6);
        flow += (flowTarget - flow) * approach(2.5);

        const paused = pausedRef.current;
        for (const lane of lanes) {
          const cruising = !paused && !lane.hover && !lane.drag;
          lane.play += (Number(cruising) - lane.play) * approach(cruising ? 2.2 : paused ? 6 : 4);
          // Exponential easing never quite reaches zero: snap, so a stop is a real standstill.
          if (!cruising && lane.play < 0.01) lane.play = 0;
          if (!lane.drag) {
            lane.x += (lane.dir * SPEED * flow * (1 + boost) * lane.play + lane.fling) * dt;
            lane.fling -= lane.fling * approach(paused ? 6 : 3);
            if (Math.abs(lane.fling) < 1) lane.fling = 0;
          }
          wrap(lane);
          lane.track.style.transform = `translate3d(${lane.x.toFixed(2)}px, 0, 0)`;
        }
      };
      gsap.ticker.add(tick);

      const listeners: [HTMLElement, string, EventListener][] = [];
      const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, fn: (event: HTMLElementEventMap[K]) => void) => {
        el.addEventListener(type, fn as EventListener);
        listeners.push([el, type, fn as EventListener]);
      };

      for (const lane of lanes) {
        on(lane.el, "pointerenter", (e) => {
          if (e.pointerType === "mouse") lane.hover = true;
        });
        on(lane.el, "pointerleave", (e) => {
          if (e.pointerType === "mouse") lane.hover = false;
        });
        on(lane.el, "pointerdown", (e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          lane.drag = { id: e.pointerId, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
          lane.fling = 0;
          lane.el.setPointerCapture(e.pointerId);
        });
        on(lane.el, "pointermove", (e) => {
          const drag = lane.drag;
          if (!drag || e.pointerId !== drag.id) return;
          const dx = e.clientX - drag.lastX;
          lane.x += dx;
          drag.v = drag.v * 0.5 + (dx / Math.max(e.timeStamp - drag.lastT, 1)) * 1000 * 0.5;
          drag.lastX = e.clientX;
          drag.lastT = e.timeStamp;
        });
        const release = (e: PointerEvent) => {
          const drag = lane.drag;
          if (!drag || e.pointerId !== drag.id) return;
          // A flick keeps gliding; letting go after holding still (or a cancelled touch) does not.
          const flicked = e.type === "pointerup" && e.timeStamp - drag.lastT < 80;
          lane.fling = flicked ? gsap.utils.clamp(-2400, 2400, drag.v) : 0;
          lane.drag = null;
        };
        on(lane.el, "pointerup", release);
        on(lane.el, "pointercancel", release);
      }

      return () => {
        gsap.ticker.remove(tick);
        resize.disconnect();
        listeners.forEach(([el, type, fn]) => el.removeEventListener(type, fn));
        lanes.forEach((lane) => (lane.track.style.transform = ""));
      };
    });

    return () => mm.revert();
  }, [rtl]);

  return (
    <div ref={rootRef} className="relative">
      <div className="container-site">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          {children}
          <button
            type="button"
            data-reveal
            onClick={() => setPaused((p) => !p)}
            className="group inline-flex h-11 shrink-0 items-center gap-2.5 self-start rounded-full border border-brand-100 bg-white ps-2 pe-5 text-sm font-bold text-brand-800 shadow-soft transition-colors hover:border-brand-600 hover:text-brand-600 motion-reduce:hidden lg:self-auto"
          >
            <span className="grid size-7 place-items-center rounded-full bg-brand-600 text-white transition-colors group-hover:bg-accent-500 group-hover:text-brand-950">
              {paused ? (
                <Play className="size-3.5 translate-x-px rtl:-translate-x-px rtl:-scale-x-100" fill="currentColor" aria-hidden="true" />
              ) : (
                <Pause className="size-3.5" fill="currentColor" aria-hidden="true" />
              )}
            </span>
            {paused ? labels.play : labels.pause}
          </button>
        </div>
      </div>

      {/* With reduced motion, lanes and tracks dissolve (display: contents) into one centred, wrapped grid. */}
      <div className="mx-auto mt-12 flex max-w-[120rem] flex-col sm:mt-14 lg:mt-16 motion-reduce:max-w-[78rem] motion-reduce:flex-row motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-y-4 motion-reduce:px-3">
        {rows.map((row, r) => {
          // Short rows repeat inside a period; the whole period is then doubled for the seamless loop.
          const copies = Math.ceil(MIN_PERIOD_CARDS / row.length) * 2;
          return (
            <div
              key={r}
              data-lane
              data-reveal
              className="touch-pan-y overflow-hidden py-4 select-none [mask-image:linear-gradient(90deg,transparent,#000_9%,#000_91%,transparent)] motion-safe:cursor-grab motion-safe:active:cursor-grabbing motion-reduce:contents"
            >
              <ul role="list" data-track className="flex w-max will-change-transform motion-reduce:contents">
                {Array.from({ length: copies }, (_, copy) =>
                  row.map((card) => <LogoCard key={`${copy}-${card.id}`} card={card} duplicate={copy > 0} />),
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LogoCard({ card, duplicate }: { card: PartnerCard; duplicate: boolean }) {
  return (
    <li aria-hidden={duplicate || undefined} data-duplicate={duplicate || undefined} className={`shrink-0 px-2 sm:px-2.5 ${duplicate ? "motion-reduce:hidden" : ""}`}>
      <div className="group/logo relative grid aspect-[20/9] w-[10.5rem] place-items-center overflow-hidden rounded-2xl border border-line bg-white shadow-soft transition-[border-color,box-shadow,transform] duration-500 ease-out-expo hover:border-brand-200 hover:shadow-[0_16px_32px_-20px_rgb(8_102_178/0.45)] motion-safe:hover:-translate-y-1 sm:w-[12.5rem] lg:w-[14rem]">
        {/* Pre-optimised by scripts/build-partners.mjs; the static export has no image optimizer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={card.src}
          width={card.width}
          height={card.height}
          alt={duplicate ? "" : card.alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          style={{ width: card.logoWidth }}
          className="h-auto max-w-none transition-transform duration-700 ease-out-expo group-hover/logo:scale-[1.06]"
        />
        {/* Light sweep + accent underline on hover */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 -left-[70%] w-1/2 bg-linear-to-r from-transparent via-white/80 to-transparent group-hover/logo:animate-logo-sheen" />
        <span aria-hidden="true" className="absolute inset-x-8 bottom-0 h-0.5 origin-center scale-x-0 rounded-full bg-accent-500 transition-transform duration-500 ease-out-expo group-hover/logo:scale-x-100" />
      </div>
    </li>
  );
}
