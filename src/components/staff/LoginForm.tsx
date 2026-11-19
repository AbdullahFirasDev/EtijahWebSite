"use client";

import { CircleAlert, LogIn } from "lucide-react";
import { useActionState } from "react";
import { companyLoginAction, loginAction, type LoginState } from "@/server/actions/auth";
import { Field, Input } from "./ui";

export function LoginForm({ next, realm = "staff" }: { next: string; realm?: "staff" | "company" }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(realm === "company" ? companyLoginAction : loginAction, undefined);
  return (
    <form action={action} className="grid gap-5" noValidate>
      {state?.error ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/20 bg-accent-50 p-3.5 text-sm font-bold text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.error}
        </div>
      ) : null}
      <input type="hidden" name="next" value={next} />
      <Field label="البريد الإلكتروني" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" dir="ltr" required defaultValue={state?.email} className="text-start" />
      </Field>
      <Field label="كلمة المرور" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" dir="ltr" required />
      </Field>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white border-e-transparent" /> : <LogIn className="size-5 rtl:-scale-x-100" aria-hidden="true" />}
        {pending ? "جارٍ التحقق…" : "تسجيل الدخول"}
      </button>
    </form>
  );
}
