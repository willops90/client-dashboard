import { BUILD_PHASE_END_DAY, addDays, formatDate, formatValue, kpiStatus, latestReading, monthRange, weekStart } from "@/lib/leap";
import { ASSET_STATUS, DRAG_LABELS, MILESTONE_STATUS, MONTH_STATUS, type DashboardData } from "@/lib/types";
import { LeapTag } from "./LeapTag";
import { WeeklyBreakdown, type BreakdownMonth } from "./WeeklyBreakdown";
import { StatusSelect } from "@/components/advisor/StatusSelect";
import { AssetPreviewControl } from "./AssetCard";

export function PlanSection({ data }: { data: DashboardData }) {
  const { cycle, months, planPairs, day, viewer, client } = data;
  const currentMonth = day >= 1 && day <= 90 ? Math.min(3, Math.floor((day - 1) / 30) + 1) : 0;
  return (
    <section className="block" aria-labelledby="h-plan">
      <h2 id="h-plan">
        The 90-day plan
        <LeapTag stage="Establish a Plan" />
      </h2>
      <p className="lede">
        Agreed at the planning meeting on {formatDate(cycle.start_date)}. One goal for the quarter. Everything else waits.
      </p>
      <div className="focus">
        <p className="k">The one goal this cycle</p>
        <p className="v">{cycle.goal_title}</p>
        {cycle.goal_why && <p className="sub">{cycle.goal_why}</p>}
      </div>
      <KpiBand data={data} />
      {planPairs.length > 0 && (
        <>
          <h3 className="sub-h">
            Growth opportunities / Strategic initiatives
            <LeapTag stage="Limit Focus" />
          </h3>
          <div className="pairs">
            <div className="hd">
              <b>Growth opportunities</b>
              <span>The problems worth solving</span>
            </div>
            <div className="hd">
              <b>Strategic initiatives</b>
              <span>What we're doing about them</span>
            </div>
            {planPairs.flatMap((p) => [
              <div key={`${p.id}-p`} className="c">
                {p.problem}
              </div>,
              <div key={`${p.id}-i`} className="c">
                {p.initiative}
              </div>,
            ])}
          </div>
        </>
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
                  Month {m.number} highlights
                  {m.number === currentMonth ? ", now" : ""}
                </p>
                <p className="d">
                  {formatDate(range.from)} to {formatDate(to)}
                </p>
                <p>{m.summary}</p>
                <p>
                  <span className={`tag ${st.key}`}>{st.label}</span>
                </p>
                {viewer.kind === "advisor" && (
                  <StatusSelect slug={client.slug} table="months" id={m.id} value={m.status} options={MONTH_STATUS} label={`Month ${m.number} status`} />
                )}
                {m.goal_text && (
                  <p className="goal">
                    <b>Goal:</b> {m.goal_text}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Every KPI's target, where it stands now and its status, plus any pass/fail milestones. */
function KpiBand({ data }: { data: DashboardData }) {
  const { kpis, cycle } = data;
  const milestones = cycle.milestones ?? [];
  if (!kpis.length && !milestones.length) return null;
  const by = formatDate(cycle.end_date, { day: "numeric", month: "short" });
  return (
    <section className="kpi-band" aria-labelledby="h-kpis">
      <h3 id="h-kpis">
        KPIs
        <LeapTag stage="Review Progress" />
      </h3>
      <ul>
        {kpis.map((k) => {
          const last = latestReading(k.readings);
          const st = kpiStatus(k, k.readings);
          return (
            <li key={k.id}>
              <p className="kb-name">
                {k.name}
                {k.is_primary && <span className="badge teal">Primary</span>}
              </p>
              <p className="kb-target">{formatValue(k.target_value, k.unit)}</p>
              <p className="kb-meta">Target by {by}</p>
              <p className="kb-now">Now: {last ? formatValue(last.value, k.unit) : "no reading yet"}</p>
              <span className={`pill ${st.key}`}>{st.label}</span>
            </li>
          );
        })}
        {milestones.map((m) => {
          const st = MILESTONE_STATUS[m.status ?? "not_started"];
          return (
            <li key={m.name}>
              <p className="kb-name">{m.name}</p>
              <p className="kb-target">{m.target ?? "Passed"}</p>
              <p className="kb-meta">Pass/fail by {by}</p>
              <p className="kb-now">Now: {st.label.toLowerCase()}</p>
              <span className={`pill ${st.key}`}>{st.label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function AssetsSection({ data }: { data: DashboardData }) {
  const { assets, client, viewer } = data;
  const shortName = client.name.replace(/\s+(Co\.?|Pty\.? Ltd\.?|Ltd\.?|Inc\.?)$/i, "");
  return (
    <section className="block" aria-labelledby="h-assets">
      <h2 id="h-assets">
        Assets we're building
        <LeapTag stage="Create Assets" />
      </h2>
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

/** Weeks grouped by month for the weekly breakdown (and the v2 week strip). */
export function buildBreakdown(data: DashboardData): BreakdownMonth[] {
  const { weeks, months, cycle, currentWeek, day } = data;
  const inCycle = day >= 1 && day <= 90;
  // Day 60 falls in week 9, so the review phase marker sits before week 10.
  const firstReviewWeek = Math.ceil(BUILD_PHASE_END_DAY / 7) + 1;
  const monthOfWeek = (n: number) => {
    const set = months.find((m) => m.first_week && m.last_week && n >= m.first_week && n <= m.last_week);
    if (set) return set.number;
    return Math.min(3, Math.floor(((n - 1) * 7) / 30) + 1);
  };
  return [1, 2, 3]
    .map((n) => {
      const m = months.find((x) => x.number === n);
      const inMonth = weeks.filter((w) => monthOfWeek(w.number) === n);
      const first = inMonth[0]?.number;
      const last = inMonth.at(-1)?.number;
      return {
        number: n,
        title: `Month ${n}`,
        weeksLabel: first === last ? `week ${first}` : `weeks ${first}–${last}`,
        focus: m?.focus ?? null,
        current: inCycle && inMonth.some((w) => w.number === currentWeek),
        weeks: inMonth.map((w) => {
          const current = inCycle && w.number === currentWeek;
          return {
            id: w.id,
            number: w.number,
            starts: formatDate(weekStart(cycle.start_date, w.number), { day: "numeric", month: "short" }),
            meeting: w.meeting,
            asset: w.asset,
            status: w.status,
            // Status comes from the advisor; the current week always reads "This week".
            shownStatus: current && w.status === "upcoming" ? ("this_week" as const) : w.status,
            current,
            markerBefore:
              w.number === 1
                ? `Planning meeting, ${formatDate(cycle.start_date)}: focus limited and plan established (L and E)`
                : w.number === firstReviewWeek
                  ? `Day 60, ${formatDate(addDays(cycle.start_date, BUILD_PHASE_END_DAY - 1))}: review progress against the goal (P)`
                  : null,
          };
        }),
      };
    })
    .filter((g) => g.weeks.length > 0);
}

export function WeeksSection({ data }: { data: DashboardData }) {
  const { viewer, client } = data;
  const groups = buildBreakdown(data);
  return (
    <section className="block" aria-labelledby="h-weeks">
      <h2 id="h-weeks">
        Weekly breakdown
        <LeapTag stage="Create Assets" />
      </h2>
      <p className="lede">Strategy meetings are fortnightly. You get a Monday update every week, meeting or not.</p>
      <WeeklyBreakdown months={groups} slug={client.slug} advisor={viewer.kind === "advisor"} />
    </section>
  );
}

export function ScorecardSection({ data }: { data: DashboardData }) {
  const { scorecard } = data;
  if (!scorecard.length) return null;
  const focus = scorecard.filter((s) => s.in_focus).map((s) => DRAG_LABELS[s.drag].toLowerCase());
  return (
    <section className="block" aria-labelledby="h-score">
      <h2 id="h-score">
        Sale-readiness scorecard
        <LeapTag stage="Review Progress" />
      </h2>
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
