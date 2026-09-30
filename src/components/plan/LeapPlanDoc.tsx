import Link from "next/link";
import { formatDate, formatValue } from "@/lib/leap";
import { calendarMonth, planLists } from "@/lib/plan-view";
import { MILESTONE_STATUS, type DashboardData } from "@/lib/types";
import { buildBreakdown } from "@/components/dashboard/PlanSections";
import { OwnerOptionalLogo } from "@/components/brand/OwnerOptionalLogo";
import { PrintButton } from "./PrintButton";

/**
 * The LEAP plan in the layout of the Expert Freedom LEAP Plan slides:
 * "Timeframes & Goals" and "Weekly Plan Breakdown", built from the same data
 * as the dashboard so there is only ever one plan.
 */
export function LeapPlanDoc({ data, backHref }: { data: DashboardData; backHref: string }) {
  const { client, cycle, kpis, months } = data;
  const { opportunities, initiatives } = planLists(data);
  const period = `${cycle.start_date.slice(0, 4)} ${formatDate(cycle.start_date, { month: "short" })}–${formatDate(cycle.end_date, { month: "short" })}`;
  const by = formatDate(cycle.end_date, { day: "numeric", month: "short" });
  const kpiLine = [
    ...kpis.map((k) => `${k.name}: ${formatValue(k.target_value, k.unit)}`),
    ...(cycle.milestones ?? []).map((m) => `${m.name}: ${(m.target ?? MILESTONE_STATUS.passed.label).toLowerCase()}`),
  ];
  const breakdown = buildBreakdown(data);

  const brand = (
    <div className="lp-brand">
      <OwnerOptionalLogo />
      {client.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={client.logo_url} alt={client.name} className="lp-client-logo" />
      ) : (
        <b>{client.name}</b>
      )}
    </div>
  );

  return (
    <div className="lp">
      <nav className="lp-bar">
        <Link href={backHref}>← Back to the dashboard</Link>
        <PrintButton />
      </nav>

      <section className="lp-slide" aria-labelledby="lp-t1">
        {brand}
        <p className="lp-tag">LEAP · Establish a Plan + Review Progress</p>
        <h1 id="lp-t1" className="lp-title">
          {period} Timeframes &amp; Goals
        </h1>
        <p className="lp-sub">
          {client.name} · cycle {cycle.number} · 90-day growth plan
        </p>

        <div className="lp-months">
          {months.map((m) => {
            const cal = calendarMonth(cycle.start_date, cycle.end_date, m.number);
            return (
              <div key={m.id} className="lp-card">
                <p className="lp-card-head">{cal.label} highlights</p>
                <p>
                  <b>{cal.dates}:</b> {m.summary}
                </p>
                {m.goal_text && (
                  <p className="lp-goal">
                    <b>Goal:</b> {m.goal_text}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {kpiLine.length > 0 && (
          <div className="lp-kpis">
            <p className="lp-card-head">
              KPIs <span className="lp-leap">· LEAP: Review Progress</span>
            </p>
            <p>
              <b>KPIs by {by}:</b> {kpiLine.join(" · ")}
            </p>
          </div>
        )}

        <div className="lp-lists">
          <div className="lp-card">
            <p className="lp-card-head">
              Strategic initiatives <span className="lp-leap">· LEAP: Limit Focus</span>
            </p>
            <ul>
              {initiatives.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div className="lp-card">
            <p className="lp-card-head">
              Growth opportunities <span className="lp-leap">· LEAP: Limit Focus</span>
            </p>
            <ul>
              {opportunities.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="lp-foot">Owner Optional Advisory · LEAP delivery</p>
      </section>

      <section className="lp-slide" aria-labelledby="lp-t2">
        {brand}
        <p className="lp-tag">LEAP · Create Assets</p>
        <h2 id="lp-t2" className="lp-title">
          {period} Weekly Plan Breakdown
        </h2>
        <div className="lp-weeks">
          {breakdown.map((m) => {
            const cal = calendarMonth(cycle.start_date, cycle.end_date, m.number);
            return (
              <div key={m.number} className="lp-card">
                <p className="lp-card-head">{cal.label}</p>
                {m.focus && (
                  <p className="lp-focus">
                    <b>Focus:</b> {m.focus}
                  </p>
                )}
                <ol>
                  {m.weeks.map((w) => (
                    <li key={w.id}>
                      <p className="lp-week">
                        Week {w.number} <span>· {w.starts}</span>
                      </p>
                      {w.meeting && (
                        <p>
                          <b>Meeting:</b> {w.meeting}
                        </p>
                      )}
                      <p>
                        <b>Asset:</b> {w.asset}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
        <p className="lp-foot">Owner Optional Advisory · LEAP delivery</p>
      </section>
    </div>
  );
}
