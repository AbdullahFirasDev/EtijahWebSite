"use client";

import { Tag } from "lucide-react";
import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { BOARD_LABELS, RATE_BASIS_LABELS, type Board } from "@/lib/travel-labels";
import { quickRateAction } from "@/server/actions/catalog";
import { MoneyInput } from "./fields";
import { Modal } from "./Modal";
import { Button } from "./ui";
import { useActionRunner } from "./useActionRunner";

interface QuickRate {
  id: string;
  room: string;
  board: Board | null;
  basis: "per_person" | "per_room";
  occupancy: number;
  currency: string;
  price: number;
  cost: number | null;
}

/** "Edit the nightly price easily": one dialog per hotel, one price field per active rate. */
export function QuickRates({ hotelId, hotelName, rates, canEdit, showCosts }: { hotelId: number; hotelName: string; rates: QuickRate[]; canEdit: boolean; showCosts: boolean }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(() => Object.fromEntries(rates.map((r) => [r.id, { price: r.price as number | null, cost: r.cost }])));
  const { run, pending } = useActionRunner();
  const lowest = rates.length ? rates.reduce((m, r) => (r.price < m.price ? r : m)) : null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold text-brand-700 hover:bg-brand-50" data-quick-rates={hotelId}>
        <Tag className="size-3.5" aria-hidden="true" />
        {lowest ? (
          <span>
            {rates.length} سعر · من <span className="num">{formatMoney(lowest.price, lowest.currency, "ar")}</span>
          </span>
        ) : (
          "بدون أسعار"
        )}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`أسعار الليلة — ${hotelName}`} wide>
        {rates.length ? (
          <ul role="list" className="grid gap-3">
            {rates.map((r) => (
              <li key={r.id} className="grid items-end gap-3 rounded-xl border border-line p-3 sm:grid-cols-[1fr_9rem_9rem_auto]">
                <div>
                  <p className="font-bold text-brand-950">{r.room}</p>
                  <p className="text-xs text-muted">
                    {r.board ? BOARD_LABELS[r.board].ar : "—"} · {RATE_BASIS_LABELS[r.basis].ar} · {r.occupancy} أشخاص · {r.currency}
                  </p>
                </div>
                {showCosts ? (
                  <label className="text-xs font-bold text-muted">
                    التكلفة
                    <MoneyInput value={values[r.id].cost} onChange={(v) => setValues((x) => ({ ...x, [r.id]: { ...x[r.id], cost: v } }))} aria-label="التكلفة" />
                  </label>
                ) : (
                  <span />
                )}
                <label className="text-xs font-bold text-muted">
                  سعر البيع لليلة
                  <MoneyInput value={values[r.id].price} onChange={(v) => setValues((x) => ({ ...x, [r.id]: { ...x[r.id], price: v } }))} aria-label="سعر البيع" />
                </label>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="primary"
                    className="h-11"
                    loading={pending}
                    onClick={() => run(() => quickRateAction({ hotel_id: hotelId, rate_id: r.id, price: values[r.id].price ?? 0, cost: values[r.id].cost }))}
                  >
                    حفظ
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">لا توجد أسعار مفعّلة لهذا الفندق. أضفها من صفحة الفندق.</p>
        )}
        <p className="mt-4 text-xs text-muted">تعديل السعر هنا لا يؤثر على البرامج وعروض الأسعار السابقة.</p>
      </Modal>
    </>
  );
}
