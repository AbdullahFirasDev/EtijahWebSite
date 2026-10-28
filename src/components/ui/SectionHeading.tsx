import type { ReactNode } from "react";

interface SectionHeadingProps {
  id: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  tone?: "light" | "dark";
  align?: "start" | "center";
  className?: string;
}

/** Eyebrow + h2 + lead, with reveal hooks picked up by <Reveal>. */
export function SectionHeading({ id, eyebrow, title, lead, tone = "light", align = "start", className }: SectionHeadingProps) {
  const dark = tone === "dark";
  const centered = align === "center";
  return (
    <div className={`${centered ? "mx-auto text-center" : ""} max-w-3xl ${className ?? ""}`}>
      <p
        data-reveal
        className={`flex items-center gap-3 text-sm font-bold ltr:tracking-[0.16em] ltr:uppercase ${
          centered ? "justify-center" : ""
        } ${dark ? "text-accent-400" : "text-accent-700"}`}
      >
        <span aria-hidden="true" className="h-px w-8 bg-current" />
        {eyebrow}
      </p>
      <h2
        id={id}
        data-reveal
        className={`mt-4 text-[2rem] leading-[1.25] font-extrabold text-balance sm:text-[2.6rem] lg:text-[3.1rem] ${
          dark ? "text-white" : "text-brand-950"
        }`}
      >
        {title}
      </h2>
      {lead ? (
        <p
          data-reveal
          className={`mt-5 text-[1.05rem] leading-[1.9] text-pretty sm:text-lg ${centered ? "mx-auto" : ""} max-w-2xl ${
            dark ? "text-brand-100/85" : "text-muted"
          }`}
        >
          {lead}
        </p>
      ) : null}
    </div>
  );
}
