"use client";

import { useState } from "react";
import { WEEK_STATUS, type WeekStatus } from "@/lib/types";
import { StatusSelect } from "@/components/advisor/StatusSelect";

export type BreakdownWeek = {
  id: string;
  number: number;
  starts: string;
  meeting: string | null;
  asset: string;
  status: WeekStatus;
  shownStatus: WeekStatus;
  current: boolean;
  markerBefore: string | null;
};

export type BreakdownMonth = {
  number: number;
  title: string;
  weeksLabel: string;
  focus: string | null;
  current: boolean;
  weeks: BreakdownWeek[];
};

/**
 * Weeks grouped by month, as on the LEAP plan slides. Three columns on wide
 * screens; on a phone the months stack and only the current one starts open.
 */
export function WeeklyBreakdown({ months, slug, advisor }: { months: BreakdownMonth[]; slug: string; advisor: boolean }) {
  const [open, setOpen] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(months.map((m) => [m.number, m.current || (!months.some((x) => x.current) && m.number === months[0]?.number)])),
  );

  return (
    <div className="wb">
      {months.map((m) => {
        const isOpen = open[m.number];
        const bodyId = `wb-month-${m.number}`;
        return (
          <section key={m.number} className={`wb-month${m.current ? " now" : ""}${isOpen ? "" : " collapsed"}`} aria-label={m.title}>
            <button
              type="button"
              className="wb-head"
              aria-expanded={isOpen}
              aria-controls={bodyId}
              onClick={() => setOpen((o) => ({ ...o, [m.number]: !o[m.number] }))}
            >
              <span className="wb-title">
                {m.title} <span className="wb-weeks">({m.weeksLabel})</span>
              </span>
              {m.focus && (
                <span className="wb-focus">
                  <b>Focus:</b> {m.focus}
                </span>
              )}
            </button>
            <ol id={bodyId} className="wb-body">
              {m.weeks.map((w) => {
                const st = WEEK_STATUS[w.shownStatus];
                return (
                  <li key={w.id} className="wb-item">
                    {w.markerBefore && <p className="wb-marker">{w.markerBefore}</p>}
                    <div className={`wb-week${w.current ? " current" : ""}`} aria-current={w.current ? "true" : undefined}>
                      <div className="wb-week-head">
                        <span>
                          <b>Week {w.number}</b> <span className="hint">· {w.starts}</span>
                        </span>
                        {advisor ? (
                          <StatusSelect slug={slug} table="weeks" id={w.id} value={w.status} options={WEEK_STATUS} label={`Week ${w.number} status`} />
                        ) : (
                          <span className={`tag ${st.key}`}>{st.label}</span>
                        )}
                      </div>
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
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
