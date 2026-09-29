// Builds the /demo dashboard from the committed Northside plan file and the
// made-up activity, through exactly the same view-model the real pages use.
// The cycle is placed so today is always day 44, whatever the date.

import northside from "../../plans/northside-cycle-1.json";
import { addDays, cycleClock, todayIn, zonedTimeToUtc } from "./leap";
import { parsePlan } from "./plan";
import {
  DEMO_TODAY_DAY,
  demoAssetStatus,
  demoCheckinWeeks,
  demoDoneActions,
  demoExtraAdvisorAction,
  demoMeeting,
  demoMonthStatus,
  demoReadings,
  demoUpdate,
} from "./demo-activity";
import type { Action, DashboardData, Member, WeekStatus } from "./types";

export function buildDemoDashboard(now = new Date()): DashboardData {
  const parsed = parsePlan(northside);
  if (!parsed.ok) throw new Error(`Northside plan is invalid: ${parsed.errors.join("; ")}`);
  const plan = parsed.plan;
  const tz = plan.client.timezone;
  const start = addDays(todayIn(tz, now), -(DEMO_TODAY_DAY - 1));
  const at = (offset: number) => addDays(start, offset);
  const origStart = plan.cycle.start_date;
  const shift = (date: string) => at(Math.round((Date.parse(date) - Date.parse(origStart)) / 86_400_000));

  const members: Member[] = plan.members.map((m, i) => ({
    id: `m${i}`,
    user_id: `u${i}`,
    display_name: m.name,
    role_label: m.role ?? null,
  }));
  const advisorName = "Will";

  const actions: Action[] = [
    ...(plan.actions ?? []).map((a) => ({ title: a.title, owner: a.owner, due: shift(a.due) })),
    { title: demoExtraAdvisorAction.title, owner: advisorName, due: at(demoExtraAdvisorAction.dueOffset) },
  ].map((a, i) => {
    const advisor = a.owner === advisorName;
    const member = members.find((m) => m.display_name === a.owner);
    const doneOffset = demoDoneActions[a.title];
    return {
      id: `a${i}`,
      title: a.title,
      due_date: a.due,
      done_at: doneOffset !== undefined ? zonedTimeToUtc(`${at(doneOffset)}T12:00`, tz).toISOString() : null,
      owner_is_advisor: advisor,
      owner_member_id: advisor ? null : (member?.id ?? null),
      owner_name: advisor ? advisorName : (member?.display_name ?? a.owner),
    };
  });

  const currentWeek = Math.floor((DEMO_TODAY_DAY - 1) / 7) + 1;
  const checkins = demoCheckinWeeks.map((w) => ({
    id: `c${w}`,
    week_number: w,
    submitted_by: "u0",
    submitted_by_name: "Dave",
    submitted_at: zonedTimeToUtc(`${at(w * 7 - 3)}T16:00`, tz).toISOString(),
    blockers: null,
    for_next_meeting: null,
    review_file_path: null,
    review_link: null,
    advisor_reviewed_at: null,
    advisor_feedback_link: null,
  }));

  const cycle = {
    id: "demo-cycle",
    number: plan.cycle.number,
    start_date: start,
    end_date: at(89),
    goal_title: plan.cycle.goal_title,
    goal_why: plan.cycle.goal_why ?? null,
    status: "active",
  };
  const client = { id: "demo", name: plan.client.name, slug: "demo", timezone: tz, industry: plan.client.industry ?? null, status: "active" };

  return {
    client,
    cycle,
    advisorName,
    members,
    kpis: plan.kpis.map((k, i) => ({
      id: `k${i}`,
      name: k.name,
      unit: k.unit,
      start_value: k.start,
      target_value: k.target,
      lower_is_better: k.lower_is_better,
      is_primary: !!k.primary,
      how_measured: k.how_measured ?? null,
      goals: Object.entries(k.goals ?? {}).map(([day, value]) => ({ day: Number(day), value })),
      readings: (demoReadings[k.name] ?? []).map((value, w) => ({ week_number: w + 1, value, entered_by_advisor: false })),
    })),
    planPairs: plan.plan_pairs.map((p, i) => ({ id: `p${i}`, ...p })),
    months: plan.months.map((m) => ({
      id: `mo${m.number}`,
      number: m.number,
      summary: m.summary,
      goal_text: m.goal ?? null,
      status: demoMonthStatus[m.number as 1 | 2 | 3],
    })),
    weeks: plan.weeks.map((w) => ({
      id: `w${w.number}`,
      number: w.number,
      meeting: w.meeting ?? null,
      asset: w.asset,
      status: (w.number < currentWeek ? "done" : w.number === currentWeek ? "this_week" : "upcoming") as WeekStatus,
    })),
    actions,
    assets: plan.assets.map((a, i) => ({
      id: `as${i}`,
      name: a.name,
      description: a.description ?? null,
      status: demoAssetStatus[a.name] ?? "not_started",
      due_week: a.due_week ?? null,
      link: a.link ?? null,
    })),
    scorecard: plan.scorecard.map((s, i) => ({
      id: `s${i}`,
      drag: s.drag,
      score: s.score,
      target: s.target ?? null,
      in_focus: !!s.in_focus,
      note: s.note ?? null,
    })),
    parked: (plan.parked ?? []).map((p, i) => ({ id: `pk${i}`, text: p.text, category: p.category ?? null })),
    latestUpdate: { id: "u1", kind: "monday", sent_on: at(demoUpdate.offset), body: demoUpdate.body },
    nextMeeting: {
      id: "mt1",
      starts_at: zonedTimeToUtc(`${at(demoMeeting.offset)}T${demoMeeting.time}`, tz).toISOString(),
      duration_min: demoMeeting.duration_min,
      agenda: demoMeeting.agenda,
      link: demoMeeting.link,
    },
    checkins,
    ...cycleClock(tz, start, checkins.map((c) => c.week_number), now),
    viewer: { kind: "demo" },
  };
}
