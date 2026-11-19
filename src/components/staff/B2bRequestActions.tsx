"use client";

import { useState } from "react";
import { setB2bRequestStatusAction } from "@/server/actions/companies";
import { Button, Input, Select } from "./ui";
import { useActionRunner } from "./useActionRunner";

export function B2bRequestActions({ id, status, note }: { id: number; status: string; note: string | null }) {
  const [s, setS] = useState(status);
  const [n, setN] = useState(note ?? "");
  const { run, pending } = useActionRunner();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select aria-label="حالة الطلب" value={s} onChange={(e) => setS(e.target.value)} className="h-9 w-40 text-sm">
        <option value="new">جديد</option>
        <option value="in_progress">قيد الإعداد</option>
        <option value="quoted">أُرسل العرض</option>
        <option value="closed">مغلق</option>
      </Select>
      <Input aria-label="ملاحظة" value={n} onChange={(e) => setN(e.target.value)} placeholder="ملاحظة داخلية" className="h-9 w-56 text-sm" />
      <Button size="sm" variant="subtle" loading={pending} onClick={() => run(() => setB2bRequestStatusAction({ id, status: s, note: n || null }))}>
        حفظ
      </Button>
    </div>
  );
}
