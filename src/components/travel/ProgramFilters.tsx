"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { TravelDict } from "@/content/travel";

interface Props {
  t: Omit<TravelDict["list"], "results">;
  values: Record<string, string>;
  countries: { code: string; name: string; count: number }[];
  months: { value: string; label: string }[];
  budgets: { value: string; label: string }[];
}

const control =
  "h-12 w-full cursor-pointer appearance-none rounded-2xl border border-line bg-white bg-[length:1rem] bg-no-repeat px-4 text-[0.95rem] font-semibold text-brand-950 outline-none transition-[border-color,box-shadow] hover:border-brand-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 ltr:bg-[right_0.9rem_center] ltr:pr-9 rtl:bg-[left_0.9rem_center] rtl:pl-9";
const chevron = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234a5d73' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" };

/**
 * Filter bar for the offers page. A plain GET form (works without JavaScript); with JavaScript,
 * selects apply instantly without a full page reload.
 */
export function ProgramFilters({ t, values, countries, months, budgets }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const active = Object.entries(values).filter(([k, v]) => v && k !== "sort").length;

  const apply = () => {
    const form = formRef.current;
    if (!form) return;
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (typeof v === "string" && v.trim()) params.set(k, v.trim());
    startTransition(() => router.replace(`${pathname}${params.size ? `?${params}` : ""}#results`, { scroll: false }));
  };

  const select = (name: string, label: string, options: { value: string; label: string }[], any: string) => (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-muted">{label}</span>
      <select name={name} defaultValue={values[name] ?? ""} onChange={apply} className={control} style={chevron}>
        <option value="">{any}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <form
      ref={formRef}
      method="get"
      action={pathname}
      role="search"
      aria-label={t.filters}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      className="relative rounded-[1.75rem] bg-white p-4 shadow-[0_30px_70px_-34px_rgb(5_28_51/0.55)] ring-1 ring-brand-950/5 sm:p-5"
      aria-busy={pending}
    >
      <div className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">{t.search}</span>
          <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            name="q"
            defaultValue={values.q ?? ""}
            placeholder={t.search}
            maxLength={60}
            className="h-12 w-full rounded-2xl border border-line bg-mist/60 ps-12 pe-4 text-[0.95rem] font-semibold text-brand-950 outline-none placeholder:font-normal placeholder:text-muted/70 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
          />
        </label>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="filter-fields"
          className="relative inline-flex h-12 items-center gap-2 rounded-2xl border border-line px-4 font-bold text-brand-900 lg:hidden"
        >
          <SlidersHorizontal className="size-5" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">{t.filters}</span>
          {active ? <span className="num absolute -end-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-accent-500 text-[0.7rem] font-black text-brand-950">{active}</span> : null}
        </button>
        <button type="submit" className="hidden h-12 items-center gap-2 rounded-2xl bg-brand-600 px-6 font-bold text-white transition-colors hover:bg-brand-700 lg:inline-flex">
          {pending ? <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white border-e-transparent" /> : <Search className="size-4" aria-hidden="true" />}
          {t.apply}
        </button>
      </div>

      <div id="filter-fields" className={`${open ? "grid" : "hidden"} mt-4 gap-3 sm:grid-cols-2 lg:grid lg:grid-cols-5`}>
        {select("country", t.country, countries.map((c) => ({ value: c.code, label: `${c.name} (${c.count})` })), t.anyCountry)}
        {select("kind", t.kind, [
          { value: "group", label: t.kinds.group },
          { value: "package", label: t.kinds.package },
        ], t.anyKind)}
        {select("duration", t.duration, Object.entries(t.durations).map(([value, label]) => ({ value, label })), t.anyDuration)}
        {select("month", t.month, months, t.anyMonth)}
        {select("budget", t.budget, budgets, t.anyBudget)}
        <div className="flex items-center justify-between gap-3 sm:col-span-2 lg:hidden">
          <button type="submit" className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl bg-brand-600 font-bold text-white">
            {t.apply}
          </button>
        </div>
      </div>
      {active ? (
        <a href={pathname} className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:underline">
          <X className="size-4" aria-hidden="true" /> {t.reset}
        </a>
      ) : null}
      <input type="hidden" name="sort" value={values.sort ?? ""} />
    </form>
  );
}

/** Sort select shown above the results. */
export function SortSelect({ label, value, options }: { label: string; value: string; options: { value: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <label className="inline-flex items-center gap-2 text-sm font-bold text-muted">
      {label}
      <select
        value={value}
        onChange={(e) => {
          const params = new URLSearchParams(window.location.search);
          if (e.target.value && e.target.value !== "recommended") params.set("sort", e.target.value);
          else params.delete("sort");
          router.replace(`${pathname}${params.size ? `?${params}` : ""}#results`, { scroll: false });
        }}
        className={`${control} h-10 w-auto min-w-44 text-sm`}
        style={chevron}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
