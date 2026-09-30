import type { DashboardData } from "@/lib/types";
import { PillarHead } from "./Pillar";

/** L · Focus: the one goal, why it matters, the client's own words, and what we deliberately parked. */
export function FocusSection({ data }: { data: DashboardData }) {
  const { cycle, parked } = data;
  return (
    <section className="block" aria-labelledby="h-focus">
      <PillarHead k="L" />
      <p className="v2-kicker">This cycle&apos;s one goal</p>
      <p className="v2-goal">{cycle.goal_short ?? cycle.goal_title}</p>
      {cycle.goal_why && <p className="v2-why">{cycle.goal_why}</p>}
      {cycle.anchor_quote && (
        <blockquote className="v2-quote">
          <span className="v2-kicker">As you put it</span>
          <p>&ldquo;{cycle.anchor_quote}&rdquo;</p>
        </blockquote>
      )}
      {parked.length > 0 && (
        <div className="v2-parked-list">
          <p className="v2-kicker">Parked for a future LEAP</p>
          <p className="hint">Real issues, but not this cycle&apos;s. Everything else waits.</p>
          <ul>
            {parked.map((p) => (
              <li key={p.id}>
                <span>{p.text}</span>
                {p.planned_cycle && <span className="tag teal">Cycle {p.planned_cycle}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
