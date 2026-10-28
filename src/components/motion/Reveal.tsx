"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef, type ElementType } from "react";
import { gsap, MOTION_OK, ScrollTrigger } from "@/lib/gsap";

type RevealProps<T extends ElementType> = {
  as?: T;
} & ComponentPropsWithoutRef<T>;

/** Runs `fn` when the main thread is idle (bounded), keeping setup off the hydration path. */
function whenIdle(fn: () => void) {
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(fn, { timeout: 1500 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(fn, 200);
  return () => clearTimeout(id);
}

/** True when the element starts below the fold, i.e. hiding it now cannot cause a visible flash. */
const belowFold = (el: Element) => el.getBoundingClientRect().top > window.innerHeight * 0.92;

/**
 * Wraps server-rendered markup and animates descendants by data attribute:
 *  - [data-reveal]        fade/slide up when scrolled into view (batched + staggered)
 *  - [data-reveal-image]  clip-path "window" reveal; its <img> settles from a zoom
 *  - [data-parallax="n"]  gentle scrubbed parallax of ±n% while the parent crosses the viewport
 * Content already on screen is never hidden, nothing is hidden without motion consent,
 * and everything is reverted on unmount.
 */
export function Reveal<T extends ElementType = "div">({ as, children, ...rest }: RevealProps<T>) {
  const Tag: ElementType = as ?? "div";
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let mm: gsap.MatchMedia | null = null;

    const cancel = whenIdle(() => {
      mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const items = gsap.utils.toArray<HTMLElement>("[data-reveal]", root).filter(belowFold);
        if (items.length) {
          gsap.set(items, { opacity: 0, y: 34 });
          const show = (batch: Element[]) =>
            gsap.to(batch, { opacity: 1, y: 0, duration: 1, stagger: 0.085, overwrite: true });
          ScrollTrigger.batch(items, { start: "top 90%", once: true, onEnter: show, onLeave: show, onEnterBack: show });
        }

        gsap.utils
          .toArray<HTMLElement>("[data-reveal-image]", root)
          .filter(belowFold)
          .forEach((frame) => {
            const img = frame.querySelector("img");
            const tl = gsap.timeline({ scrollTrigger: { trigger: frame, start: "top 85%", once: true } });
            tl.fromTo(
              frame,
              { clipPath: "inset(14% 10% 14% 10% round 2rem)" },
              { clipPath: "inset(0% 0% 0% 0% round 2rem)", duration: 1.5, ease: "expo.out", clearProps: "clipPath" },
            );
            // No clearProps here: it would also wipe a parallax transform on the same image.
            if (img) tl.fromTo(img, { scale: 1.22 }, { scale: 1, duration: 1.8, ease: "expo.out" }, 0);
          });

        gsap.utils.toArray<HTMLElement>("[data-parallax]", root).forEach((el) => {
          const amount = Number(el.dataset.parallax) || 8;
          gsap.fromTo(
            el,
            { yPercent: -amount },
            {
              yPercent: amount,
              ease: "none",
              scrollTrigger: { trigger: el.parentElement ?? el, start: "top bottom", end: "bottom top", scrub: true },
            },
          );
        });
      });
    });

    return () => {
      cancel();
      mm?.revert();
    };
  }, []);

  return (
    <Tag ref={ref} {...rest}>
      {children}
    </Tag>
  );
}
