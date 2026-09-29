import { describe, expect, it } from "vitest";
import {
  actionStatus,
  addDays,
  canEditCheckin,
  checkinState,
  checkinWindow,
  cycleDay,
  diffDays,
  formatValue,
  inFortnight,
  isOverdue,
  kpiStatus,
  targetPath,
  todayIn,
  weekNumber,
  zonedTimeToUtc,
} from "./leap";

const hours = { start_value: 58, target_value: 35, lower_is_better: true };
const quotes = { start_value: 5, target_value: 80, lower_is_better: false };

describe("calendar arithmetic", () => {
  it("adds and diffs days across month ends", () => {
    expect(addDays("2026-08-17", 89)).toBe("2026-11-14");
    expect(diffDays("2026-08-17", "2026-09-29")).toBe(43);
  });

  it("numbers days and weeks from the start date", () => {
    expect(cycleDay("2026-08-17", "2026-08-17")).toBe(1);
    expect(cycleDay("2026-08-17", "2026-09-29")).toBe(44);
    expect(weekNumber("2026-08-17", "2026-08-23")).toBe(1);
    expect(weekNumber("2026-08-17", "2026-08-24")).toBe(2);
    expect(weekNumber("2026-08-17", "2026-09-29")).toBe(7);
    expect(weekNumber("2026-08-17", "2027-01-01")).toBe(13);
  });
});

describe("target path", () => {
  it("runs in a straight line from start to target", () => {
    expect(targetPath(hours, 0)).toBe(58);
    expect(targetPath(hours, 90)).toBe(35);
    expect(targetPath(quotes, 45)).toBe(42.5);
  });
});

describe("kpiStatus", () => {
  it("has no status without readings", () => {
    expect(kpiStatus(hours, []).key).toBe("idle");
  });

  it("is on track at or better than the path (lower is better)", () => {
    // Week 6 → day 42 → path 47.27
    expect(kpiStatus(hours, [{ week_number: 6, value: 47 }]).key).toBe("good");
  });

  it("uses the latest week, not the last row", () => {
    const readings = [
      { week_number: 6, value: 47 },
      { week_number: 1, value: 80 },
    ];
    expect(kpiStatus(hours, readings).key).toBe("good");
  });

  it("allows 4% of the range before slipping", () => {
    // Range 23 → 4% = 0.92. Path 47.27, so 48.1 is on track, 48.3 is not.
    expect(kpiStatus(hours, [{ week_number: 6, value: 48.1 }]).key).toBe("good");
    expect(kpiStatus(hours, [{ week_number: 6, value: 48.3 }]).key).toBe("warn");
  });

  it("is slightly behind up to 12% of the range, off track beyond", () => {
    // 12% of 23 = 2.76 → boundary at 50.03
    expect(kpiStatus(hours, [{ week_number: 6, value: 50 }]).key).toBe("warn");
    expect(kpiStatus(hours, [{ week_number: 6, value: 50.1 }]).key).toBe("bad");
  });

  it("works when higher is better", () => {
    // Week 6 → path 40. Range 75: 4% = 3, 12% = 9.
    expect(kpiStatus(quotes, [{ week_number: 6, value: 46 }]).key).toBe("good");
    expect(kpiStatus(quotes, [{ week_number: 6, value: 37 }]).key).toBe("good");
    expect(kpiStatus(quotes, [{ week_number: 6, value: 36 }]).key).toBe("warn");
    expect(kpiStatus(quotes, [{ week_number: 6, value: 30 }]).key).toBe("bad");
  });
});

describe("actions", () => {
  const today = "2026-09-29";
  it("flags open actions due before today as overdue", () => {
    expect(isOverdue({ due_date: "2026-09-25", done_at: null }, today)).toBe(true);
    expect(isOverdue({ due_date: "2026-09-29", done_at: null }, today)).toBe(false);
    expect(isOverdue({ due_date: "2026-09-25", done_at: "2026-09-28T00:00:00Z" }, today)).toBe(false);
  });

  it("labels status in words", () => {
    expect(actionStatus({ due_date: "2026-09-25", done_at: null }, today).label).toBe("Overdue");
    expect(actionStatus({ due_date: today, done_at: null }, today).label).toBe("Due today");
    expect(actionStatus({ due_date: "2026-10-02", done_at: null }, today).label).toBe("Due this week");
    expect(actionStatus({ due_date: "2026-10-20", done_at: null }, today).label).toBe("Upcoming");
  });

  it("keeps the fortnight list to what matters now", () => {
    const tz = "Australia/Brisbane";
    expect(inFortnight({ due_date: "2026-10-13", done_at: null }, today, tz)).toBe(true);
    expect(inFortnight({ due_date: "2026-10-14", done_at: null }, today, tz)).toBe(false);
    expect(inFortnight({ due_date: "2026-08-01", done_at: null }, today, tz)).toBe(true);
    expect(inFortnight({ due_date: "2026-09-01", done_at: "2026-09-24T03:00:00Z" }, today, tz)).toBe(true);
    expect(inFortnight({ due_date: "2026-09-01", done_at: "2026-09-01T03:00:00Z" }, today, tz)).toBe(false);
  });
});

describe("timezones", () => {
  // 2026-09-29T15:30Z is Tuesday 1:30am on the 30th in Sydney (AEST, +10),
  // but still Tuesday the 29th in London and Perth is 11:30pm on the 29th.
  const instant = new Date("2026-09-29T15:30:00Z");

  it("reads today in the client's timezone, not the server's", () => {
    expect(todayIn("Australia/Sydney", instant)).toBe("2026-09-30");
    expect(todayIn("Australia/Perth", instant)).toBe("2026-09-29");
    expect(todayIn("Europe/London", instant)).toBe("2026-09-29");
  });

  it("gives different day numbers either side of midnight", () => {
    expect(cycleDay("2026-08-17", todayIn("Australia/Sydney", instant))).toBe(45);
    expect(cycleDay("2026-08-17", todayIn("Australia/Perth", instant))).toBe(44);
  });

  it("converts client wall-clock time to UTC, including across DST", () => {
    // Brisbane has no DST: always +10.
    expect(zonedTimeToUtc("2026-10-01T09:00", "Australia/Brisbane").toISOString()).toBe("2026-09-30T23:00:00.000Z");
    // Sydney moves to +11 on 4 October 2026.
    expect(zonedTimeToUtc("2026-10-01T09:00", "Australia/Sydney").toISOString()).toBe("2026-09-30T23:00:00.000Z");
    expect(zonedTimeToUtc("2026-10-08T09:00", "Australia/Sydney").toISOString()).toBe("2026-10-07T22:00:00.000Z");
    expect(zonedTimeToUtc("2026-10-08T09:00", "Europe/London").toISOString()).toBe("2026-10-08T08:00:00.000Z");
  });
});

describe("check-in window", () => {
  const start = "2026-08-17"; // a Monday
  const tz = "Australia/Brisbane"; // UTC+10, no DST

  const at = (localIso: string) => zonedTimeToUtc(localIso, tz);

  it("is closed Monday to Wednesday and points at last week", () => {
    const w = checkinWindow(start, tz, at("2026-09-29T10:00")); // Tue, week 7
    expect(w.open).toBe(false);
    expect(w.week).toBe(6);
    expect(w.pastDue).toBe(true);
  });

  it("opens on Thursday for this week", () => {
    const w = checkinWindow(start, tz, at("2026-10-01T00:05")); // Thu of week 7
    expect(w).toMatchObject({ open: true, week: 7, friday: "2026-10-02", closesOn: "2026-10-04", pastDue: false });
  });

  it("is due until Saturday 9am, then missing", () => {
    expect(checkinState(checkinWindow(start, tz, at("2026-10-03T08:59")), [])).toBe("due");
    expect(checkinState(checkinWindow(start, tz, at("2026-10-03T09:00")), [])).toBe("missing");
    expect(checkinState(checkinWindow(start, tz, at("2026-10-03T09:00")), [7])).toBe("submitted");
  });

  it("stays editable until the end of Sunday", () => {
    const sundayNight = checkinWindow(start, tz, at("2026-10-04T23:59"));
    expect(sundayNight.week).toBe(7);
    expect(canEditCheckin(sundayNight, 7)).toBe(true);
    const monday = checkinWindow(start, tz, at("2026-10-05T00:00"));
    expect(canEditCheckin(monday, 7)).toBe(false);
  });

  it("uses the client's clock: Thursday in Sydney is still Wednesday in London", () => {
    const instant = new Date("2026-09-30T20:00:00Z"); // Thu 6am Sydney (AEST), Wed 9pm London
    expect(checkinWindow(start, "Australia/Sydney", instant).open).toBe(true);
    expect(checkinWindow(start, "Europe/London", instant).open).toBe(false);
  });

  it("is outside the cycle before the first Friday and after day 90", () => {
    expect(checkinState(checkinWindow(start, tz, at("2026-08-17T12:00")), [])).toBe("none");
    expect(checkinState(checkinWindow(start, tz, at("2026-08-20T12:00")), [])).toBe("due");
    expect(checkinWindow(start, tz, at("2026-11-20T12:00")).week).toBeNull();
  });
});

describe("formatValue", () => {
  it("formats each unit", () => {
    expect(formatValue(47, "hrs")).toBe("47 hrs");
    expect(formatValue(46, "%")).toBe("46%");
    expect(formatValue(15000, "$")).toBe("$15,000");
    expect(formatValue(12, "count")).toBe("12");
    expect(formatValue(47.25, "hrs")).toBe("47.3 hrs");
  });
});

import { roadmapCycleRange, roadmapStatus } from "./leap";

describe("exit roadmap", () => {
  it("works out each cycle's months from the current cycle", () => {
    expect(roadmapCycleRange("2026-08-17", 1, 1)).toBe("Aug–Nov 2026");
    expect(roadmapCycleRange("2026-08-17", 1, 2)).toBe("Nov 2026–Feb 2027");
    expect(roadmapCycleRange("2026-08-17", 1, 3)).toBe("Feb–May 2027");
    expect(roadmapCycleRange("2026-08-17", 1, 6)).toBe("Nov 2027–Feb 2028");
  });

  it("labels cycles relative to the current one", () => {
    expect([1, 2, 3, 4].map((c) => roadmapStatus(c, 2))).toEqual(["done", "now", "next", "planned"]);
  });
});
