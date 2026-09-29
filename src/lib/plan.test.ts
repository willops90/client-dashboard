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
