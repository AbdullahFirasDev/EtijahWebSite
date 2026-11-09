"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/** Accessible modal built on <dialog> (focus trap, Escape and backdrop handled by the browser). */
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={`m-auto max-h-[92svh] w-[calc(100%-2rem)] overflow-hidden rounded-2xl bg-white p-0 text-ink shadow-2xl backdrop:bg-brand-950/60 backdrop:backdrop-blur-sm ${wide ? "max-w-3xl" : "max-w-xl"}`}
    >
      {open ? (
        <div className="flex max-h-[92svh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <h2 className="text-lg font-extrabold text-brand-950">{title}</h2>
            <button type="button" onClick={onClose} aria-label="إغلاق" className="rounded-lg p-1.5 text-muted hover:bg-mist hover:text-brand-950">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5">{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-mist/60 px-5 py-3">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}
