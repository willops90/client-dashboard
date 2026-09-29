"use client";

import { useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/app/c/[slug]/actions";

type Props = {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
  /** Clear the fields after a successful save (for "add" forms). */
  reset?: boolean;
};

export function InlineForm({ action, children, className = "form", reset }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (reset && state.ok) ref.current?.reset();
  }, [state, reset]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <span aria-live="polite">
        {pending ? (
          <span className="hint">Saving…</span>
        ) : state.error ? (
          <span className="field-error">{state.error}</span>
        ) : state.ok ? (
          <span className="hint">{state.ok}</span>
        ) : null}
      </span>
    </form>
  );
}
