import type { DashboardData } from "@/lib/types";
import { ExitStrip } from "@/components/dashboard/ExitStrip";
import { OwnerOptionalLogo } from "@/components/brand/OwnerOptionalLogo";
import { Glance, currentPillar } from "./Glance";
import { ThisWeek } from "./ThisWeek";
import { FocusSection } from "./FocusSection";
import { PlanCard } from "./PlanCard";
import { AssetChecklist } from "./AssetChecklist";
import { ProgressSection } from "./ProgressSection";

/**
 * Structured around the four LEAP pillars, the same frame every meeting uses
 * (open the plan, assess the KPIs, close the gaps, confirm next steps):
 * a glance at all four, a quick view of this week, then L · E · A · P.
 * From day 60 the Progress section moves up for the review phase.
 */
export function DashboardV2({ data }: { data: DashboardData }) {
  const { client, viewer, day } = data;
  const reviewPhase = currentPillar(day) === "P" && day <= 90;
  const progress = <ProgressSection data={data} reviewPhase={reviewPhase} />;

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
      {client.exit_goal && <p className="v2-bridge">This 90-day cycle is how we get there.</p>}

      <h1 className="sr-only">{client.name} progress dashboard</h1>
      <Glance data={data} />
      <ThisWeek data={data} />

      {reviewPhase && progress}
      <FocusSection data={data} />
      <PlanCard data={data} />
      <AssetChecklist data={data} />
      {!reviewPhase && progress}

      <footer>
        {viewer.kind === "demo" && `${client.name}, its people and every number on this page are made up. `}
        Built on the LEAP method: limit the focus, establish a plan, create assets, review progress.
      </footer>
    </div>
  );
}
