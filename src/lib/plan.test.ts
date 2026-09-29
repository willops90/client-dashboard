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
