"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setActionDone } from "@/app/c/[slug]/actions";

type Props = {
  slug: string;
  actionId: string;
  done: boolean;
  label: string;
  canTick: boolean;
  /** On /demo, ticks only live in the browser. */
  demo?: boolean;
};

export function ActionTick({ slug, actionId, done, label, canTick, demo }: Props) {
  const [demoDone, setDemoDone] = useState(done);
  const [optimistic, setOptimistic] = useOptimistic(done);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const checked = demo ? demoDone : optimistic;

  function onChange(next: boolean) {
    if (demo) return setDemoDone(next);
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      const r = await setActionDone(slug, actionId, next);
      if (r.error) setError(r.error);
    });
  }

  return (
    <>
      <input
        type="checkbox"
        id={`act-${actionId}`}
        checked={checked}
        disabled={!canTick}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={canTick ? undefined : `${label} (only the owner can tick this)`}
      />
      {error && <span className="sr-only" role="alert">{error}</span>}
    </>
  );
}
