"use client";

import { MapPin, Plane, Search, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { flag } from "@/lib/countries";
import { Input, Select } from "./ui";

export interface DestinationOption {
  id: number;
  label: string;
  name_en: string;
  country_code: string;
  country: string;
  kind: "city" | "area";
  airport_code: string | null;
  active: boolean;
}

const chip = (on: boolean) =>
  `inline-flex cursor-pointer items-center gap-1 rounded-full border px-3.5 py-1.5 text-sm font-bold transition-colors ${on ? "border-brand-600 bg-brand-600 text-white" : "border-line text-brand-900 hover:border-brand-300"}`;

/**
 * Country first, then its cities and tourist areas as chips (hundreds of destinations stay manageable),
 * plus a search across all countries. Selection order is kept: it drives the suggested itinerary and flights.
 */
export function DestinationPicker({
  destinations,
  countries,
  value,
  onChange,
}: {
  destinations: DestinationOption[];
  countries: { code: string; name: string }[];
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const byId = new Map(destinations.map((d) => [d.id, d]));
  const selected = value.map((id) => byId.get(id)).filter((d): d is DestinationOption => !!d);
  const [country, setCountry] = useState(() => selected[0]?.country_code ?? countries[0]?.code ?? "");
  const [q, setQ] = useState("");
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  const needle = q.trim().toLowerCase();
  const visible = (d: DestinationOption) => d.active || value.includes(d.id);
  const results = needle ? destinations.filter((d) => visible(d) && `${d.label} ${d.name_en} ${d.country}`.toLowerCase().includes(needle)).slice(0, 60) : [];
  const inCountry = destinations.filter((d) => d.country_code === country && visible(d));
  const cities = inCountry.filter((d) => d.kind === "city");
  const areas = inCountry.filter((d) => d.kind === "area");

  const renderChip = (d: DestinationOption, withCountry = false) => {
    const on = value.includes(d.id);
    return (
      <label key={d.id} className={chip(on)}>
        <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(d.id)} />
        {d.label}
        {withCountry ? <span className="font-semibold opacity-75">· {d.country}</span> : null}
        {d.airport_code ? <span className="num text-[0.7rem] font-semibold opacity-60">{d.airport_code}</span> : null}
        {!d.active ? <span className="text-[0.7rem] opacity-75">(موقوفة)</span> : null}
      </label>
    );
  };

  if (!destinations.length)
    return (
      <Link href="/staff/destinations/" className="text-sm font-bold text-brand-600 underline">
        أضف الوجهات أولاً (يمكن إضافة المدن الجاهزة بضغطة واحدة)
      </Link>
    );

  return (
    <div className="grid gap-3">
      <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-xl bg-mist px-3 py-2" data-selected-destinations aria-live="polite">
        {selected.length ? (
          selected.map((d, i) => (
            <span key={d.id} className="inline-flex items-center gap-1.5 rounded-full bg-white py-1 ps-3 pe-1 text-sm font-bold text-brand-900 ring-1 ring-brand-200">
              <span className="num text-xs text-muted">{i + 1}</span>
              <span aria-hidden="true">{flag(d.country_code)}</span>
              {d.label}
              <button type="button" onClick={() => toggle(d.id)} className="grid size-6 place-items-center rounded-full text-muted hover:bg-mist hover:text-danger" aria-label={`إزالة ${d.label}`}>
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </span>
          ))
        ) : (
          <span className="flex items-center gap-2 text-sm text-muted">
            <MapPin className="size-4" aria-hidden="true" /> لم تُختر وجهة بعد. اختر الدولة ثم المدن بالترتيب الذي ستزورها به الرحلة.
          </span>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-[14rem_1fr]">
        <Select aria-label="الدولة" value={country} onChange={(e) => (setCountry(e.target.value), setQ(""))} data-destination-country-pick>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>
        <label className="relative">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted" aria-hidden="true" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="أو ابحث عن مدينة في كل الدول (عربي أو إنجليزي)…" className="ps-9" aria-label="بحث عن وجهة" data-destination-search />
        </label>
      </div>

      {needle ? (
        <div className="flex flex-wrap gap-2" data-destinations>
          {results.length ? results.map((d) => renderChip(d, true)) : <p className="text-sm text-muted">لا توجد وجهة بهذا الاسم. أضفها من «الدول والوجهات».</p>}
        </div>
      ) : (
        <div className="grid gap-3" data-destinations>
          {cities.length ? (
            <div>
              <p className="mb-1.5 text-xs font-bold text-muted">المدن</p>
              <div className="flex flex-wrap gap-2">{cities.map((d) => renderChip(d))}</div>
            </div>
          ) : null}
          {areas.length ? (
            <div>
              <p className="mb-1.5 text-xs font-bold text-muted">مناطق ووجهات سياحية</p>
              <div className="flex flex-wrap gap-2">{areas.map((d) => renderChip(d))}</div>
            </div>
          ) : null}
          {!inCountry.length ? <p className="text-sm text-muted">لا توجد وجهات مفعّلة في هذه الدولة.</p> : null}
        </div>
      )}
      {selected.some((d) => d.airport_code) ? (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Plane className="size-3.5" aria-hidden="true" /> مطار الوصول المقترح: <span className="num font-bold">{selected.find((d) => d.airport_code)?.airport_code}</span> (يُستخدم لاقتراح رحلات الطيران في الخطوة التالية).
        </p>
      ) : null}
    </div>
  );
}
