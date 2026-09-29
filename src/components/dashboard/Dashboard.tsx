import Link from "next/link";
import { CYCLE_DAYS, formatDate } from "@/lib/leap";
import type { DashboardData } from "@/lib/types";
import { KpiHero } from "./KpiHero";
import { Fortnight } from "./Fortnight";
import { AssetsSection, PlanSection, ScorecardSection, WeeksSection } from "./PlanSections";
import { ParkedSection } from "./Parked";
import { ExitStrip } from "./ExitStrip";
import { LeapTag } from "./LeapTag";

/** The client dashboard. The same template renders every client, the advisor view and /demo. */
export function Dashboard({ data, advisorPanel }: { data: DashboardData; advisorPanel?: React.ReactNode }) {
  const { client, cycle, day, viewer } = data;
  const year = cycle.end_date.slice(0, 4);
  const cycleLine =
    day < 1
      ? `LEAP cycle ${cycle.number} starts on ${formatDate(cycle.start_date)} ${year} and runs to ${formatDate(cycle.end_date)}.`
      : day > CYCLE_DAYS
        ? `LEAP cycle ${cycle.number} ran ${formatDate(cycle.start_date)} to ${formatDate(cycle.end_date)} ${year}.`
        : `LEAP cycle ${cycle.number} runs ${formatDate(cycle.start_date)} to ${formatDate(cycle.end_date)} ${year}. Today is day ${day} of ${CYCLE_DAYS}.`;

  return (
    <div className="wrap">
      <ExitStrip data={data} />
      <Header data={data} />
      <CheckinBanner data={data} />
      {advisorPanel}
      <section className="hero" aria-labelledby="headline">
        <p className="eyebrow">
          This cycle's goal
          <LeapTag stage="Review Progress" />
        </p>
        <p className="cycle-goal">{cycle.goal_short ?? cycle.goal_title}</p>
        <p className="cycle">{cycleLine}</p>
        <KpiHero kpis={data.kpis} day={day} currentWeek={data.currentWeek} endDate={cycle.end_date} goalNote={cycle.goal_note} />
      </section>
      <Fortnight data={data} />
      <PlanSection data={data} />
      <AssetsSection data={data} />
      <WeeksSection data={data} />
      <ScorecardSection data={data} />
      <ParkedSection items={data.parked} slug={client.slug} canAdd={viewer.kind !== "demo"} roadmap={client.exit_roadmap} />
      <footer>
        {viewer.kind === "demo"
          ? `${client.name}, its people and every number on this page are made up to show how an Owner Optional client dashboard works. `
          : ""}
        Built on the LEAP delivery method: limit the focus, establish a plan, create assets, review progress.
      </footer>
    </div>
  );
}

function Header({ data }: { data: DashboardData }) {
  const { viewer, client } = data;
  return (
    <header className="top">
      <div className="brand">Owner Optional Advisory</div>
      <div className="top-right">
        <p>
          Progress dashboard for {client.name}
          {viewer.kind === "demo" && <span className="badge">Demo with made-up data</span>}
          {viewer.kind === "advisor" && <span className="badge teal">Advisor view</span>}
        </p>
        {viewer.kind === "advisor" && (
          <p>
            <Link href="/admin">All clients</Link>
          </p>
        )}
        {viewer.kind !== "demo" && (
          <form action="/auth/signout" method="post">
            <button className="linkish" type="submit">
              Sign out
            </button>
          </form>
        )}
      </div>
    </header>
  );
}

function CheckinBanner({ data }: { data: DashboardData }) {
  const { checkinState: state, window, viewer, client } = data;
  const href = viewer.kind === "demo" ? "#" : `/c/${client.slug}/checkin`;
  const closes = formatDate(window.closesOn, { weekday: "long" });

  if (viewer.kind === "advisor") {
    if (state === "due" || state === "missing") {
      return (
        <div className={`banner${state === "missing" ? " bad" : ""}`} role="status">
          <p>
            {state === "missing" ? "Missing: " : ""}the week {window.week} check-in isn't in yet{state === "due" ? ` (open until ${closes} night)` : ""}.
          </p>
        </div>
      );
    }
    return null;
  }

  if (state === "due") {
    return (
      <div className="banner" role="status">
        <p>
          <strong>Your Friday check-in for week {window.week} is due.</strong> It takes about two minutes.
        </p>
        <Link href={href}>Do the check-in</Link>
      </div>
    );
  }
  if (state === "missing" && window.open) {
    return (
      <div className="banner bad" role="status">
        <p>
          <strong>Your check-in for week {window.week} is late.</strong> You can still do it until the end of {closes}.
        </p>
        <Link href={href}>Do the check-in</Link>
      </div>
    );
  }
  if (state === "submitted" && window.open && viewer.kind === "member") {
    return (
      <p className="cycle" style={{ marginTop: 16 }}>
        Week {window.week} check-in is in. <Link href={href}>Edit it</Link> until the end of {closes}.
      </p>
    );
  }
  return null;
}
