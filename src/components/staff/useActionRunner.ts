"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";
import { useToast } from "./Toaster";

/** Runs a server action with a pending state, toasts its result and refreshes server data. */
export function useActionRunner() {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    <T,>(fn: () => Promise<ActionResult<T>>, opts: { onOk?: (data: T) => void; onError?: (r: Extract<ActionResult<T>, { ok: false }>) => void; refresh?: boolean; confirm?: string } = {}) => {
      if (opts.confirm && !window.confirm(opts.confirm)) return;
      startTransition(async () => {
        try {
          const res = await fn();
          if (res.ok) {
            if (res.message) toast.success(res.message);
            opts.onOk?.(res.data);
            if (opts.refresh !== false) router.refresh();
          } else {
            toast.error(res.error);
            opts.onError?.(res);
          }
        } catch {
          toast.error("تعذّر الاتصال بالخادم. تحقق من الاتصال وحاول مجدداً.");
        }
      });
    },
    [router, toast],
  );

  return { run, pending };
}
