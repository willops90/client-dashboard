/** The LEAP stage a section belongs to, as named in the planning-meeting slides. */
export type LeapStage = "Limit Focus" | "Establish a Plan" | "Create Assets" | "Review Progress";

export function LeapTag({ stage }: { stage: LeapStage }) {
  return (
    <span className="leap-tag">
      <span aria-hidden="true"> · </span>
      <span>LEAP: {stage}</span>
    </span>
  );
}
