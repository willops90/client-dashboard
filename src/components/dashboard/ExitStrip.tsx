import { roadmapCycleRange, roadmapStatus, type RoadmapStatus } from "@/lib/leap";
import type { DashboardData } from "@/lib/types";

const STATUS: Record<RoadmapStatus, { label: string; key: string }> = {
  done: { label: "Done", key: "good" },
  now: { label: "Now", key: "teal" },
  next: { label: "Next", key: "warn" },
  planned: { label: "Planned", key: "idle" },
};

/** The long view: where this cycle sits on the road to a sale. Collapsed by default. */
export function ExitStrip({ data }: { data: DashboardData }) {
  const { client, cycle } = data;
  if (!client.exit_goal) return null;
  const total = client.exit_cycles_estimate;
  const roadmap = [...(client.exit_roadmap ?? [])].sort((a, b) => a.cycle - b.cycle);

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
      {roadmap.length > 0 && (
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
      )}
    </details>
  );
}
