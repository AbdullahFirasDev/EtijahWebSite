import type { AnchorHTMLAttributes, ReactNode } from "react";

type Variant = "accent" | "brand" | "outline-light" | "outline" | "glass";
type Size = "md" | "lg";

const base =
  "group/btn relative inline-flex items-center justify-center gap-2.5 rounded-full font-bold whitespace-nowrap select-none " +
  "transition-[transform,background-color,box-shadow,color,border-color] duration-300 ease-out-expo " +
  "active:scale-[0.97] motion-safe:hover:-translate-y-0.5";

const variants: Record<Variant, string> = {
  // Brand orange with navy text: 6.6:1 contrast (white on #F58220 would fail AA).
  accent: "bg-accent-500 text-brand-950 hover:bg-accent-400 hover:shadow-glow",
  brand: "bg-brand-600 text-white hover:bg-brand-700 hover:shadow-lift",
  "outline-light": "border border-white/45 text-white hover:border-white hover:bg-white/10",
  outline: "border border-brand-200 text-brand-700 hover:border-brand-600 hover:bg-brand-50",
  glass: "border border-white/25 bg-white/10 text-white backdrop-blur-md hover:bg-white/20",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-13 px-7 text-base sm:h-14 sm:px-8 sm:text-[1.05rem]",
};

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  /** External links open in a new tab with a screen-reader hint. */
  external?: boolean;
  newTabHint?: string;
}

export function ButtonLink({
  variant = "accent",
  size = "md",
  icon,
  external,
  newTabHint,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <a
      className={`${base} ${variants[variant]} ${sizes[size]} ${className ?? ""}`}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...rest}
    >
      {icon}
      <span>{children}</span>
      {external && newTabHint ? <span className="sr-only"> {newTabHint}</span> : null}
    </a>
  );
}
