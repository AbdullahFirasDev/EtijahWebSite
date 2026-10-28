import { Reveal } from "@/components/motion/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { Dictionary } from "@/content/types";
import { ProcessTimeline } from "./ProcessTimeline";

export function Process({ dict }: { dict: Dictionary }) {
  const { process } = dict;
  return (
    <Reveal as="section" id="process" aria-labelledby="process-title" className="relative bg-white py-24 sm:py-32">
      <div className="container-site">
        <SectionHeading id="process-title" align="center" eyebrow={process.eyebrow} title={process.title} lead={process.lead} />
        <ProcessTimeline steps={process.steps} locale={dict.locale} stepLabel={process.stepLabel} />
      </div>
    </Reveal>
  );
}
