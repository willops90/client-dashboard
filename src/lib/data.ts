// Reads a client's dashboard through the signed-in user's Supabase client, so
// RLS decides what comes back. Nothing here trusts the URL.

import "server-only";
import { cache } from "react";
import { cycleClock } from "./leap";
import { createClient, type Supabase } from "./supabase/server";
import type { Action, Checkin, Client, Cycle, DashboardData, Kpi, Member, Viewer } from "./types";

export type SignedInViewer = Exclude<Viewer, { kind: "demo" }> & { clientSlug?: string };

/** Who is signed in, and whether they're an advisor or a client member. */
export const getViewer = cache(async (): Promise<SignedInViewer | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: advisor } = await supabase.from("advisors").select("display_name").eq("user_id", userId).maybeSingle();
  if (advisor) return { kind: "advisor", userId, name: advisor.display_name };

  const { data: member } = await supabase
    .from("client_members")
    .select("id, display_name, clients(slug)")
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return null;
  const clients = member.clients as unknown as { slug: string } | null;
  return { kind: "member", userId, memberId: member.id, name: member.display_name, clientSlug: clients?.slug };
});

/** The cycle to show: the active or in-review one, otherwise the latest. */
export async function currentCycle(supabase: Supabase, clientId: string): Promise<Cycle | null> {
  const { data } = await supabase.from("cycles").select("*").eq("client_id", clientId).order("number", { ascending: false });
  if (!data?.length) return null;
  return (data.find((c) => c.status === "active" || c.status === "review") ?? data[0]) as Cycle;
}

const num = (v: unknown) => Number(v);

export async function loadDashboard(slug: string, viewer: SignedInViewer, now = new Date()): Promise<DashboardData | null> {
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("*").eq("slug", slug).maybeSingle();
  if (!client) return null;
  const cycle = await currentCycle(supabase, client.id);
  if (!cycle) return null;

  const [members, kpis, pairs, months, weeks, actions, assets, scores, parked, update, meeting, checkins, advisors] =
    await Promise.all([
      supabase.from("client_members").select("id, user_id, display_name, role_label").eq("client_id", client.id).order("created_at"),
      supabase
        .from("kpis")
        .select("*, kpi_goals(day, value), kpi_readings(week_number, value, entered_by_advisor)")
        .eq("cycle_id", cycle.id)
        .order("sort"),
      supabase.from("plan_pairs").select("id, problem, initiative, problem_short, initiative_short").eq("cycle_id", cycle.id).order("sort"),
      supabase.from("months").select("id, number, summary, goal_text, status, focus, first_week, last_week").eq("cycle_id", cycle.id).order("number"),
      supabase.from("weeks").select("id, number, meeting, asset, status").eq("cycle_id", cycle.id).order("number"),
      supabase
        .from("actions")
        .select("id, title, due_date, done_at, owner_is_advisor, owner_member_id")
        .eq("cycle_id", cycle.id)
        .order("due_date"),
      supabase.from("assets").select("id, name, description, status, due_week, link, built_on, preview").eq("cycle_id", cycle.id).order("sort"),
      supabase
        .from("scorecard_scores")
        .select("id, drag, score, target, in_focus, note")
        .eq("cycle_id", cycle.id)
        .eq("scored_at", "start")
        .order("created_at"),
      supabase
        .from("parked_items")
        .select("id, text, category, planned_cycle")
        .eq("client_id", client.id)
        .is("picked_up_in_cycle_id", null)
        .order("created_at"),
      supabase
        .from("updates")
        .select("id, kind, sent_on, body, summary")
        .eq("cycle_id", cycle.id)
        .order("sent_on", { ascending: false })
        .limit(20),
      supabase
        .from("meetings")
        .select("id, starts_at, duration_min, agenda, link")
        .eq("cycle_id", cycle.id)
        .gte("starts_at", new Date(now.getTime() - 2 * 3600_000).toISOString())
        .order("starts_at")
        .limit(1),
      supabase.from("checkins").select("*").eq("cycle_id", cycle.id).order("week_number"),
      supabase.from("advisors").select("display_name").order("created_at").limit(1),
    ]);
  const { data: pastMeetings } = await supabase
    .from("meetings")
    .select("id, starts_at, duration_min, agenda, link")
    .eq("cycle_id", cycle.id)
    .lt("starts_at", now.toISOString())
    .order("starts_at", { ascending: false })
    .limit(1);

  const memberRows = (members.data ?? []) as Member[];
  const nameOf = (userId: string | null) => memberRows.find((m) => m.user_id === userId)?.display_name ?? null;
  const advisorName = advisors.data?.[0]?.display_name ?? "Your advisor";

  const kpiRows: Kpi[] = (kpis.data ?? []).map((k) => ({
    id: k.id,
    name: k.name,
    unit: k.unit,
    start_value: num(k.start_value),
    target_value: num(k.target_value),
    lower_is_better: k.lower_is_better,
    is_primary: k.is_primary,
    how_measured: k.how_measured,
    goals: (k.kpi_goals ?? []).map((g: { day: number; value: unknown }) => ({ day: g.day, value: num(g.value) })),
    readings: (k.kpi_readings ?? [])
      .map((r: { week_number: number; value: unknown; entered_by_advisor: boolean }) => ({ ...r, value: num(r.value) }))
      .sort((a: { week_number: number }, b: { week_number: number }) => a.week_number - b.week_number),
  }));

  const actionRows: Action[] = (actions.data ?? []).map((a) => ({
    ...a,
    owner_name: a.owner_is_advisor ? advisorName : (memberRows.find((m) => m.id === a.owner_member_id)?.display_name ?? "Team"),
  }));

  const checkinRows: Checkin[] = (checkins.data ?? []).map((c) => ({ ...c, submitted_by_name: nameOf(c.submitted_by) }));

  return {
    client: client as Client,
    cycle,
    advisorName,
    members: memberRows,
    kpis: kpiRows,
    planPairs: pairs.data ?? [],
    months: months.data ?? [],
    weeks: weeks.data ?? [],
    actions: actionRows,
    assets: assets.data ?? [],
    scorecard: scores.data ?? [],
    parked: parked.data ?? [],
    latestUpdate: update.data?.find((u) => u.kind === "monday") ?? update.data?.[0] ?? null,
    lastRecap: update.data?.find((u) => u.kind === "recap") ?? null,
    lastMeeting: pastMeetings?.[0] ?? null,
    nextMeeting: meeting.data?.[0] ?? null,
    checkins: checkinRows,
    ...cycleClock(client.timezone, cycle.start_date, checkinRows.map((c) => c.week_number), now),
    viewer,
  };
}
