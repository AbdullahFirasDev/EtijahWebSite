import { ArrowLeft, BadgeCheck, ConciergeBell, PlaneTakeoff, ShieldPlus, Stamp, TreePalm, type LucideIcon } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { WhatsAppIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { whatsappUrl, type ServiceId } from "@/content/site";
import type { Dictionary } from "@/content/types";
import { formatIndex } from "@/lib/format";

export const SERVICE_ICONS: Record<ServiceId, LucideIcon> = {
  flights: PlaneTakeoff,
  visa: Stamp,
  insurance: ShieldPlus,
  approvals: BadgeCheck,
  tours: TreePalm,
  other: ConciergeBell,
};

export function Services({ dict }: { dict: Dictionary }) {
  const { services } = dict;
  return (
    <Reveal as="section" id="services" aria-labelledby="services-title" className="relative overflow-hidden bg-mist py-24 sm:py-32">
      <svg aria-hidden="true" className="pointer-events-none absolute -top-10 h-[28rem] w-[60rem] text-brand-200 ltr:-right-80 rtl:-left-80" viewBox="0 0 960 448" fill="none">
        <path className="route-dash" stroke="currentColor" strokeWidth="1.5" d="M0 420 C 220 380, 340 120, 600 110 S 900 40, 960 10" />
        <path className="route-dash" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.6" d="M120 448 C 320 400, 460 240, 700 230 S 920 180, 960 150" />
      </svg>

      <div className="container-site relative">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading id="services-title" eyebrow={services.eyebrow} title={services.title} lead={services.lead} />
        </div>

        <ul role="list" className="mt-14 grid gap-5 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-6">
          {services.items.map((item, i) => {
            const Icon = SERVICE_ICONS[item.id];
            const titleId = `service-${item.id}`;
            return (
              <li
                key={item.id}
                data-reveal
                className="group relative flex flex-col overflow-hidden rounded-[1.75rem] border border-line bg-white p-7 shadow-soft transition-[transform,box-shadow,border-color] duration-500 ease-out-expo hover:border-brand-200 hover:shadow-lift focus-within:border-brand-200 focus-within:shadow-lift motion-safe:hover:-translate-y-1.5 sm:p-8"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-1 scale-x-0 bg-linear-to-l from-accent-500 via-accent-400 to-brand-500 transition-transform duration-700 ease-out-expo group-hover:scale-x-100 group-focus-within:scale-x-100 ltr:origin-left ltr:bg-linear-to-r rtl:origin-right"
                />
                <svg
                  aria-hidden="true"
                  viewBox="0 0 160 120"
                  fill="none"
                  className="pointer-events-none absolute -bottom-6 size-40 text-brand-100 transition-colors duration-500 group-hover:text-accent-200 ltr:-right-6 rtl:-left-6 rtl:-scale-x-100"
                >
                  <path className="route-dash" stroke="currentColor" strokeWidth="2" d="M8 112 C 40 60, 90 40, 152 22" />
                  <circle cx="152" cy="22" r="4" fill="currentColor" />
                </svg>

                <div className="flex items-start justify-between">
                  <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 transition-[background-color,color,transform] duration-500 ease-out-expo group-hover:bg-brand-600 group-hover:text-white motion-safe:group-hover:-rotate-6">
                    <Icon className="size-7" strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <span aria-hidden="true" className="num text-[2.75rem] leading-none font-black text-brand-100 transition-colors duration-500 group-hover:text-accent-200">
                    {formatIndex(i + 1, dict.locale)}
                  </span>
                </div>

                <h3 id={titleId} className="mt-7 text-xl leading-snug font-bold text-brand-950 sm:text-[1.35rem]">
                  {item.title}
                </h3>
                <p className="mt-3 flex-1 leading-[1.95] text-muted">{item.text}</p>

                <a
                  href={whatsappUrl(item.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-describedby={titleId}
                  className="relative mt-7 inline-flex w-fit items-center gap-2 rounded-full py-1 font-bold text-brand-600 transition-colors hover:text-brand-800"
                >
                  <WhatsAppIcon className="size-[1.15rem]" />
                  {services.inquire}
                  <ArrowLeft
                    aria-hidden="true"
                    className="size-4 transition-transform duration-500 ease-out-expo ltr:rotate-180 rtl:group-hover:-translate-x-1 ltr:group-hover:translate-x-1"
                  />
                  <span className="sr-only">{dict.general.opensInNewTab}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </Reveal>
  );
}
