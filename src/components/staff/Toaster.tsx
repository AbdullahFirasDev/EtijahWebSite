"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ToastKind = "success" | "error";
interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

const ToastContext = createContext<{ success: (t: string) => void; error: (t: string) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <Toaster>");
  return ctx;
}

let seq = 0;

/** Success/error notifications for staff actions (announced to screen readers). */
export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (kind: ToastKind, text: string) => {
      const id = ++seq;
      setToasts((all) => [...all.slice(-3), { id, kind, text }]);
      setTimeout(() => dismiss(id), kind === "error" ? 9000 : 4500);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ success: (t: string) => push("success", t), error: (t: string) => push("error", t) }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            data-toast={t.kind}
            data-toast-id={t.id}
            className={`pointer-events-auto flex w-full max-w-lg items-start gap-3 rounded-2xl px-4 py-3 text-sm font-bold shadow-[0_18px_40px_-14px_rgb(5_28_51/0.45)] motion-safe:animate-[menu-in_0.35s_var(--ease-out-expo)_both] ${
              t.kind === "error" ? "bg-[#a42424] text-white" : "bg-brand-950 text-white"
            }`}
          >
            {t.kind === "error" ? <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" /> : <CircleCheck className="mt-0.5 size-5 shrink-0 text-accent-400" aria-hidden="true" />}
            <p className="flex-1 leading-[1.7]">{t.text}</p>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="إغلاق" className="rounded-lg p-0.5 opacity-70 hover:opacity-100">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
