import { roadmapCycleRange, roadmapStatus, type RoadmapStatus } from "@/lib/leap";
import type { DashboardData } from "@/lib/types";

const STATUS: Record<RoadmapStatus, { label: string; key: string }> = {
  done: { label: "Done", key: "good" },
  now: { label: "Now", key: "teal" },
  next: { label: "Next", key: "warn" },
  planned: { label: "Planned", key: "idle" },
};

/** The long view: where this cycle sits on the road to a sale. Collapsed by default. */
export function ExitStrip({ data, variant = "strip" }: { data: DashboardData; variant?: "strip" | "bar" }) {
  const { client, cycle } = data;
  if (!client.exit_goal) return null;
  const total = client.exit_cycles_estimate;
  const roadmap = [...(client.exit_roadmap ?? [])].sort((a, b) => a.cycle - b.cycle);

  if (variant === "bar") {
    const count = Math.max(total ?? 0, cycle.number, ...roadmap.map((r) => r.cycle));
    return (
      <details className="exit-strip cycles-bar">
        <summary>
          <span className="cb-line">
            <span>
              <b>Exit goal:</b> {client.exit_goal.replace(/^./, (c) => c.toLowerCase())}
            </span>
            {roadmap.length > 0 && <span className="exit-toggle">Roadmap</span>}
          </span>
          <span className="cb-track" aria-label={`Cycle ${cycle.number} of about ${count}`}>
            {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
              <span key={n} className={`cb-seg ${roadmapStatus(n, cycle.number)}`} title={roadmap.find((r) => r.cycle === n)?.focus}>
                {n === cycle.number ? `Cycle ${n}` : n}
              </span>
            ))}
          </span>
          <span className="cb-caption">
            Cycle {cycle.number} of about {count}
            {roadmap.find((r) => r.cycle === cycle.number) ? `: ${roadmap.find((r) => r.cycle === cycle.number)!.focus.toLowerCase()}` : ""}
          </span>
        </summary>
        {roadmap.length > 0 && <Roadmap data={data} roadmap={roadmap} />}
      </details>
    );
  }

  return (
    <details className="exit-strip">
      <summary>
        <span>
          <b>Exit goal:</b> {client.exit_goal.replace(/^./, (c) => c.toLowerCase())}
        </span>
        <span aria-hidden="true"> · </span>
        <span>
          <b>
            Cycle {cycle.number}
            {total ? ` of about ${total}` : ""}
          </b>
        </span>
        {roadmap.length > 0 && <span className="exit-toggle">Roadmap</span>}
      </summary>
      {roadmap.length > 0 && <Roadmap data={data} roadmap={roadmap} />}
    </details>
  );
}

function Roadmap({ data, roadmap }: { data: DashboardData; roadmap: NonNullable<DashboardData["client"]["exit_roadmap"]> }) {
  const { cycle } = data;
  return (
    <div className="exit-body">
    <p className="hint">Indicative. We re-plan at the start of every cycle.</p>
    <div className="scroll" tabIndex={0} role="region" aria-label="Exit roadmap">
      <table className="roadmap">
        <thead>
          <tr>
            <th>Cycle</th>
            <th>Dates</th>
            <th>Focus (value drag)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {roadmap.map((r) => {
            const st = STATUS[roadmapStatus(r.cycle, cycle.number)];
            return (
              <tr key={r.cycle} className={r.cycle === cycle.number ? "current" : undefined}>
                <td className="wk">{r.cycle}</td>
                <td className="dt">{r.dates ?? roadmapCycleRange(cycle.start_date, cycle.number, r.cycle)}</td>
                <td>{r.focus}</td>
                <td>
                  <span className={`tag ${st.key}`}>{st.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
        </div>
  );
}
