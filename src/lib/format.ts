import { formatDate, todayIn } from "./leap";

/** "Thursday 1 October, 9:00am" in the client's timezone. */
export function formatMeetingTime(iso: string, timeZone: string): string {
  const d = new Date(iso);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-AU", {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute}${String(parts.dayPeriod).toLowerCase()}`;
}

/** Short timezone name for a moment, e.g. "AEST". */
export function tzAbbrev(iso: string, timeZone: string): string {
  return (
    new Intl.DateTimeFormat("en-AU", { timeZone, timeZoneName: "short" }).formatToParts(new Date(iso)).find((p) => p.type === "timeZoneName")
      ?.value ?? ""
  );
}

/** A timestamp's date in the client's timezone, e.g. "24 September". */
export function formatInstantDate(iso: string, timeZone: string, opts?: Intl.DateTimeFormatOptions): string {
  return formatDate(todayIn(timeZone, new Date(iso)), opts);
}

/** "2026-10-01T09:00" for a datetime-local input, in the client's timezone. */
export function toLocalInput(iso: string, timeZone: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function dueLabel(dueDate: string, doneAt: string | null, today: string, timeZone: string): string {
  if (doneAt) return `Done ${formatInstantDate(doneAt, timeZone, { weekday: "long", day: "numeric", month: "long" })}`;
  if (dueDate === today) return "Due today";
  return `Due ${formatDate(dueDate, { weekday: "long", day: "numeric", month: "long" })}`;
}
