import { formatDate, monthRange } from "@/lib/leap";
import { MONTH_STATUS, type DashboardData } from "@/lib/types";
import { Stage } from "./Journey";

/** How the goal gets met: one-line opportunity → initiative pairs that expand, and a three-month strip. The goal itself is at the top of the page. */
export function PlanCard({ data }: { data: DashboardData }) {
  const { cycle, planPairs, months, day } = data;
  const currentMonth = day >= 1 && day <= 90 ? Math.min(3, Math.floor((day - 1) / 30) + 1) : 0;
  return (
    <section className="block" aria-labelledby="h-plan">
      <h2 id="h-plan">
        How we&apos;ll get there <Stage k="E" />
      </h2>

      {planPairs.length > 0 && (
        <div className="v2-pairs">
          <p className="v2-pairs-head" aria-hidden="true">
            <span>Growth opportunity</span>
            <span>Strategic initiative</span>
          </p>
          {planPairs.map((p) => (
            <details key={p.id} className="v2-pair">
              <summary>
                <span className="v2-pair-p">{p.problem_short ?? p.problem}</span>
                <span className="v2-pair-i">
                  <span className="v2-arrow" aria-label="solved by">
                    →
                  </span>
                  {p.initiative_short ?? p.initiative}
                </span>
              </summary>
              <div className="v2-pair-body">
                <p>
                  <span className="hint">The problem</span>
                  {p.problem}
                </p>
                <p>
                  <span className="hint">What we're doing</span>
                  {p.initiative}
                </p>
              </div>
            </details>
          ))}
        </div>
      )}

      {months.length > 0 && (
        <ol className="v2-months">
          {months.map((m) => {
            const st = MONTH_STATUS[m.status];
            const r = monthRange(cycle.start_date, m.number);
            return (
              <li key={m.id} className={`v2-month ${st.key}${m.number === currentMonth ? " now" : ""}`}>
                <p className="v2-month-head">
                  <b>Month {m.number}</b>
                  <span className={`tag ${st.key}`}>{m.number === currentMonth && m.status === "upcoming" ? "Now" : st.label}</span>
                </p>
                {m.goal_text && (
                  <p className="v2-month-goal">
                    <b>Goal:</b> {m.goal_text}
                  </p>
                )}
                <details className="v2-more">
                  <summary>Highlights</summary>
                  <p className="hint">
                    {formatDate(r.from, { day: "numeric", month: "short" })} to{" "}
                    {formatDate(m.number === 3 ? cycle.end_date : r.to, { day: "numeric", month: "short" })}
                  </p>
                  <p>{m.summary}</p>
                </details>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
