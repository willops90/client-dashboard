"use client";

import { useState } from "react";
import { WEEK_STATUS } from "@/lib/types";
import { WeeklyBreakdown, type BreakdownMonth } from "@/components/dashboard/WeeklyBreakdown";

/**
 * Thirteen weeks at a glance. Tap a week to see its meeting and asset; the
 * full month-by-month breakdown sits behind "See all weeks".
 */
export function WeekStrip({
  months,
  slug,
  advisor,
  labels,
}: {
  months: BreakdownMonth[];
  slug: string;
  advisor: boolean;
  /** Month labels, e.g. calendar months ("Aug/Sept"); defaults to "Month 1". */
  labels?: Record<number, string>;
}) {
  const weeks = months.flatMap((m) => m.weeks.map((w) => ({ ...w, month: m.number })));
  const current = weeks.find((w) => w.current) ?? weeks[0];
  const [selected, setSelected] = useState(current?.number);
  const w = weeks.find((x) => x.number === selected);
  if (!w) return null;
  const st = WEEK_STATUS[w.shownStatus];

  return (
    <>
      <div className="v2-strip-months" aria-hidden="true">
        {months.map((m) => (
          <span key={m.number} style={{ flexGrow: m.weeks.length }}>
            {labels?.[m.number] ?? `Month ${m.number}`}
          </span>
        ))}
      </div>
      <div className="v2-strip" role="group" aria-label="Weeks. Choose one to see its meeting and asset.">
        {weeks.map((x, i) => (
          <button
            key={x.id}
            type="button"
            className={`v2-cell ${x.shownStatus}${x.current ? " current" : ""}${i > 0 && weeks[i - 1].month !== x.month ? " month-start" : ""}`}
            aria-pressed={x.number === selected}
            aria-label={`Week ${x.number}, ${WEEK_STATUS[x.shownStatus].label}${x.meeting ? ", meeting" : ""}`}
            onClick={() => setSelected(x.number)}
          >
            <span>{x.number}</span>
            {x.meeting && <i className="v2-cell-dot" />}
          </button>
        ))}
      </div>
      <p className="v2-strip-key hint">
        <span>
          <i className="v2-cell-dot" /> Meeting week
        </span>
        <span>
          <i className="v2-key-box current" /> This week
        </span>
        <span>
          <i className="v2-key-box done" /> Done
        </span>
      </p>
      <div className="v2-week-detail" aria-live="polite">
        <p className="wb-week-head">
          <span>
            <b>Week {w.number}</b> <span className="hint">· {w.starts}</span>
          </span>
          <span className={`tag ${st.key}`}>{st.label}</span>
        </p>
        {w.markerBefore && <p className="hint">{w.markerBefore}</p>}
        {w.meeting && (
          <p>
            <span className="wb-label">Meeting:</span> {w.meeting}
          </p>
        )}
        <p>
          <span className="wb-label">Asset:</span> {w.asset}
        </p>
        {!w.meeting && <p className="wb-note">Monday update</p>}
      </div>
      <details className="v2-more">
        <summary>See all weeks</summary>
        <WeeklyBreakdown months={months} slug={slug} advisor={advisor} />
      </details>
    </>
  );
}
