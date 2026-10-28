"use client";

import { ExternalLink, MapPin } from "lucide-react";
import { useState } from "react";
import { site } from "@/content/site";
import type { Dictionary } from "@/content/types";

/**
 * Click-to-load Google Map. Nothing is requested from Google until the visitor asks,
 * which keeps the page fast and avoids third-party requests by default.
 */
export function MapEmbed({ dict }: { dict: Dictionary }) {
  const { map } = dict.contact;
  const [loaded, setLoaded] = useState(false);
  const src = `https://www.google.com/maps?q=${site.maps.lat},${site.maps.lng}&z=17&hl=${dict.locale}&output=embed`;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-brand-50">
      {loaded ? (
        <iframe
          title={map.title}
          src={src}
          className="block aspect-[4/3] w-full border-0 sm:aspect-[16/10]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      ) : (
        <div className="relative grid aspect-[4/3] place-items-center p-6 text-center sm:aspect-[16/10]">
          {/* Stylised street grid as a lightweight stand-in for the map. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-70 [background-image:linear-gradient(rgb(8_102_178/0.07)_1px,transparent_1px),linear-gradient(90deg,rgb(8_102_178/0.07)_1px,transparent_1px)] [background-size:28px_28px]"
          />
          <svg aria-hidden="true" viewBox="0 0 400 250" preserveAspectRatio="none" className="absolute inset-0 h-full w-full text-white">
            <path d="M-10 170 C 90 150, 160 190, 410 120" stroke="currentColor" strokeWidth="14" fill="none" />
            <path d="M120 -10 C 140 80, 110 160, 160 260" stroke="currentColor" strokeWidth="10" fill="none" />
            <path d="M260 -10 L 300 260" stroke="currentColor" strokeWidth="7" fill="none" />
          </svg>
          <div className="relative flex flex-col items-center">
            <span className="relative grid size-14 place-items-center rounded-full bg-brand-600 text-white shadow-lift">
              <span aria-hidden="true" className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-500" />
              <MapPin className="relative size-6" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <button
              type="button"
              onClick={() => setLoaded(true)}
              className="mt-5 inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-bold text-brand-700 shadow-soft transition-colors hover:bg-brand-600 hover:text-white"
            >
              {map.load}
            </button>
            <p className="mt-3 text-xs text-muted">{map.note}</p>
          </div>
        </div>
      )}
      <a
        href={site.maps.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between gap-3 border-t border-line bg-white px-5 py-3.5 text-sm font-bold text-brand-700 transition-colors hover:bg-brand-50"
      >
        {map.open}
        <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
        <span className="sr-only">{dict.general.opensInNewTab}</span>
      </a>
    </div>
  );
}
