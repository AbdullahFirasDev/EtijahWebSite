"use client";

import { useState, type InputHTMLAttributes } from "react";
import { airportLabel, findAirport, type Airport } from "@/lib/airports";
import { Input } from "./ui";

/** One shared suggestion list per page: "مطار إسطنبول (IST)". Browsers filter it as staff type (name or code). */
export function AirportDatalist({ id, airports }: { id: string; airports: Airport[] }) {
  return (
    <datalist id={id}>
      {airports.map((a) => (
        <option key={a.code} value={airportLabel(a)}>
          {a.name_en}
        </option>
      ))}
    </datalist>
  );
}

/**
 * Free-text airport box backed by the airport list: picking or typing a known airport (name, label or
 * IATA code) reports it; anything else is kept as typed. While focused the box shows exactly what
 * staff type; after leaving it shows the stored value (e.g. the full airport label).
 */
export function AirportInput({
  listId,
  value,
  onChange,
  airports,
  ...rest
}: {
  listId: string;
  value: string;
  onChange: (text: string, airport: Airport | null) => void;
  airports?: Airport[];
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "list">) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  // Outside changes (suggestions, draft restore) and the tidy label after leaving the box; never while typing.
  if (!focused && text !== value) setText(value);
  return (
    <Input
      {...rest}
      list={listId}
      value={focused ? text : value}
      autoComplete="off"
      onFocus={() => {
        setText(value);
        setFocused(true);
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        onChange(t, findAirport(t, airports));
      }}
    />
  );
}
