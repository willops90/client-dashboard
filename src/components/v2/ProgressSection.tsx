import { DRAG_LABELS, type DashboardData } from "@/lib/types";
import { KpiTiles } from "./KpiTiles";
import { PillarHead } from "./Pillar";

/** P · Progress: data over drama. The KPIs week by week, the scorecard, and the check-ins. */
export function ProgressSection({ data, reviewPhase }: { data: DashboardData; reviewPhase: boolean }) {
  const { cycle, day, scorecard, checkins, currentWeek } = data;
  const weeks = Array.from({ length: Math.max(0, Math.min(currentWeek - 1, 13)) }, (_, i) => i + 1);
  return (
    <section className="block" aria-labelledby="h-progress">
      <PillarHead k="P" />
      {reviewPhase && (
        <p className="notice warn v2-review-note">
          <b>Review phase.</b> Days 60 to 90 are for testing each asset against the numbers and fixing the weakest one. No new initiatives until the next cycle.
        </p>
      )}
      <KpiTiles kpis={data.kpis} milestones={cycle.milestones ?? []} day={day} endDate={cycle.end_date} goalNote={cycle.goal_note} />

      {weeks.length > 0 && (
        <div className="v2-checkins">
          <p className="v2-kicker">Friday check-ins</p>
          <ul aria-label="Check-ins by week">
            {weeks.map((w) => {
              const inn = checkins.some((c) => c.week_number === w);
              return (
                <li key={w} className={inn ? "in" : "missed"} title={`Week ${w}: ${inn ? "in" : "missed"}`}>
                  <span aria-hidden="true">{w}</span>
                  <span className="sr-only">
                    Week {w}: {inn ? "in" : "missed"}
                  </span>
                </li>
              );
            })}
          </ul>
          <span className="hint">
            {weeks.filter((w) => checkins.some((c) => c.week_number === w)).length} of {weeks.length} in
          </span>
        </div>
      )}

      {scorecard.length > 0 && (
        <div className="v2-score">
          <p className="v2-kicker">Sale-readiness scorecard</p>
          <p className="hint">How a buyer would score the business today, out of 10. Re-scored on day 90.</p>
          <div className="score">
            {scorecard.map((s) => {
              const name = DRAG_LABELS[s.drag];
              const showTarget = s.in_focus && s.target;
              return (
                <div key={s.id} className="score-row">
                  <div className="lbl">
                    {name}
                    {s.in_focus && <small className="v2-focus-chip">In focus</small>}
                  </div>
                  <div className="bar" role="img" aria-label={`${name}: ${s.score} out of 10${showTarget ? `, target ${s.target}` : ""}`}>
                    <div className={`fill${s.in_focus ? " on" : ""}`} style={{ width: `${s.score * 10}%` }} />
                    {showTarget && <div className="tgt" style={{ left: `calc(${s.target! * 10}% - 1px)` }} />}
                  </div>
                  <div className="num">
                    <b>{s.score}</b>/10{showTarget && ` → ${s.target}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
