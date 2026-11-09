// Staff portal primitives: compact, fast to scan, brand colours used functionally.
import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type Variant = "primary" | "accent" | "outline" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md";

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl font-bold whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-200 disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2";
const btnVariants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-[0_1px_0_rgb(255_255_255/0.15)_inset]",
  accent: "bg-accent-500 text-brand-950 hover:bg-accent-400",
  outline: "border border-line bg-white text-brand-900 hover:border-brand-300 hover:bg-brand-50",
  ghost: "text-brand-800 hover:bg-brand-50",
  danger: "border border-danger/25 bg-white text-danger hover:bg-accent-50",
  subtle: "bg-brand-50 text-brand-800 hover:bg-brand-100",
};
const btnSizes: Record<Size, string> = { sm: "h-9 px-3 text-sm", md: "h-11 px-4 text-[0.95rem]" };

export const buttonClass = (variant: Variant = "outline", size: Size = "md", extra = "") => `${btnBase} ${btnVariants[variant]} ${btnSizes[size]} ${extra}`;

export function Button({ variant = "outline", size = "md", className = "", loading, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button type="button" className={buttonClass(variant, size, className)} disabled={loading || rest.disabled} aria-busy={loading || undefined} {...rest}>
      {loading ? <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-e-transparent" /> : null}
      {children}
    </button>
  );
}

export function LinkButton({ variant = "outline", size = "md", className = "", ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link prefetch={false} className={buttonClass(variant, size, className)} {...rest} />;
}

export function Card({ className = "", children, ...rest }: { className?: string; children: ReactNode } & ComponentProps<"section">) {
  return (
    <section className={`rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgb(5_28_51/0.04)] ${className}`} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({ title, description, actions, id }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div>
        <h2 id={id} className="text-base font-extrabold text-brand-950">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} prefetch={false} className="mb-2 inline-flex items-center gap-1 text-sm font-bold text-brand-600 hover:underline">
            <span aria-hidden="true">→</span> {back.label}
          </Link>
        ) : null}
        <h1 className="text-2xl font-extrabold text-brand-950 sm:text-[1.7rem]">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-[0.95rem] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

type Tone = "neutral" | "brand" | "accent" | "success" | "danger" | "muted";
const tones: Record<Tone, string> = {
  neutral: "bg-mist text-brand-900 ring-line",
  brand: "bg-brand-50 text-brand-700 ring-brand-100",
  accent: "bg-accent-50 text-accent-700 ring-accent-100",
  success: "bg-[#e9f7ef] text-[#17663a] ring-[#c9ebd6]",
  danger: "bg-[#fdeeee] text-[#a42424] ring-[#f6cfcf]",
  muted: "bg-white text-muted ring-line",
};

export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ring-1 ring-inset ${tones[tone]} ${className}`}>{children}</span>;
}

export const inputClass =
  "w-full rounded-xl border border-line bg-white px-3.5 text-[0.95rem] text-ink placeholder:text-muted/60 outline-none transition-[border-color,box-shadow] duration-150 hover:border-brand-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 aria-invalid:border-danger aria-invalid:ring-danger/10 disabled:bg-mist";

export function Field({ label, hint, error, required, children, className = "", htmlFor }: { label: ReactNode; hint?: ReactNode; error?: string; required?: boolean; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-center gap-1 text-sm font-bold text-brand-950">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-accent-700">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-xs font-bold text-danger">{error}</p> : hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputClass} h-11 ${className}`} {...rest} />;
}

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputClass} min-h-24 py-2.5 leading-[1.8] ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${inputClass} h-11 cursor-pointer ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label, description, id }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; id?: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-6 w-11 rounded-full bg-line transition-colors peer-checked:bg-brand-600 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100" />
        <span className="absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform start-0.5 peer-checked:ltr:translate-x-5 peer-checked:rtl:-translate-x-5" />
      </span>
      <span>
        <span className="block text-sm font-bold text-brand-950">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon ? <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">{icon}</span> : null}
      <p className="mt-4 text-lg font-extrabold text-brand-950">{title}</p>
      {text ? <p className="mt-1 max-w-md text-sm leading-[1.8] text-muted">{text}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Stat({ label, value, hint, tone = "brand", href }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "brand" | "accent" | "neutral"; href?: string }) {
  const body = (
    <>
      <p className="text-sm font-bold text-muted">{label}</p>
      <p className={`num mt-2 text-3xl font-black ${tone === "accent" ? "text-accent-700" : tone === "brand" ? "text-brand-700" : "text-brand-950"}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </>
  );
  const cls = "block rounded-2xl border border-line bg-white p-5 transition-[border-color,box-shadow] hover:border-brand-200 hover:shadow-soft";
  return href ? (
    <Link href={href} prefetch={false} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Responsive table wrapper: scrolls horizontally on small screens. */
export function Table({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="overflow-x-auto" role="region" aria-label={label} tabIndex={0}>
      <table className="w-full min-w-[44rem] border-collapse text-sm [&_td]:border-t [&_td]:border-line [&_td]:px-4 [&_td]:py-3 [&_td]:align-middle [&_th]:bg-mist [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-start [&_th]:text-xs [&_th]:font-bold [&_th]:whitespace-nowrap [&_th]:text-muted [&_tbody_tr:hover]:bg-brand-50/40">
        {children}
      </table>
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-extrabold text-brand-950">{children}</h3>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
