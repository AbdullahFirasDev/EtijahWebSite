"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DEPARTURE_STATUS_LABELS, DEPARTURE_STATUSES, type DepartureStatus } from "@/lib/travel-labels";
import { updateDepartureAction } from "@/server/actions/programs";
import { NumberInput } from "./fields";
import { Button, Select, Table } from "./ui";
import { useActionRunner } from "./useActionRunner";

export interface DepartureItem {
  id: number;
  code: string;
  program_id: number;
  title: string;
  depart: string;
  return: string;
  seats_total: number;
  seats_held: number;
  confirmed: number;
  seatsLeft: number;
  status: DepartureStatus;
  requests: number;
}

function Row({ d, canEdit }: { d: DepartureItem; canEdit: boolean }) {
  const [v, setV] = useState({ seats_total: d.seats_total, seats_held: d.seats_held, status: d.status });
  const { run, pending } = useActionRunner();
  const changed = v.seats_total !== d.seats_total || v.seats_held !== d.seats_held || v.status !== d.status;
  const used = d.seats_total - d.seatsLeft;
  return (
    <tr>
      <td>
        <Link href={canEdit ? `/staff/programs/${d.program_id}/#departures` : `/staff/preview/program/${d.program_id}/`} prefetch={false} className="font-bold text-brand-950 hover:underline">
          {d.title}
        </Link>
        <p className="num text-xs text-muted">{d.code}</p>
      </td>
      <td className="whitespace-nowrap">
        {d.depart}
        <p className="text-xs text-muted">حتى {d.return}</p>
      </td>
      <td className="w-28">{canEdit ? <NumberInput aria-label="إجمالي المقاعد" min={1} value={v.seats_total} onChange={(n) => setV({ ...v, seats_total: n ?? 1 })} className="h-9" /> : <span className="num">{d.seats_total}</span>}</td>
      <td className="w-28">{canEdit ? <NumberInput aria-label="محجوز خارج الموقع" min={0} value={v.seats_held} onChange={(n) => setV({ ...v, seats_held: n ?? 0 })} className="h-9" /> : <span className="num">{d.seats_held}</span>}</td>
      <td className="num">{d.confirmed}</td>
      <td>
        <span className={`num font-black ${d.seatsLeft <= 5 ? "text-accent-700" : "text-brand-700"}`}>{d.seatsLeft}</span>
        <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-mist" aria-hidden="true">
          <div className={`h-full ${d.seatsLeft <= 5 ? "bg-accent-500" : "bg-brand-500"}`} style={{ width: `${Math.min(100, (used / Math.max(1, d.seats_total)) * 100)}%` }} />
        </div>
      </td>
      <td className="num">{d.requests}</td>
      <td className="w-40">
        {canEdit ? (
          <Select aria-label="الحالة" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as DepartureStatus })} className="h-9 text-sm">
            {DEPARTURE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {DEPARTURE_STATUS_LABELS[s].ar}
              </option>
            ))}
          </Select>
        ) : (
          DEPARTURE_STATUS_LABELS[d.status].ar
        )}
      </td>
      <td>
        {canEdit ? (
          <Button size="sm" variant={changed ? "primary" : "ghost"} disabled={!changed} loading={pending} aria-label="حفظ" onClick={() => run(() => updateDepartureAction({ id: d.id, ...v }))}>
            <Check className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
      </td>
    </tr>
  );
}

export function DeparturesTable({ items, canEdit }: { items: DepartureItem[]; canEdit: boolean }) {
  return (
    <Table label="مواعيد الكروبات">
      <thead>
        <tr>
          <th>البرنامج</th>
          <th>السفر</th>
          <th>الإجمالي</th>
          <th>محجوز خارج الموقع</th>
          <th>مؤكد عبر الموقع</th>
          <th>المتاح</th>
          <th>الطلبات</th>
          <th>الحالة</th>
          <th className="w-0" />
        </tr>
      </thead>
      <tbody>
        {items.map((d) => (
          <Row key={`${d.id}-${d.seats_total}-${d.seats_held}-${d.status}`} d={d} canEdit={canEdit} />
        ))}
      </tbody>
    </Table>
  );
}
