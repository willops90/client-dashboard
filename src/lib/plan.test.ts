import { describe, expect, it } from "vitest";
import northside from "../../plans/northside-cycle-1.json";
import { parsePlan, unknownOwners, type Plan } from "./plan";

const clone = () => JSON.parse(JSON.stringify(northside));

describe("plan files", () => {
  it("accepts the Northside example", () => {
    const r = parsePlan(northside);
    expect(r.ok ? [] : r.errors).toEqual([]);
  });

  it("needs exactly one primary KPI", () => {
    const p = clone();
    p.kpis[1].primary = true;
    const r = parsePlan(p);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.join()).toMatch(/exactly one KPI/);
  });

  it("catches a direction that contradicts start and target", () => {
    const p = clone();
    p.kpis[0].lower_is_better = false;
    const r = parsePlan(p);
    expect(!r.ok && r.errors.join()).toMatch(/kpis\.0\.lower_is_better/);
  });

  it("rejects unknown timezones and bad slugs with a clear path", () => {
    const p = clone();
    p.client.timezone = "Sydney";
    p.client.slug = "North Side";
    const r = parsePlan(p);
    expect(!r.ok && r.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/^client\.timezone/), expect.stringMatching(/^client\.slug/)]),
    );
  });

  it("names missing fields", () => {
    const p = clone();
    delete p.cycle.goal_title;
    const r = parsePlan(p);
    expect(!r.ok && r.errors.join()).toMatch(/cycle\.goal_title/);
  });

  it("finds action owners who are neither members nor advisors", () => {
    const plan = (parsePlan(northside) as { plan: Plan }).plan;
    expect(unknownOwners(plan, ["Will"])).toEqual([]);
    expect(unknownOwners({ ...plan, actions: [{ owner: "Bob", title: "x", due: "2026-09-01" }] }, ["Will"])).toEqual(["Bob"]);
    expect(unknownOwners(plan, ["Someone else"])).toEqual(["Will", "Will"]);
  });
});

describe("Northside demo assets", () => {
  const plan = (parsePlan(northside) as { plan: Plan }).plan;
  const exitMap = plan.assets.find((a) => a.name.startsWith("Owner Exit Map"))!;

  it("has five assets, each with a card line, a Built on tag and a preview", () => {
    expect(plan.assets).toHaveLength(5);
    for (const a of plan.assets) {
      expect(a.description, a.name).toBeTruthy();
      expect(a.built_on, a.name).toBeTruthy();
      expect(a.preview?.blocks.length, a.name).toBeGreaterThan(0);
    }
  });

  it("maps exactly the 58 hours Dave started the cycle on", () => {
    const table = exitMap.preview!.blocks.find((b) => b.type === "table")!;
    if (table.type !== "table") throw new Error("expected a table");
    const total = table.rows.reduce((sum, r) => sum + Number(r[1]), 0);
    expect(total).toBe(58);
    expect(table.footer?.[1]).toBe("58");
    expect(plan.kpis.find((k) => k.primary)?.start).toBe(58);
    const flow = exitMap.preview!.blocks.find((b) => b.type === "flow")!;
    if (flow.type !== "flow") throw new Error("expected a flow");
    expect(flow.links.reduce((s, l) => s + (l.weight ?? 0), 0)).toBe(58);
  });

  it("no longer mentions the retired standalone assets", () => {
    const text = JSON.stringify(northside);
    expect(text).not.toMatch(/Quoting playbook and pricing matrix/);
    expect(text).not.toMatch(/"Scheduling SOP"/);
    expect(text).not.toMatch(/ServiceM8 schedule board/);
  });

  it("parks management accounts for cycle 2 and the council contract for cycle 3", () => {
    const roadmap = plan.client.exit!.roadmap!;
    const parked = plan.parked!;
    const mgmt = parked.find((p) => p.text.startsWith("Management accounts"))!;
    const council = parked.find((p) => p.text.startsWith("The council"))!;
    expect(mgmt.cycle).toBe(2);
    expect(council.cycle).toBe(3);
    expect(roadmap.find((r) => r.cycle === 2)?.focus).toBe(mgmt.category);
    expect(roadmap.find((r) => r.cycle === 3)?.focus).toBe(council.category);
  });

  it("rejects a decision matrix row with the wrong number of cells or an unknown code", () => {
    const p = clone();
    const matrix = p.assets.find((a: { name: string }) => a.name.startsWith("Decision Rights")).preview.blocks[0];
    matrix.rows[0].cells = ["D", "X"];
    const r = parsePlan(p);
    expect(!r.ok && r.errors.join()).toMatch(/needs 3 cells/);
    expect(!r.ok && r.errors.join()).toMatch(/"X" isn't in the key/);
  });

  it("has no dollar valuations", () => {
    expect(JSON.stringify(northside)).not.toMatch(/valuation|worth \$|uplift/i);
  });
});

describe("Northside LEAP plan alignment", () => {
  const plan = (parsePlan(northside) as { plan: Plan }).plan;

  it("groups weeks 1–13 into months with no gaps or overlaps, each with a Focus line", () => {
    const covered = plan.months.flatMap((m) => {
      expect(m.focus, `month ${m.number}`).toBeTruthy();
      const [a, b] = m.weeks!;
      return Array.from({ length: b - a + 1 }, (_, i) => a + i);
    });
    expect(covered).toEqual(Array.from({ length: 13 }, (_, i) => i + 1));
  });

  it("has the away test as a pass/fail milestone, separate from the charted KPIs", () => {
    expect(plan.cycle.milestones).toEqual([{ name: "Two weeks with Dave away", target: "Passed", status: "not_started" }]);
    expect(plan.kpis.map((k) => k.name)).not.toContain("Two weeks with Dave away");
  });

  it("rejects a month whose week range runs backwards", () => {
    const p = clone();
    p.months[0].weeks = [5, 1];
    expect(parsePlan(p).ok).toBe(false);
  });
});

import { buildDemoDashboard } from "./demo";
import { weekdayOf } from "./leap";

describe("demo dates", () => {
  it("always starts on a Monday, sits in week 7, and sends Monday updates on Mondays", () => {
    for (let i = 0; i < 14; i++) {
      const now = new Date(Date.UTC(2026, 8, 20 + i, 2));
      const d = buildDemoDashboard(now);
      expect(weekdayOf(d.cycle.start_date), d.cycle.start_date).toBe(1);
      expect(d.currentWeek).toBe(7);
      expect(weekdayOf(d.latestUpdate!.sent_on)).toBe(1);
      expect(d.latestUpdate!.sent_on <= d.today).toBe(true);
    }
  });
});

describe("demo LEAP structure data", () => {
  it("has an anchor quote, a recap with a one-line summary, and the meeting it followed", () => {
    const d = buildDemoDashboard(new Date(Date.UTC(2026, 8, 30, 2)));
    expect(d.cycle.anchor_quote).toBeTruthy();
    expect(d.lastRecap?.summary).toBeTruthy();
    expect(d.lastMeeting && d.lastMeeting.starts_at < new Date(Date.UTC(2026, 8, 30, 2)).toISOString()).toBe(true);
    expect(d.latestUpdate?.kind).toBe("monday");
  });

  it("can preview a later day, e.g. the review phase", () => {
    expect(buildDemoDashboard(new Date(Date.UTC(2026, 8, 30, 2)), 65).day).toBe(65);
  });
});

describe("LEAP plan slide structure", () => {
  const plan = (parsePlan(northside) as { plan: Plan }).plan;
  it("keeps growth opportunities and strategic initiatives as two separate lists", () => {
    expect(plan.growth_opportunities?.length).toBeGreaterThan(0);
    expect(plan.strategic_initiatives?.length).toBeGreaterThan(0);
    expect(plan.plan_pairs).toBeUndefined();
  });
  it("still accepts older plans written as pairs", () => {
    const p = clone();
    delete p.growth_opportunities;
    delete p.strategic_initiatives;
    p.plan_pairs = [{ problem: "a", initiative: "b" }];
    expect(parsePlan(p).ok).toBe(true);
  });
  it("needs one format or the other", () => {
    const p = clone();
    delete p.growth_opportunities;
    delete p.strategic_initiatives;
    expect(parsePlan(p).ok).toBe(false);
  });
});
