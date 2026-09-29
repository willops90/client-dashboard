"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, {});

  if (state.sent) {
    return (
      <div className="notice" role="status">
        <p>
          <strong>Check your email.</strong> If <b>{state.sent}</b> has access, a sign-in link is on its way. It works once and
          expires in an hour.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="form">
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="field">
        <span>Email</span>
        <input type="email" name="email" autoComplete="email" inputMode="email" required autoFocus />
      </label>
      {state.error && (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
