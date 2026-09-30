import Link from "next/link";
import { MONTH_STATUS, type DashboardData } from "@/lib/types";
import { calendarMonth, planLists } from "@/lib/plan-view";
import { buildBreakdown } from "@/components/dashboard/PlanSections";
import { PillarHead } from "./Pillar";
import { WeekStrip } from "./WeekStrip";

export function planPageHref(data: DashboardData): string {
  return data.viewer.kind === "demo" ? "/demo-v2/plan" : `/c/${data.client.slug}/plan`;
}

/**
 * E · Plan, in the structure of the LEAP plan slide: growth opportunities and
 * strategic initiatives as two lists, month highlights named by the calendar
 * with a goal each, and the weekly timeline.
 */
export function PlanCard({ data }: { data: DashboardData }) {
  const { cycle, months, day } = data;
  const { opportunities, initiatives } = planLists(data);
  const currentMonth = day >= 1 && day <= 90 ? Math.min(3, Math.floor((day - 1) / 30) + 1) : 0;

  return (
    <section className="block" aria-labelledby="h-plan">
      <PillarHead k="E" />
      <p className="v2-plan-link">
        <Link href={planPageHref(data)}>View the full LEAP plan</Link>
        <span className="hint"> · to present or save as PDF</span>
      </p>

      {(opportunities.length > 0 || initiatives.length > 0) && (
        <div className="v2-lists">
          <div>
            <p className="v2-list-head">
              <b>Growth opportunities</b>
              <span>The problems worth solving</span>
            </p>
            <ol>
              {opportunities.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ol>
          </div>
          <div>
            <p className="v2-list-head">
              <b>Strategic initiatives</b>
              <span>What we&apos;re doing about them</span>
            </p>
            <ol>
              {initiatives.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {months.length > 0 && (
        <ol className="v2-months">
          {months.map((m) => {
            const st = MONTH_STATUS[m.status];
            const cal = calendarMonth(cycle.start_date, cycle.end_date, m.number);
            return (
              <li key={m.id} className={`v2-month ${st.key}${m.number === currentMonth ? " now" : ""}`}>
                <p className="v2-month-head">
                  <b>{cal.label} highlights</b>
                  <span className={`tag ${st.key}`}>{m.number === currentMonth && m.status === "upcoming" ? "Now" : st.label}</span>
                </p>
                <p className="v2-month-text">
                  <span className="hint">{cal.dates}:</span> {m.summary}
                </p>
                {m.goal_text && (
                  <p className="v2-month-goal">
                    <b>Goal:</b> {m.goal_text}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <div className="v2-timeline">
        <p className="v2-kicker">Weekly plan breakdown</p>
        <WeekStrip
          months={buildBreakdown(data)}
          slug={data.client.slug}
          advisor={data.viewer.kind === "advisor"}
          labels={Object.fromEntries([1, 2, 3].map((n) => [n, calendarMonth(cycle.start_date, cycle.end_date, n).label]))}
        />
      </div>
    </section>
  );
}
