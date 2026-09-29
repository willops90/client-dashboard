import { BUILD_PHASE_END_DAY, CYCLE_DAYS } from "@/lib/leap";

const STAGES = [
  { key: "L", name: "Limit focus", when: "Planning meeting" },
  { key: "E", name: "Establish a plan", when: "Planning meeting" },
  { key: "A", name: "Create assets", when: `Days 1–${BUILD_PHASE_END_DAY}` },
  { key: "P", name: "Review progress", when: `Days ${BUILD_PHASE_END_DAY}–${CYCLE_DAYS}` },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

/** One picture of the LEAP method with a "you are here" marker, instead of a tag on every heading. */
export function Journey({ day }: { day: number }) {
  const current: StageKey = day < 1 ? "E" : day <= BUILD_PHASE_END_DAY ? "A" : "P";
  // L and E are the planning meeting; A and P share the 90 days by length.
  const widths = { L: 10, E: 10, A: (80 * BUILD_PHASE_END_DAY) / CYCLE_DAYS, P: (80 * (CYCLE_DAYS - BUILD_PHASE_END_DAY)) / CYCLE_DAYS };
  const marker = day < 1 ? 20 : 20 + (Math.min(day, CYCLE_DAYS) / CYCLE_DAYS) * 80;
  const done = (k: StageKey) => STAGES.findIndex((s) => s.key === k) < STAGES.findIndex((s) => s.key === current);

  return (
    <section className="v2-journey" aria-label={`LEAP method: now in ${STAGES.find((s) => s.key === current)!.name}, day ${day} of ${CYCLE_DAYS}`}>
      <div className="v2-journey-bar" aria-hidden="true">
        {STAGES.map((s) => (
          <div key={s.key} className={`v2-seg${s.key === current ? " now" : done(s.key) ? " done" : ""}`} style={{ width: `${widths[s.key]}%` }}>
            <span className="v2-seg-key">{s.key}</span>
          </div>
        ))}
        {day >= 1 && day <= CYCLE_DAYS && (
          <span className="v2-marker" style={{ left: `${marker}%` }}>
            <span>Day {day}</span>
          </span>
        )}
      </div>
      <ol className="v2-journey-labels">
        {STAGES.map((s) => (
          <li key={s.key} className={s.key === current ? "now" : undefined} style={{ width: `${widths[s.key]}%` }}>
            <b>{s.name}</b>
            <span>{done(s.key) ? "Done" : s.when}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const STAGE_NAMES: Record<StageKey, string> = { L: "Limit focus", E: "Establish a plan", A: "Create assets", P: "Review progress" };

/** A small stage letter beside a heading, tying the section back to the journey bar. */
export function Stage({ k }: { k: StageKey }) {
  return (
    <span className="v2-stage" title={`LEAP: ${STAGE_NAMES[k]}`}>
      <span aria-hidden="true">{k}</span>
      <span className="sr-only">LEAP stage: {STAGE_NAMES[k]}</span>
    </span>
  );
}
