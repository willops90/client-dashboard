// The shape of a plan file written after the planning workshop and loaded
// with `npm run load-plan -- ./plans/<file>.json`.

import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date like 2026-08-17");
const text = z.string().trim().min(1, "can't be empty");

function validTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-AU", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const DRAGS = [
  "owner_dependency",
  "management_layer",
  "reliable_numbers",
  "customer_concentration",
  "revenue_quality",
] as const;

export const planSchema = z
  .object({
    client: z.object({
      name: text,
      slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "use lowercase letters, numbers and hyphens"),
      industry: z.string().optional(),
      timezone: z.string().refine(validTimeZone, "must be an IANA timezone such as Australia/Sydney"),
      status: z.enum(["active", "paused", "offboarded"]).optional(),
    }),
    members: z
      .array(
        z.object({
          email: z.string().email(),
          name: text,
          role: z.string().optional(),
        }),
      )
      .min(1, "add at least one client member"),
    cycle: z.object({
      number: z.number().int().min(1),
      start_date: isoDate,
      goal_title: text,
      goal_why: z.string().optional(),
      status: z.enum(["planned", "active", "review", "closed"]).optional(),
    }),
    kpis: z
      .array(
        z.object({
          name: text,
          unit: z.enum(["hrs", "%", "$", "count"]),
          start: z.number(),
          target: z.number(),
          lower_is_better: z.boolean(),
          primary: z.boolean().optional(),
          how_measured: z.string().optional(),
          goals: z.partialRecord(z.enum(["30", "60", "90"]), z.number()).optional(),
        }),
      )
      .min(1, "add at least one KPI"),
    plan_pairs: z.array(z.object({ problem: text, initiative: text })).min(1),
    months: z
      .array(
        z.object({
          number: z.number().int().min(1).max(3),
          summary: text,
          goal: z.string().optional(),
        }),
      )
      .max(3),
    weeks: z
      .array(
        z.object({
          number: z.number().int().min(1).max(13),
          meeting: z.string().nullable().optional(),
          asset: z.string(),
        }),
      )
      .max(13),
    assets: z.array(
      z.object({
        name: text,
        description: z.string().optional(),
        due_week: z.number().int().min(1).max(13).nullable().optional(),
        link: z.string().url().nullable().optional(),
      }),
    ),
    scorecard: z.array(
      z.object({
        drag: z.enum(DRAGS),
        score: z.number().int().min(1).max(10),
        target: z.number().int().min(1).max(10).nullable().optional(),
        in_focus: z.boolean().optional(),
        note: z.string().optional(),
      }),
    ),
    actions: z
      .array(
        z.object({
          owner: text.describe("a member's name, or the advisor's name"),
          title: text,
          due: isoDate,
        }),
      )
      .optional(),
    parked: z.array(z.object({ text, category: z.string().optional() })).optional(),
  })
  .superRefine((plan, ctx) => {
    const primaries = plan.kpis.filter((k) => k.primary).length;
    if (primaries !== 1) {
      ctx.addIssue({ code: "custom", path: ["kpis"], message: `exactly one KPI needs "primary": true (found ${primaries})` });
    }
    const dupes = (xs: (string | number)[]) => xs.filter((x, i) => xs.indexOf(x) !== i);
    for (const [path, values] of [
      ["kpis", plan.kpis.map((k) => k.name)],
      ["months", plan.months.map((m) => m.number)],
      ["weeks", plan.weeks.map((w) => w.number)],
      ["assets", plan.assets.map((a) => a.name)],
      ["scorecard", plan.scorecard.map((s) => s.drag)],
      ["members", plan.members.map((m) => m.email.toLowerCase())],
    ] as const) {
      const d = dupes(values as (string | number)[]);
      if (d.length) ctx.addIssue({ code: "custom", path: [path], message: `duplicate entries: ${[...new Set(d)].join(", ")}` });
    }
    plan.kpis.forEach((k, i) => {
      if (k.start === k.target) {
        ctx.addIssue({ code: "custom", path: ["kpis", i, "target"], message: "target must differ from start" });
      }
      if (k.lower_is_better !== k.target < k.start) {
        ctx.addIssue({
          code: "custom",
          path: ["kpis", i, "lower_is_better"],
          message: `start ${k.start} → target ${k.target} doesn't match lower_is_better: ${k.lower_is_better}`,
        });
      }
    });
  });

export type Plan = z.infer<typeof planSchema>;

export type ParseResult = { ok: true; plan: Plan } | { ok: false; errors: string[] };

export function parsePlan(input: unknown): ParseResult {
  const r = planSchema.safeParse(input);
  if (r.success) return { ok: true, plan: r.data };
  return {
    ok: false,
    errors: r.error.issues.map((i) => `${i.path.length ? i.path.join(".") : "(file)"}: ${i.message}`),
  };
}

/** An action owner of "advisor", or an advisor's display name, belongs to the advisor. */
export function isAdvisorOwner(owner: string, advisorNames: string[]): boolean {
  const o = owner.trim().toLowerCase();
  return o === "advisor" || advisorNames.some((n) => n.toLowerCase() === o);
}

/** Action owners that match neither a member nor an advisor. */
export function unknownOwners(plan: Plan, advisorNames: string[]): string[] {
  const members = plan.members.map((m) => m.name.toLowerCase());
  return (plan.actions ?? [])
    .map((a) => a.owner)
    .filter((o) => !isAdvisorOwner(o, advisorNames) && !members.includes(o.trim().toLowerCase()));
}
