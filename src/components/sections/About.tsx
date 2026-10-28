import { CircleCheck, MapPin } from "lucide-react";
import { GlobeStage } from "@/components/globe/GlobeStage";
import { Reveal } from "@/components/motion/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { site } from "@/content/site";
import type { Dictionary } from "@/content/types";

export function About({ dict }: { dict: Dictionary }) {
  const { about, contact } = dict;
  return (
    <Reveal
      as="section"
      id="about"
      aria-labelledby="about-title"
      className="relative overflow-hidden bg-linear-to-b from-white via-brand-50/70 to-white py-24 sm:py-32"
    >
      <div className="container-site grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeading id="about-title" eyebrow={about.eyebrow} title={about.title} />
          <div className="mt-6 space-y-5 text-[1.05rem] leading-[2] text-muted sm:text-lg">
            {about.paragraphs.map((p) => (
              <p key={p} data-reveal>
                {p}
              </p>
            ))}
          </div>

          <ul role="list" className="mt-8 flex flex-wrap gap-3">
            {about.highlights.map((h) => (
              <li
                key={h}
                data-reveal
                className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white px-4 py-2 text-sm font-semibold text-brand-800 shadow-soft"
              >
                <CircleCheck className="size-4 text-accent-600" strokeWidth={2} aria-hidden="true" />
                {h}
              </li>
            ))}
          </ul>

          <a
            data-reveal
            href={site.maps.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-10 flex max-w-lg items-start gap-4 rounded-2xl border border-line bg-white p-5 shadow-soft transition-[box-shadow,border-color] duration-500 hover:border-brand-200 hover:shadow-lift"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
              <MapPin className="size-6" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span className="font-bold text-brand-950">{about.visitTitle}</span>
              <span className="mt-1 leading-[1.8] text-muted">{contact.addressValue}</span>
              <span className="mt-2 text-sm font-bold text-brand-600 underline decoration-brand-200 underline-offset-4 group-hover:decoration-brand-600">
                {contact.addressAction}
              </span>
            </span>
            <span className="sr-only">{dict.general.opensInNewTab}</span>
          </a>
        </div>

        <figure className="relative">
          <GlobeStage label={about.globeLabel} />
          <figcaption className="mt-2 flex items-center justify-center gap-5 text-sm font-semibold text-muted">
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-accent-500 ring-4 ring-accent-100" />
              {about.globeCaption}
            </span>
          </figcaption>
        </figure>
      </div>
    </Reveal>
  );
}
