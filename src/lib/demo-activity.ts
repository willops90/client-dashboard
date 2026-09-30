// Made-up week-by-week activity for the Northside demo: readings, statuses,
// the Monday update and the next meeting. Used by /demo and by
// `npm run seed-demo`, so a local database looks like the design reference.
// Dates are days after the cycle start, so the demo never goes stale.

/** The demo sits in week 7: the cycle starts on the Monday on or before this many days ago (plus one). */
export const DEMO_TODAY_DAY = 43;

export const demoReadings: Record<string, number[]> = {
  "Owner hours a week": [58, 57, 55, 52, 50, 47],
  "Quotes sent without Dave": [5, 8, 15, 30, 38, 46],
  "Jobs scheduled by Sean": [0, 0, 20, 45, 60, 64],
};

export const demoMonthStatus = { 1: "met", 2: "in_progress", 3: "upcoming" } as const;

export const demoAssetStatus: Record<string, "done" | "in_progress" | "waiting_signoff" | "drafting" | "not_started"> = {
  "Owner Exit Map: Step Back Without Value Loss v1": "done",
  "Critical Process Register + SOP Kit: Run It Without the Owner v1": "in_progress",
  "Decision Rights Matrix: Clear Calls Without the Owner v1": "drafting",
};

/** Actions marked done, and the day offset they were done on. */
export const demoDoneActions: Record<string, number> = {
  "Forward all quote requests to the quotes inbox instead of answering them": 38,
  "Send the Monday update": 42,
};

/** An extra advisor action that only makes sense with the demo's Monday update. */
export const demoExtraAdvisorAction = { title: "Send the Monday update", dueOffset: 42 };

export const demoUpdate = {
  offset: 42, // Monday of week 7
  body: `Dave, Priya, Sean, quick one for the week. Owner hours came in at 47 last week, right on the path to 35, and Priya sent 46% of quotes without Dave.

The pricing matrix is the one thing holding up quoting. If Dave can sign it off before Thursday, Priya can quote up to $15k on her own from next week.

Your actions and mine are on the dashboard. Shout if anything's unclear before Thursday.`,
};

/** The last meeting (Thursday of week 5) and the recap sent the next day. */
export const demoLastMeeting = { offset: 31, time: "09:00", duration_min: 60 };
export const demoRecap = {
  offset: 32,
  summary: "Priya quotes jobs up to $15k as soon as Dave signs off the pricing matrix; Sean moves every October job into ServiceM8.",
  body: `Thanks all. What we agreed on Thursday:

- **Quoting:** once Dave signs off pricing matrix v1, Priya quotes every job up to $15k without him. Over $15k still goes to Dave for approval.
- **Scheduling:** Sean moves every October job into ServiceM8 by the end of September.
- **Next meeting:** quoting review and a first look at decision rights.`,
};

export const demoMeeting = {
  offset: 45, // Thursday of week 7
  time: "09:00",
  duration_min: 60,
  link: "https://meet.google.com/",
  agenda: `1. Open the LEAP plan
2. Check the numbers: hours, quotes, scheduling
3. Close the gaps: sign off the pricing matrix
4. First look at the decision-rights matrix
5. Agree next steps, owners and deadlines`,
};

export const demoCheckinWeeks = [1, 2, 3, 4, 5, 6];
