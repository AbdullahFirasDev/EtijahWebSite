import { ArrowUpLeft, Info } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { Picture, type ImageName } from "@/components/ui/Picture";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { whatsappUrl, type DestinationId } from "@/content/site";
import type { Dictionary } from "@/content/types";
import { formatIndex } from "@/lib/format";

// Bento placement: 2 columns on tablets, 3 on desktop; every cell is filled at both sizes.
const LAYOUT: Record<DestinationId, { image: ImageName; cell: string; sizes: string; position?: string }> = {
  istanbul: {
    image: "dest-istanbul",
    cell: "md:col-span-2 md:row-span-2",
    sizes: "(min-width: 1024px) 52rem, (min-width: 768px) 92vw, 92vw",
  },
  dubai: { image: "dest-dubai", cell: "md:row-span-2", sizes: "(min-width: 1024px) 26rem, (min-width: 768px) 46vw, 92vw", position: "object-[50%_60%]" },
  maldives: { image: "dest-maldives", cell: "md:row-span-2", sizes: "(min-width: 1024px) 26rem, (min-width: 768px) 46vw, 92vw" },
  kualaLumpur: { image: "dest-kuala-lumpur", cell: "md:row-span-2", sizes: "(min-width: 1024px) 26rem, (min-width: 768px) 46vw, 92vw", position: "object-[50%_35%]" },
  tbilisi: { image: "dest-tbilisi", cell: "", sizes: "(min-width: 1024px) 26rem, (min-width: 768px) 46vw, 92vw" },
  cairo: { image: "dest-giza", cell: "", sizes: "(min-width: 1024px) 26rem, (min-width: 768px) 46vw, 92vw", position: "object-[50%_55%]" },
};

export function Destinations({ dict }: { dict: Dictionary }) {
  const { destinations } = dict;
  return (
    <Reveal
      as="section"
      id="destinations"
      aria-labelledby="destinations-title"
      className="surface-dark relative overflow-hidden bg-brand-950 py-24 sm:py-32"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(50rem_32rem_at_85%_0%,rgb(8_102_178/0.5),transparent_65%),radial-gradient(40rem_28rem_at_10%_100%,rgb(8_102_178/0.28),transparent_60%)]"
      />
      <div className="container-site relative">
        <SectionHeading id="destinations-title" tone="dark" eyebrow={destinations.eyebrow} title={destinations.title} lead={destinations.lead} />

        <ul role="list" className="mt-14 grid auto-rows-[19rem] gap-4 sm:gap-5 md:grid-cols-2 md:auto-rows-[14rem] lg:mt-16 lg:grid-cols-3 lg:auto-rows-[15.5rem]">
          {destinations.items.map((item, i) => {
            const layout = LAYOUT[item.id];
            return (
              <li key={item.id} data-reveal className={`group relative isolate flex flex-col justify-end overflow-hidden rounded-[1.75rem] bg-brand-900 ${layout.cell}`}>
                <div className="absolute inset-0 -z-10 transition-transform duration-[1.4s] ease-out-expo group-focus-within:scale-[1.06] group-hover:scale-[1.06]">
                  <Picture
                    name={layout.image}
                    alt={item.alt}
                    sizes={layout.sizes}
                    className={`h-full w-full object-cover ${layout.position ?? ""}`}
                  />
                </div>
                <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-brand-950/95 via-brand-950/35 to-brand-950/5" />
                <div aria-hidden="true" className="absolute inset-0 -z-10 bg-brand-700/25 opacity-0 mix-blend-multiply transition-opacity duration-700 group-focus-within:opacity-100 group-hover:opacity-100" />

                <span aria-hidden="true" className="num absolute top-5 text-sm font-bold text-white/70 ltr:left-6 rtl:right-6">
                  {formatIndex(i + 1, dict.locale)}
                </span>
                <span
                  aria-hidden="true"
                  className="absolute top-4 grid size-11 place-items-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur-md transition-[background-color,color,transform,border-color] duration-500 ease-out-expo group-focus-within:border-accent-500 group-focus-within:bg-accent-500 group-focus-within:text-brand-950 group-hover:border-accent-500 group-hover:bg-accent-500 group-hover:text-brand-950 ltr:right-4 rtl:left-4 motion-safe:rtl:group-hover:rotate-45 motion-safe:ltr:group-hover:-rotate-45 ltr:[&>svg]:-scale-x-100"
                >
                  <ArrowUpLeft className="size-5" strokeWidth={1.8} />
                </span>

                {/* Not positioned, so the link's ::after stretches over the whole card. */}
                <div className="p-6 sm:p-7">
                  <p className="text-sm font-semibold text-accent-300">{item.country}</p>
                  <h3 className="mt-1 text-2xl font-extrabold text-white sm:text-[1.75rem]">{item.name}</h3>
                  <p className="mt-2 max-w-md text-[0.95rem] leading-[1.85] text-white/80 transition-[opacity,transform] duration-700 ease-out-expo [@media(hover:hover)]:translate-y-2 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:translate-y-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100">
                    {item.text}
                  </p>
                  <a
                    href={whatsappUrl(item.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-white underline decoration-accent-500 decoration-2 underline-offset-[6px] after:absolute after:inset-0 after:rounded-[1.75rem] after:content-['']"
                  >
                    {destinations.ask}
                    <span className="sr-only">
                      {": "}
                      {item.name} {dict.general.opensInNewTab}
                    </span>
                  </a>
                </div>
              </li>
            );
          })}
        </ul>

        <p data-reveal className="mt-8 flex max-w-3xl items-start gap-2.5 text-sm leading-[1.85] text-brand-100/70">
          <Info className="mt-1 size-4 shrink-0 text-accent-400" aria-hidden="true" />
          {destinations.note}
        </p>
      </div>
    </Reveal>
  );
}
