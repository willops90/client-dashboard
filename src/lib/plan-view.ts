import { formatDate, monthRange } from "./leap";
import type { DashboardData, PlanPair } from "./types";

/** Growth opportunities and strategic initiatives as two lists, from either plan format. */
export function planLists(data: Pick<DashboardData, "cycle" | "planPairs">): { opportunities: string[]; initiatives: string[] } {
  const { cycle, planPairs } = data;
  if (cycle.growth_opportunities?.length || cycle.strategic_initiatives?.length) {
    return { opportunities: cycle.growth_opportunities ?? [], initiatives: cycle.strategic_initiatives ?? [] };
  }
  return { opportunities: planPairs.map((p) => p.problem), initiatives: planPairs.map((p) => p.initiative) };
}

/** Pairs for the older layout, built from the lists when a plan has no pairs. */
export function planPairsOrLists(data: Pick<DashboardData, "cycle" | "planPairs">): PlanPair[] {
  if (data.planPairs.length) return data.planPairs;
  const { opportunities, initiatives } = planLists(data);
  return Array.from({ length: Math.max(opportunities.length, initiatives.length) }, (_, i) => ({
    id: `l${i}`,
    problem: opportunities[i] ?? "",
    initiative: initiatives[i] ?? "",
    problem_short: null,
    initiative_short: null,
  }));
}

/** A cycle month named by the calendar, as on the LEAP plan slide: "Aug/Sep", with its dates. */
export function calendarMonth(startDate: string, endDate: string, month: number) {
  const r = monthRange(startDate, month);
  const to = month === 3 ? endDate : r.to;
  const name = (d: string) => formatDate(d, { month: "short" });
  const label = name(r.from) === name(to) ? name(r.from) : `${name(r.from)}/${name(to)}`;
  const dates = `${formatDate(r.from, { day: "numeric", month: "short" })} – ${formatDate(to, { day: "numeric", month: "short" })}`;
  return { label, dates, from: r.from, to };
}
