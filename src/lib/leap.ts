// The one place for LEAP date and status rules. The dashboard, the check-in
// form and the advisor overview all call these, so they can never disagree.
//
// Dates are plain "YYYY-MM-DD" strings in the client's timezone. Day and week
// numbers always come from the client's clock, never the server's.

export const CYCLE_DAYS = 90;
export const CYCLE_WEEKS = 13;
export const BUILD_PHASE_END_DAY = 60;

// ---------------------------------------------------------------------------
// Calendar helpers (timezone-free arithmetic on date strings)

function toUtcMs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromUtcMs(toUtcMs(date) + days * 86_400_000);
}

/** Whole days from a to b (b − a). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: string): number {
  return new Date(toUtcMs(date)).getUTCDay();
}

// ---------------------------------------------------------------------------
// Timezone helpers

export type ZonedNow = { date: string; time: string; weekday: number };

/** The wall-clock date and time in `timeZone` at the instant `now`. */
export function zonedNow(timeZone: string, now: Date = new Date()): ZonedNow {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return { date, time: `${parts.hour}:${parts.minute}`, weekday: weekdayOf(date) };
}

export function todayIn(timeZone: string, now: Date = new Date()): string {
  return zonedNow(timeZone, now).date;
}

/**
 * Converts a wall-clock time in `timeZone` ("2026-10-01T09:00") to a UTC Date.
 * Used when the advisor sets a meeting in the client's local time.
 */
export function zonedTimeToUtc(local: string, timeZone: string): Date {
  const [datePart, timePart = "00:00"] = local.split("T");
  const [h, min] = timePart.split(":").map(Number);
  const wallAsUtc = toUtcMs(datePart) + (h * 60 + min) * 60_000;
  // Iterate twice so the offset settles across DST boundaries.
  let guess = wallAsUtc;
  for (let i = 0; i < 2; i++) {
    const z = zonedNow(timeZone, new Date(guess));
    const [zh, zm] = z.time.split(":").map(Number);
    const zonedAsUtc = toUtcMs(z.date) + (zh * 60 + zm) * 60_000;
    guess += wallAsUtc - zonedAsUtc;
  }
  return new Date(guess);
}

// ---------------------------------------------------------------------------
// Cycle position

/** Day 1 is the start date. Can be ≤ 0 before the cycle or > 90 after it. */
export function cycleDay(startDate: string, today: string): number {
  return diffDays(startDate, today) + 1;
}

/** Week 1 is days 1–7. Clamped to 1…13. */
export function weekNumber(startDate: string, date: string): number {
  const w = Math.floor(diffDays(startDate, date) / 7) + 1;
  return Math.min(CYCLE_WEEKS, Math.max(1, w));
}

export function weekStart(startDate: string, week: number): string {
  return addDays(startDate, (week - 1) * 7);
}

export function monthRange(startDate: string, month: number): { from: string; to: string } {
  return { from: addDays(startDate, (month - 1) * 30), to: addDays(startDate, month * 30 - 1) };
}

/** The day a week-n reading covers, for comparing against the target path. */
export function readingDay(week: number): number {
  return Math.min(CYCLE_DAYS, week * 7);
}

// ---------------------------------------------------------------------------
// KPI status

export type KpiLike = {
  start_value: number;
  target_value: number;
  lower_is_better: boolean;
};

export type Reading = { week_number: number; value: number };

export type StatusKey = "good" | "warn" | "bad" | "idle";
export type Status = { key: StatusKey; label: string };

export function targetPath(kpi: KpiLike, day: number): number {
  return kpi.start_value + ((kpi.target_value - kpi.start_value) * day) / CYCLE_DAYS;
}

export function latestReading<R extends Reading>(readings: R[]): R | undefined {
  return readings.reduce<R | undefined>(
    (best, r) => (!best || r.week_number > best.week_number ? r : best),
    undefined,
  );
}

/**
 * Compares the latest reading with the target path on the day it covers.
 * On track: at or better than the path, or within 4% of the KPI's range.
 * Slightly behind: up to 12% of the range worse. Off track: worse than that.
 */
export function kpiStatus(kpi: KpiLike, readings: Reading[]): Status {
  const last = latestReading(readings);
  if (!last) return { key: "idle", label: "No readings yet" };
  const path = targetPath(kpi, readingDay(last.week_number));
  const ahead = kpi.lower_is_better ? path - last.value : last.value - path;
  const range = Math.abs(kpi.target_value - kpi.start_value) || 1;
  if (ahead >= -0.04 * range) return { key: "good", label: "On track" };
  if (ahead >= -0.12 * range) return { key: "warn", label: "Slightly behind" };
  return { key: "bad", label: "Off track" };
}

// ---------------------------------------------------------------------------
// Actions

export type ActionLike = { due_date: string; done_at: string | null };

export function isOverdue(action: ActionLike, today: string): boolean {
  return !action.done_at && action.due_date < today;
}

export function actionStatus(action: ActionLike, today: string): Status {
  if (action.done_at) return { key: "good", label: "Done" };
  if (action.due_date < today) return { key: "bad", label: "Overdue" };
  if (action.due_date === today) return { key: "warn", label: "Due today" };
  if (diffDays(today, action.due_date) <= 7) return { key: "warn", label: "Due this week" };
  return { key: "idle", label: "Upcoming" };
}

/** Open actions due within 14 days (or overdue), plus anything done in the last 7. */
export function inFortnight(action: ActionLike, today: string, timeZone: string): boolean {
  if (action.done_at) {
    const doneDate = todayIn(timeZone, new Date(action.done_at));
    return diffDays(doneDate, today) <= 7;
  }
  return diffDays(today, action.due_date) <= 14;
}

// ---------------------------------------------------------------------------
// Friday check-in window
//
// Check-ins open on Thursday and close at the end of Sunday, client time.
// The week being checked in is the cycle week that contains that Friday.
// A check-in counts as missing from Saturday 9am client time.

export type CheckinWindow = {
  /** Cycle week the check-in covers, or null outside the cycle. */
  week: number | null;
  /** The Friday this check-in is for. */
  friday: string;
  /** True Thursday to Sunday, while the check-in can be submitted or edited. */
  open: boolean;
  /** The last date it can be edited (the Sunday). */
  closesOn: string;
  /** From Saturday 9am the check-in is overdue if not submitted. */
  pastDue: boolean;
};

export function checkinWindow(startDate: string, timeZone: string, now: Date = new Date()): CheckinWindow {
  const z = zonedNow(timeZone, now);
  // Thu (4), Fri (5), Sat (6) look at this week's Friday; Sun (0) at the one
  // just gone; Mon–Wed at last week's.
  const back = { 0: 2, 1: 3, 2: 4, 3: 5, 4: -1, 5: 0, 6: 1 }[z.weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6];
  const friday = addDays(z.date, -back);
  const day = cycleDay(startDate, friday);
  const week = day >= 1 && day <= CYCLE_DAYS ? weekNumber(startDate, friday) : null;
  const open = [4, 5, 6, 0].includes(z.weekday);
  const saturday = addDays(friday, 1);
  const pastDue = `${z.date}T${z.time}` >= `${saturday}T09:00`;
  return { week, friday, open, closesOn: addDays(friday, 2), pastDue };
}

export type CheckinState = "not_open" | "due" | "submitted" | "missing" | "none";

/**
 * - due: the window is open and nothing is in yet (show the banner)
 * - missing: past Saturday 9am and nothing in (flag on the advisor overview)
 * - submitted: this week's check-in exists
 * - not_open: Mon–Wed before the first check-in of the cycle
 * - none: outside the cycle
 */
export function checkinState(window: CheckinWindow, submittedWeeks: number[]): CheckinState {
  if (window.week === null) return "none";
  if (submittedWeeks.includes(window.week)) return "submitted";
  if (window.pastDue) return "missing";
  if (window.open) return "due";
  return "not_open";
}

/** A check-in for `week` may be written by a client member right now. */
export function canEditCheckin(window: CheckinWindow, week: number): boolean {
  return window.open && window.week === week;
}

// ---------------------------------------------------------------------------
// Formatting

export function formatValue(value: number, unit: string): string {
  const n = Number(value);
  const pretty = Number.isInteger(n) ? n.toLocaleString("en-AU") : n.toLocaleString("en-AU", { maximumFractionDigits: 1 });
  switch (unit) {
    case "%":
      return `${pretty}%`;
    case "$":
      return `$${pretty}`;
    case "hrs":
      return `${pretty} hrs`;
    default:
      return pretty;
  }
}

export function formatDate(date: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }): string {
  return new Intl.DateTimeFormat("en-AU", { ...opts, timeZone: "UTC" }).format(new Date(toUtcMs(date)));
}

/** Where a cycle stands right now, on the client's clock. */
export function cycleClock(timeZone: string, startDate: string, submittedWeeks: number[], now: Date = new Date()) {
  const today = todayIn(timeZone, now);
  const window = checkinWindow(startDate, timeZone, now);
  return {
    today,
    day: cycleDay(startDate, today),
    currentWeek: weekNumber(startDate, today),
    window,
    checkinState: checkinState(window, submittedWeeks),
  };
}
