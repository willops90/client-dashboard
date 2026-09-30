import Markdown from "react-markdown";
import { BUILD_PHASE_END_DAY, CYCLE_DAYS, formatDate, formatValue, kpiStatus, latestReading } from "@/lib/leap";
import { formatMeetingTime, tzAbbrev } from "@/lib/format";
import { MONTH_STATUS, type DashboardData } from "@/lib/types";
import { PILLARS, type PillarKey } from "./Pillar";

export function currentPillar(day: number): PillarKey {
  return day < 1 ? "E" : day <= BUILD_PHASE_END_DAY ? "A" : "P";
}

/** This LEAP cycle at a glance: the cycle dates, where we are in the 90 days, one line per pillar, and the next meeting. */
export function Glance({ data }: { data: DashboardData }) {
  const { cycle, day, months, assets, kpis, nextMeeting: m, client } = data;
  const now = currentPillar(day);
  const inCycle = day >= 1 && day <= CYCLE_DAYS;
  const monthNow = inCycle ? Math.min(3, Math.floor((day - 1) / 30) + 1) : null;
  const month = months.find((x) => x.number === monthNow);
  const primary = kpis.find((k) => k.is_primary) ?? kpis[0];
  const last = primary ? latestReading(primary.readings) : undefined;
  const st = primary ? kpiStatus(primary, primary.readings) : null;
  const done = assets.filter((a) => a.status === "done").length;

  const lines: Record<PillarKey, React.ReactNode> = {
    L: cycle.goal_short ?? cycle.goal_title,
    E: monthNow ? (
      <>
        Month {monthNow} of 3{month && <span className={`tag ${MONTH_STATUS[month.status].key}`}>{MONTH_STATUS[month.status].label}</span>}
      </>
    ) : (
      "Agreed at the planning meeting"
    ),
    A: `${done} of ${assets.length} assets done`,
    P:
      primary && last && st ? (
        <>
          {formatValue(last.value, primary.unit)} → {formatValue(primary.target_value, primary.unit)}
          <span className={`tag ${st.key}`}>{st.label}</span>
        </>
      ) : (
        "First numbers come with Friday's check-in"
      ),
  };

  return (
    <section className="v2-glance" aria-labelledby="h-glance">
      <div className="v2-glance-head">
        <h2 id="h-glance">
          This LEAP cycle at a glance
          <span className="v2-glance-dates">
            {formatDate(cycle.start_date, { day: "numeric", month: "short" })} – {formatDate(cycle.end_date, { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </h2>
        {inCycle && (
          <span className="hint">
            Day {day} of {CYCLE_DAYS}
          </span>
        )}
      </div>
      {inCycle && (
        <div className="v2-daybar" aria-hidden="true">
          <span className="v2-daybar-a" style={{ width: `${(BUILD_PHASE_END_DAY / CYCLE_DAYS) * 100}%` }} />
          <span className="v2-daybar-fill" style={{ width: `${(day / CYCLE_DAYS) * 100}%` }} />
        </div>
      )}
      <ul className="v2-glance-tiles">
        {(Object.keys(PILLARS) as PillarKey[]).map((k) => (
          <li key={k} className={k === now ? "now" : undefined}>
            <a href={`#h-${PILLARS[k].id}`}>
              <span className="v2-glance-k">
                <b>{k}</b> {PILLARS[k].name}
                {k === now && <span className="v2-now">Now</span>}
              </span>
              <span className="v2-glance-line">{lines[k]}</span>
            </a>
          </li>
        ))}
      </ul>
      {m && (
        <div className="v2-next">
          <span>
            <b>Next meeting:</b> {formatMeetingTime(m.starts_at, client.timezone).replace(/^(\w{3})\w*/, "$1")}{" "}
            <span className="hint">{tzAbbrev(m.starts_at, client.timezone)}</span>
          </span>
          <span className="row-actions">
            {m.link && (
              <a className="btn sm" href={m.link} target="_blank" rel="noreferrer">
                Join
              </a>
            )}
            {m.agenda && (
              <details className="v2-more inline">
                <summary>Agenda</summary>
                <div className="md">
                  <Markdown>{m.agenda}</Markdown>
                </div>
              </details>
            )}
          </span>
        </div>
      )}
    </section>
  );
}
