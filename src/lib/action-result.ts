/** Shape returned by every server action (serialisable, never raw database rows). */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const ok = <T>(data: T, message?: string): ActionResult<T> => ({ ok: true, data, message });
