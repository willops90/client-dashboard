export type PillarKey = "L" | "E" | "A" | "P";

export const PILLARS: Record<PillarKey, { name: string; id: string; stage: string }> = {
  L: { name: "Focus", id: "focus", stage: "Limit the focus" },
  E: { name: "Plan", id: "plan", stage: "Establish a plan" },
  A: { name: "Assets", id: "assets", stage: "Create assets" },
  P: { name: "Progress", id: "progress", stage: "Review progress" },
};

/** Section heading for one of the four LEAP pillars: the letter, the name, and the stage it comes from. */
export function PillarHead({ k }: { k: PillarKey }) {
  const p = PILLARS[k];
  return (
    <h2 id={`h-${p.id}`} className="v2-pillar-head">
      <span className="v2-pillar-letter" aria-hidden="true">
        {k}
      </span>
      <span>
        {p.name}
        <small>LEAP: {p.stage}</small>
      </span>
    </h2>
  );
}
