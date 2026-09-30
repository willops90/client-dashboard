import { DRAG_LABELS, type DashboardData } from "@/lib/types";
import { CYCLE_DAYS, formatDate } from "@/lib/leap";
import { ExitStrip } from "@/components/dashboard/ExitStrip";
import { OwnerOptionalLogo } from "@/components/brand/OwnerOptionalLogo";
import { buildBreakdown } from "@/components/dashboard/PlanSections";
import { KpiTiles } from "./KpiTiles";
import { Journey, Stage } from "./Journey";
import { ThisWeek } from "./ThisWeek";
import { PlanCard } from "./PlanCard";
import { AssetChecklist } from "./AssetChecklist";
import { WeekStrip } from "./WeekStrip";

/**
 * The simplified layout: answers "are we on track?", "what's next?" and
 * "where is this going?" in that order, with detail one tap away.
 */
export function DashboardV2({ data }: { data: DashboardData }) {
  const { client, cycle, day, viewer } = data;
  const inCycle = day >= 1 && day <= CYCLE_DAYS;
  return (
    <div className="wrap v2">
      <header className="v2-brandbar">
        <OwnerOptionalLogo />
        <div className="v2-client">
          {client.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={client.logo_url} alt={client.name} className="v2-client-logo" />
          ) : (
            <span className="v2-client-name">{client.name}</span>
          )}
          {viewer.kind === "demo" && <span className="badge">Demo, made-up data</span>}
        </div>
      </header>
      <ExitStrip data={data} variant="bar" />

      <Journey day={day} />

      <section className="v2-hero" aria-labelledby="headline">
        <p className="eyebrow">
          This cycle&apos;s goal <Stage k="P" />
        </p>
        <h1 id="headline" className="v2-h1">
          {cycle.goal_short ?? cycle.goal_title}
        </h1>
        {cycle.goal_why && <p className="v2-why">{cycle.goal_why}</p>}
        <p className="cycle">
          {formatDate(cycle.start_date)} to {formatDate(cycle.end_date)}
          {inCycle ? ` · day ${day} of ${CYCLE_DAYS}` : ""}
        </p>
        <KpiTiles kpis={data.kpis} milestones={cycle.milestones ?? []} day={day} endDate={cycle.end_date} goalNote={cycle.goal_note} />
      </section>

      <ThisWeek data={data} />
      <PlanCard data={data} />
      <AssetChecklist data={data} />

      <section className="block" aria-labelledby="h-weeks">
        <h2 id="h-weeks">
          Weekly breakdown <Stage k="A" />
        </h2>
        <WeekStrip months={buildBreakdown(data)} slug={client.slug} advisor={viewer.kind === "advisor"} />
      </section>

      {data.scorecard.length > 0 && (
        <section className="block" aria-labelledby="h-score">
          <h2 id="h-score">
            Sale-readiness scorecard <Stage k="P" />
          </h2>
          <p className="lede">How a buyer would score the business today, out of 10. Re-scored on day 90.</p>
          <div className="score">
            {data.scorecard.map((s) => {
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
        </section>
      )}

      {data.parked.length > 0 && (
        <section className="block v2-parked" aria-label="Parked for later">
          <details className="v2-more">
            <summary>
              {data.parked.length} idea{data.parked.length === 1 ? "" : "s"} parked for a future cycle
            </summary>
            <ol className="parked">
              {data.parked.map((p) => (
                <li key={p.id}>
                  {p.text} {p.planned_cycle && <span className="tag teal">Cycle {p.planned_cycle}</span>}
                </li>
              ))}
            </ol>
          </details>
        </section>
      )}

      <footer>
        {viewer.kind === "demo" && `${client.name}, its people and every number on this page are made up. `}
        Built on the LEAP method: limit the focus, establish a plan, create assets, review progress.
      </footer>
    </div>
  );
}
