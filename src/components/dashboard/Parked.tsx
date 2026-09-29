"use client";

import { useActionState, useEffect, useRef } from "react";
import { addParkedItem, type FormState } from "@/app/c/[slug]/actions";
import type { Parked } from "@/lib/types";

export function ParkedSection({ items, slug, canAdd }: { items: Parked[]; slug: string; canAdd: boolean }) {
  return (
    <section className="block" aria-labelledby="h-parked">
      <h2 id="h-parked">Parked for a future cycle</h2>
      <p className="lede">Real issues, but not this quarter's. We'll pick from these when we plan the next 90 days.</p>
      {items.length ? (
        <ol className="parked">
          {items.map((p) => (
            <li key={p.id}>
              {p.text} {p.category && <span>{p.category.replace(/\.?$/, ".")}</span>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty">Nothing parked yet.</p>
      )}
      {canAdd && <AddParked slug={slug} />}
    </section>
  );
}

function AddParked({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addParkedItem.bind(null, slug), {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <details className="edit">
      <summary>Park something for later</summary>
      <form ref={ref} action={action} className="form" style={{ maxWidth: 560, marginTop: 12 }}>
        <label className="field">
          <span>What is it?</span>
          <textarea name="text" rows={2} maxLength={500} required />
        </label>
        <label className="field">
          <span>
            Category <small>(optional, e.g. Customer concentration)</small>
          </span>
          <input type="text" name="category" maxLength={80} />
        </label>
        <button className="btn sm" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Park it"}
        </button>
        <span aria-live="polite">
          {state.error && <span className="field-error">{state.error}</span>}
          {state.ok && <span className="hint">{state.ok}</span>}
        </span>
      </form>
    </details>
  );
}
