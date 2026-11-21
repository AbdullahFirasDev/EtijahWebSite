"use client";

import { Copy, EyeOff, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { BOARD_LABELS, BOARDS, RATE_BASIS_LABELS, type Board } from "@/lib/travel-labels";
import { saveHotelRatesAction } from "@/server/actions/catalog";
import { DateInput, MoneyInput, NumberInput } from "./fields";
import { Badge, Button, Card, CardHeader, EmptyState, Input, Select } from "./ui";
import { useActionRunner } from "./useActionRunner";

export interface RateRow {
  id: string | null;
  room_type_id: string;
  board: Board | null;
  basis: "per_person" | "per_room";
  occupancy: number;
  currency: string;
  cost: number | null;
  price: number;
  season_ar: string | null;
  valid_from: string | null;
  valid_to: string | null;
  active: boolean;
  /** Client-only key for list rendering. */
  key: string;
}

let seq = 0;
const k = () => `r${++seq}`;

/**
 * Nightly rates per room type. Cost (internal) and suggested selling price are kept apart.
 * Saving writes every price change to the audit log; programs and quotes keep their own copy.
 */
export function HotelRatesEditor({
  hotelId,
  roomTypes,
  initial,
  currencies,
  canEdit,
  showCosts,
}: {
  hotelId: number;
  roomTypes: { id: string; name_ar: string; max_pax: number }[];
  initial: Omit<RateRow, "key">[];
  currencies: string[];
  canEdit: boolean;
  showCosts: boolean;
}) {
  const [rows, setRows] = useState<RateRow[]>(() => initial.map((r) => ({ ...r, key: k() })));
  const [showInactive, setShowInactive] = useState(false);
  const { run, pending } = useActionRunner();
  const setRow = (key: string, patch: Partial<RateRow>) => setRows((x) => x.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const room = (id: string) => roomTypes.find((r) => r.id === id);

  const add = (from?: RateRow) => {
    const rt = roomTypes[0];
    if (!rt) return;
    setRows((x) => [
      ...x,
      from
        ? { ...from, id: null, key: k(), season_ar: from.season_ar, valid_from: null, valid_to: null }
        : { id: null, room_type_id: rt.id, board: "BB", basis: "per_room", occupancy: Math.min(2, rt.max_pax), currency: currencies[0] ?? "USD", cost: null, price: 0, season_ar: null, valid_from: null, valid_to: null, active: true, key: k() },
    ]);
  };

  const save = () =>
    run(() =>
      saveHotelRatesAction({
        hotel_id: hotelId,
        // Without the cost permission the stored costs are sent back untouched (never blanked).
        rates: rows.map(({ key: _k, ...r }) => r),
      }),
    );

  const visible = rows.filter((r) => showInactive || r.active || !r.id);

  return (
    <Card id="rates">
      <CardHeader
        title="أسعار الليلة"
        description="لكل نوع غرفة: سعر البيع المقترح، والتكلفة الداخلية (للموظفين فقط)، ونوع السعر (للشخص أو للغرفة)، والعملة وفترة الصلاحية."
        actions={
          <>
            {rows.some((r) => !r.active && r.id) ? (
              <Button size="sm" variant="ghost" onClick={() => setShowInactive((v) => !v)}>
                <EyeOff className="size-4" aria-hidden="true" /> {showInactive ? "إخفاء الموقوفة" : "إظهار الموقوفة"}
              </Button>
            ) : null}
            {canEdit ? (
              <Button size="sm" variant="subtle" onClick={() => add()} disabled={!roomTypes.length} data-add-rate>
                <Plus className="size-4" aria-hidden="true" /> سعر جديد
              </Button>
            ) : null}
          </>
        }
      />
      {!roomTypes.length ? (
        <EmptyState title="أضف أنواع الغرف أولاً" text="احفظ نوع غرفة واحداً على الأقل في قسم «أنواع الغرف»، ثم أضف أسعارها هنا." />
      ) : visible.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] text-sm [&_td]:border-t [&_td]:border-line [&_td]:px-2 [&_td]:py-2 [&_th]:bg-mist [&_th]:px-2 [&_th]:py-2 [&_th]:text-start [&_th]:text-xs [&_th]:font-bold [&_th]:text-muted">
            <thead>
              <tr>
                <th>نوع الغرفة</th>
                <th>الوجبات</th>
                <th>نوع السعر</th>
                <th>الأشخاص</th>
                <th>العملة</th>
                {showCosts ? <th>التكلفة (داخلي)</th> : null}
                <th>سعر البيع</th>
                <th>الموسم / الصلاحية</th>
                <th>الحالة</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const rt = room(r.room_type_id);
                const margin = r.cost != null && r.price ? r.price - r.cost : null;
                return (
                  <tr key={r.key} className={r.active ? "" : "opacity-60"} data-rate-row={r.id ?? "new"}>
                    <td className="min-w-40">
                      <Select aria-label="نوع الغرفة" value={r.room_type_id} disabled={!canEdit} onChange={(e) => setRow(r.key, { room_type_id: e.target.value })} className="h-10">
                        {roomTypes.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name_ar}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="min-w-32">
                      <Select aria-label="الوجبات" value={r.board ?? ""} disabled={!canEdit} onChange={(e) => setRow(r.key, { board: (e.target.value || null) as Board | null })} className="h-10">
                        <option value="">—</option>
                        {BOARDS.map((b) => (
                          <option key={b} value={b}>
                            {BOARD_LABELS[b].ar}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="min-w-28">
                      <Select aria-label="نوع السعر" value={r.basis} disabled={!canEdit} onChange={(e) => setRow(r.key, { basis: e.target.value as RateRow["basis"] })} className="h-10">
                        <option value="per_room">{RATE_BASIS_LABELS.per_room.ar}</option>
                        <option value="per_person">{RATE_BASIS_LABELS.per_person.ar}</option>
                      </Select>
                    </td>
                    <td className="w-20">
                      <NumberInput value={r.occupancy} min={1} max={rt?.max_pax ?? 20} onChange={(v) => setRow(r.key, { occupancy: v ?? 1 })} aria-label="عدد الأشخاص" className="h-10" />
                    </td>
                    <td className="w-24">
                      <Select aria-label="العملة" value={r.currency} disabled={!canEdit} onChange={(e) => setRow(r.key, { currency: e.target.value })} className="h-10">
                        {[...new Set([r.currency, ...currencies])].map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Select>
                    </td>
                    {showCosts ? (
                      <td className="w-32">
                        <MoneyInput value={r.cost} onChange={(v) => setRow(r.key, { cost: v })} aria-label="التكلفة" />
                      </td>
                    ) : null}
                    <td className="w-36">
                      <MoneyInput value={r.price || null} onChange={(v) => setRow(r.key, { price: v ?? 0 })} aria-label="سعر البيع" />
                      {showCosts && margin != null ? <p className={`num mt-0.5 text-[0.7rem] font-bold ${margin < 0 ? "text-danger" : "text-muted"}`}>هامش {formatMoney(margin, r.currency, "ar")}</p> : null}
                    </td>
                    <td className="min-w-56">
                      <Input aria-label="الموسم" value={r.season_ar ?? ""} disabled={!canEdit} onChange={(e) => setRow(r.key, { season_ar: e.target.value || null })} placeholder="مثال: صيف 2027" className="h-9 text-xs" />
                      <div className="mt-1 flex gap-1" dir="ltr">
                        <DateInput aria-label="من" value={r.valid_from} disabled={!canEdit} onChange={(v) => setRow(r.key, { valid_from: v })} className="w-36" inputClassName="h-9 px-2 text-xs" />
                        <DateInput aria-label="إلى" min={r.valid_from ?? undefined} value={r.valid_to} disabled={!canEdit} onChange={(v) => setRow(r.key, { valid_to: v })} className="w-36" inputClassName="h-9 px-2 text-xs" />
                      </div>
                    </td>
                    <td>
                      <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold">
                        <input type="checkbox" className="size-4 accent-brand-600" checked={r.active} disabled={!canEdit} onChange={(e) => setRow(r.key, { active: e.target.checked })} />
                        {r.active ? <Badge tone="success">مفعّل</Badge> : <Badge tone="muted">موقوف</Badge>}
                      </label>
                    </td>
                    <td className="whitespace-nowrap">
                      {canEdit ? (
                        <>
                          <Button size="sm" variant="ghost" aria-label="نسخ السعر" onClick={() => add(r)}>
                            <Copy className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-danger"
                            aria-label="حذف السعر"
                            onClick={() => (r.id ? setRow(r.key, { active: false }) : setRows((x) => x.filter((y) => y.key !== r.key)))}
                            title={r.id ? "الأسعار المحفوظة تُوقف ولا تُحذف، لأن البرامج والعروض السابقة تشير إليها." : undefined}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="لا توجد أسعار بعد" text="أضف سعر الليلة لكل نوع غرفة. سيظهر الفندق بأسعاره تلقائياً عند إنشاء أي برنامج." action={canEdit ? <Button variant="primary" onClick={() => add()}>إضافة سعر</Button> : undefined} />
      )}
      {canEdit && rows.length ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
          <p className="text-xs text-muted">تعديل السعر هنا لا يغيّر البرامج أو عروض الأسعار السابقة، فكل منها يحتفظ بنسخة من السعر الذي استخدمه.</p>
          <Button variant="primary" onClick={save} loading={pending} data-save-rates>
            <Save className="size-4" aria-hidden="true" /> حفظ الأسعار
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
