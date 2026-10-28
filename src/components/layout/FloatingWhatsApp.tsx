"use client";

import { useEffect, useState } from "react";
import { WhatsAppIcon } from "@/components/ui/icons";
import { whatsappUrl } from "@/content/site";
import type { Dictionary } from "@/content/types";

/**
 * WhatsApp shortcut pinned to the inline-end corner (left in RTL). It appears once the
 * hero — which already has WhatsApp actions — has scrolled away.
 */
export function FloatingWhatsApp({ dict }: { dict: Dictionary }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setVisible(window.scrollY > window.innerHeight * 0.6);
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

  return (
    <a
      href={whatsappUrl(dict.general.whatsappText)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${dict.floating.label} ${dict.general.opensInNewTab}`}
      inert={!visible}
      className={`group fixed end-4 bottom-4 z-40 flex items-center gap-3 rounded-full bg-accent-500 p-1.5 text-brand-950 shadow-[0_14px_34px_-10px_rgb(5_28_51/0.55)] transition-[opacity,transform,background-color] duration-500 ease-out-expo hover:bg-accent-400 sm:end-6 sm:bottom-6 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 scale-90 opacity-0"
      }`}
    >
      <span className="relative grid size-12 place-items-center rounded-full bg-brand-950 text-white sm:size-13">
        <span aria-hidden="true" className="absolute inset-0 animate-pulse-ring rounded-full bg-accent-400" />
        <WhatsAppIcon className="relative size-6 sm:size-7" />
      </span>
      <span aria-hidden="true" className="hidden pe-4 font-bold sm:block">
        {dict.floating.text}
      </span>
    </a>
  );
}
