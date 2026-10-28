import { Headset, MessagesSquare, Route, UserCheck, type LucideIcon } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { Picture } from "@/components/ui/Picture";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { Dictionary } from "@/content/types";

const ICONS: LucideIcon[] = [Headset, UserCheck, MessagesSquare, Route];

export function WhyEtijah({ dict }: { dict: Dictionary }) {
  const { why } = dict;
  return (
    <Reveal as="section" id="why" aria-labelledby="why-title" className="relative overflow-hidden bg-white py-24 sm:py-32">
      <div className="container-site grid items-center gap-14 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-6 xl:col-span-6">
          <SectionHeading id="why-title" eyebrow={why.eyebrow} title={why.title} lead={why.lead} />

          <ul role="list" className="mt-12 grid gap-x-8 gap-y-9 sm:grid-cols-2">
            {why.items.map((item, i) => {
              const Icon = ICONS[i % ICONS.length];
              return (
                <li key={item.title} data-reveal className="group">
                  <span className="relative grid size-13 place-items-center rounded-2xl border border-brand-100 bg-white text-brand-600 shadow-soft transition-[background-color,color,border-color] duration-500 group-hover:border-brand-600 group-hover:bg-brand-600 group-hover:text-white">
                    <Icon className="size-6" strokeWidth={1.7} aria-hidden="true" />
                    <span aria-hidden="true" className="absolute -top-1 size-3 rounded-full border-2 border-white bg-accent-500 ltr:-right-1 rtl:-left-1" />
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-brand-950 sm:text-xl">{item.title}</h3>
                  <p className="mt-2.5 leading-[1.95] text-muted">{item.text}</p>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="relative lg:col-span-6 xl:col-span-5 xl:col-start-8">
          {/* Decorative orbit + route behind the photo */}
          <svg aria-hidden="true" viewBox="0 0 520 620" fill="none" className="pointer-events-none absolute -inset-8 h-[calc(100%+4rem)] w-[calc(100%+4rem)] text-brand-200">
            <ellipse cx="260" cy="310" rx="250" ry="300" stroke="currentColor" strokeOpacity="0.6" className="route-dash" strokeWidth="1.5" />
          </svg>

          <div data-reveal-image className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-brand-100 shadow-lift">
            <div data-parallax="6" className="absolute -inset-y-[8%] inset-x-0">
              <Picture
                name="why-traveler"
                alt={why.imageAlt}
                sizes="(min-width: 1280px) 34rem, (min-width: 1024px) 45vw, 90vw"
                className="h-full w-full object-cover object-[50%_45%]"
              />
            </div>
            <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-brand-950/45 via-transparent to-transparent" />
          </div>

          <div
            data-reveal
            className="absolute -bottom-7 flex items-center gap-4 rounded-2xl border border-white/60 bg-white/90 p-4 pe-6 shadow-lift backdrop-blur-xl ltr:-left-4 rtl:-right-4 sm:-bottom-8 sm:p-5 sm:pe-7 lg:ltr:-left-10 lg:rtl:-right-10"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-500 text-brand-950">
              <Route className="size-6" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span className="font-bold text-brand-950">{why.badgeTitle}</span>
              <span className="text-sm text-muted">{why.badgeText}</span>
            </span>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
