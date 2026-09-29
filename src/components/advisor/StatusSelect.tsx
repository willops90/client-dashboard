"use client";

import { useActionState } from "react";
import { setStatus } from "@/app/admin/[slug]/actions";

type Props = {
  slug: string;
  table: "assets" | "months" | "weeks";
  id: string;
  value: string;
  options: Record<string, { label: string }>;
  label: string;
};

/** A status dropdown that saves as soon as it changes. */
export function StatusSelect({ slug, table, id, value, options, label }: Props) {
  const [state, action, pending] = useActionState(setStatus, {});
  return (
    <form action={action} className="row-actions">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <select
        className="sm"
        name="status"
        defaultValue={value}
        aria-label={label}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        disabled={pending}
      >
        {Object.entries(options).map(([k, o]) => (
          <option key={k} value={k}>
            {o.label}
          </option>
        ))}
      </select>
      {state.error && <span className="field-error">{state.error}</span>}
    </form>
  );
}
