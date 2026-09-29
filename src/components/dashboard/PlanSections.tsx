import { BUILD_PHASE_END_DAY, formatDate, monthRange, weekStart, addDays } from "@/lib/leap";
import { ASSET_STATUS, DRAG_LABELS, MONTH_STATUS, WEEK_STATUS, type DashboardData, type WeekStatus } from "@/lib/types";
import { StatusSelect } from "@/components/advisor/StatusSelect";
import { AssetPreviewControl } from "./AssetCard";

export function PlanSection({ data }: { data: DashboardData }) {
  const { cycle, months, planPairs, day, viewer, client } = data;
  const currentMonth = day >= 1 && day <= 90 ? Math.min(3, Math.floor((day - 1) / 30) + 1) : 0;
  return (
    <section className="block" aria-labelledby="h-plan">
      <h2 id="h-plan">The 90-day plan</h2>
      <p className="lede">
        Agreed at the planning meeting on {formatDate(cycle.start_date)}. One goal for the quarter. Everything else waits.
      </p>
      <div className="focus">
        <p className="k">The one goal this cycle</p>
        <p className="v">{cycle.goal_title}</p>
        {cycle.goal_why && <p className="sub">{cycle.goal_why}</p>}
      </div>
      {planPairs.length > 0 && (
        <div className="pairs">
          <div className="hd">Problems worth solving</div>
          <div className="hd">What we're doing about them</div>
          {planPairs.flatMap((p) => [
            <div key={`${p.id}-p`} className="c">
              {p.problem}
            </div>,
            <div key={`${p.id}-i`} className="c">
              {p.initiative}
            </div>,
          ])}
        </div>
      )}
      {months.length > 0 && (
        <div className="months">
          {months.map((m) => {
            const range = monthRange(cycle.start_date, m.number);
            const to = m.number === 3 ? cycle.end_date : range.to;
            const st = MONTH_STATUS[m.status];
            return (
              <div key={m.id} className={`month${m.number === currentMonth ? " now" : ""}`}>
                <p className="m">
                  Month {m.number}
                  {m.number === currentMonth ? ", now" : ""}
                </p>
                <p className="d">
                  {formatDate(range.from)} to {formatDate(to)}
                </p>
                <p>{m.summary}</p>
                <p className="goal">
                  <span className={`tag ${st.key}`}>{st.label}</span> {m.goal_text && <>Goal: {m.goal_text}</>}
                </p>
                {viewer.kind === "advisor" && (
                  <StatusSelect slug={client.slug} table="months" id={m.id} value={m.status} options={MONTH_STATUS} label={`Month ${m.number} status`} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function AssetsSection({ data }: { data: DashboardData }) {
  const { assets, client, viewer } = data;
  const shortName = client.name.replace(/\s+(Co\.?|Pty\.? Ltd\.?|Ltd\.?|Inc\.?)$/i, "");
  return (
    <section className="block" aria-labelledby="h-assets">
      <h2 id="h-assets">Assets we're building</h2>
      <p className="lede">These stay with {shortName} after the cycle ends. You own them and keep them up to date.</p>
      {assets.length ? (
        <ul className="asset-cards">
          {assets.map((a) => {
            const st = ASSET_STATUS[a.status];
            const label =
              a.status === "not_started" && a.due_week
                ? `Due week ${a.due_week}`
                : a.status === "drafting" && a.due_week
                  ? `Drafting (week ${a.due_week})`
                  : st.label;
            return (
              <li key={a.id} className="asset-card">
                <div className="asset-top">
                  <h3 className="n">{a.link ? <a href={a.link} target="_blank" rel="noreferrer">{a.name}</a> : a.name}</h3>
                  {viewer.kind === "advisor" ? (
                    <StatusSelect slug={client.slug} table="assets" id={a.id} value={a.status} options={ASSET_STATUS} label={`${a.name} status`} />
                  ) : (
                    <span className={`tag ${st.key}`}>{label}</span>
                  )}
                </div>
                {a.description && <p className="x">{a.description}</p>}
                <div className="asset-foot">
                  {a.built_on && <span className="built-on">Built on {a.built_on}</span>}
                  <AssetPreviewControl asset={a} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty">No assets loaded yet.</p>
      )}
    </section>
  );
}

export function WeeksSection({ data }: { data: DashboardData }) {
  const { weeks, cycle, currentWeek, day, viewer, client } = data;
  const inCycle = day >= 1 && day <= 90;
  // Day 60 falls in week 9, so the review phase divider sits before week 10.
  const firstReviewWeek = Math.ceil(BUILD_PHASE_END_DAY / 7) + 1;
  return (
    <section className="block" aria-labelledby="h-weeks">
      <h2 id="h-weeks">Week by week</h2>
      <p className="lede">Strategy meetings are fortnightly. You get a Monday update every week, meeting or not.</p>
      <div className="scroll" tabIndex={0} role="region" aria-label="Week by week table">
        <table className="weeks-table">
          <thead>
            <tr>
              <th>Week</th>
              <th>Starts</th>
              <th>Meeting</th>
              <th>Asset</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr className="phase">
              <td colSpan={5}>Planning meeting, {formatDate(cycle.start_date)}: focus limited and plan established (L and E)</td>
            </tr>
            {weeks.flatMap((w) => {
              const current = inCycle && w.number === currentWeek;
              // Status comes from the advisor; the current week always reads "This week".
              const status: WeekStatus = current && w.status === "upcoming" ? "this_week" : w.status;
              const st = WEEK_STATUS[status];
              const rows = [];
              if (w.number === firstReviewWeek) {
                rows.push(
                  <tr key="phase-p" className="phase">
                    <td colSpan={5}>
                      Day 60, {formatDate(addDays(cycle.start_date, BUILD_PHASE_END_DAY - 1))}: review progress against the goal (P)
                    </td>
                  </tr>,
                );
              }
              rows.push(
                <tr key={w.id} className={current ? "current" : undefined} aria-current={current ? "true" : undefined}>
                  <td className="wk">Week {w.number}</td>
                  <td className="dt">{formatDate(weekStart(cycle.start_date, w.number), { day: "numeric", month: "short" })}</td>
                  <td>{w.meeting || <span className="none">Monday update only</span>}</td>
                  <td>{w.asset}</td>
                  <td>
                    {viewer.kind === "advisor" ? (
                      <StatusSelect slug={client.slug} table="weeks" id={w.id} value={w.status} options={WEEK_STATUS} label={`Week ${w.number} status`} />
                    ) : (
                      <span className={`tag ${st.key}`}>{st.label}</span>
                    )}
                  </td>
                </tr>,
              );
              return rows;
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ScorecardSection({ data }: { data: DashboardData }) {
  const { scorecard } = data;
  if (!scorecard.length) return null;
  const focus = scorecard.filter((s) => s.in_focus).map((s) => DRAG_LABELS[s.drag].toLowerCase());
  return (
    <section className="block" aria-labelledby="h-score">
      <h2 id="h-score">Sale-readiness scorecard</h2>
      <p className="lede">
        What a buyer would mark the business down for, scored out of 10 at the start of the cycle.
        {focus.length > 0 && ` In focus this cycle: ${focus.join(" and ")}.`} The full re-score happens on day 90.
      </p>
      <div className="score">
        {scorecard.map((s) => {
          const name = DRAG_LABELS[s.drag];
          const showTarget = s.in_focus && s.target;
          return (
            <div key={s.id} className="score-row">
            <div className="lbl">
              {name}
              {s.note && <small>{s.note}</small>}
            </div>
            <div
              className="bar"
              role="img"
              aria-label={`${name}: ${s.score} out of 10${showTarget ? `, target ${s.target}` : ""}`}
            >
              <div className={`fill${s.in_focus ? " on" : ""}`} style={{ width: `${s.score * 10}%` }} />
              {showTarget && <div className="tgt" style={{ left: `calc(${s.target! * 10}% - 1px)` }} title={`Target ${s.target}`} />}
            </div>
            <div className="num">
              <b>{s.score}</b>/10{showTarget && ` → target ${s.target}`}
            </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
