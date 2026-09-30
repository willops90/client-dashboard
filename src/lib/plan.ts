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

// Asset previews are built from a few generic block types, so every client's
// assets render through the same components with their own data.
const previewTable = z.object({
  columns: z.array(z.string()).min(1),
  rows: z.array(z.array(z.string())),
  footer: z.array(z.string()).optional(),
});

const previewBlock = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text }),
  z.object({ type: z.literal("table"), title: z.string().optional(), note: z.string().optional() }).extend(previewTable.shape),
  z.object({
    type: z.literal("flow"),
    title: z.string().optional(),
    links: z.array(z.object({ from: text, to: text, weight: z.number().positive().optional() })).min(1),
  }),
  z.object({
    type: z.literal("doc"),
    title: text,
    meta: z.array(z.object({ label: text, value: text })).optional(),
    sections: z.array(
      z.object({
        heading: text,
        text: z.string().optional(),
        steps: z.array(z.string()).optional(),
        table: previewTable.optional(),
      }),
    ),
  }),
  z.object({
    type: z.literal("matrix"),
    title: z.string().optional(),
    people: z.array(text).min(1),
    key: z.record(z.string(), z.string()),
    rows: z.array(z.object({ decision: text, cells: z.array(z.string()) })).min(1),
  }),
  z.object({
    type: z.literal("seats"),
    title: z.string().optional(),
    seats: z
      .array(
        z.object({
          title: text,
          person: text,
          reports_to: z.string().optional(),
          outcomes: z.array(z.string()),
          kpis: z.array(z.string()),
        }),
      )
      .min(1),
  }),
]);

export const assetPreviewSchema = z.object({ blocks: z.array(previewBlock).min(1) });
export type AssetPreview = z.infer<typeof assetPreviewSchema>;
export type PreviewBlock = z.infer<typeof previewBlock>;

export const MILESTONE_STATUSES = ["not_started", "in_progress", "passed", "failed"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const planSchema = z
  .object({
    client: z.object({
      name: text,
      slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "use lowercase letters, numbers and hyphens"),
      industry: z.string().optional(),
      timezone: z.string().refine(validTimeZone, "must be an IANA timezone such as Australia/Sydney"),
      status: z.enum(["active", "paused", "offboarded"]).optional(),
      logo: z
        .string()
        .regex(/^(https:\/\/|\/)\S+$/, "use an https:// link or a path starting with /")
        .optional()
        .describe("the client's logo, shown at the top of their dashboard"),
      exit: z
        .object({
          goal: text.describe('e.g. "Sale-ready by mid-2028"'),
          cycles: z.number().int().min(1).describe("roughly how many 90-day cycles to get there"),
          roadmap: z
            .array(
              z.object({
                cycle: z.number().int().min(1),
                focus: text,
                dates: z.string().optional().describe("leave out to work them out from the cycle start"),
              }),
            )
            .optional(),
        })
        .optional(),
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
      goal_short: z.string().optional().describe("the goal in a few words, shown above the chart"),
      goal_note: z.string().optional().describe("one line of context under the chart"),
      goal_why: z.string().optional(),
      anchor_quote: z.string().optional().describe("the client's own words from the sales call, shown as 'As you put it: …'"),
      status: z.enum(["planned", "active", "review", "closed"]).optional(),
      milestones: z
        .array(
          z.object({
            name: text,
            target: z.string().optional().describe('what passing looks like, e.g. "Passed"'),
            status: z.enum(MILESTONE_STATUSES).optional(),
          }),
        )
        .optional()
        .describe("pass/fail checks shown in the KPIs band beside the numeric KPIs"),
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
    plan_pairs: z
      .array(
        z.object({
          problem: text,
          initiative: text,
          problem_short: z.string().optional().describe("a few words, shown before the row is expanded"),
          initiative_short: z.string().optional(),
        }),
      )
      .optional()
      .describe("older format: problem and initiative in pairs. New plans use the two lists instead"),
    growth_opportunities: z.array(text).min(1).max(6).optional().describe("the problems worth solving, as on the LEAP plan slide"),
    strategic_initiatives: z.array(text).min(1).max(6).optional().describe("what we'll do about them, as on the LEAP plan slide"),
    months: z
      .array(
        z.object({
          number: z.number().int().min(1).max(3),
          summary: text,
          goal: z.string().optional(),
          focus: z.string().optional().describe("the Focus line in the weekly breakdown"),
          weeks: z
            .tuple([z.number().int().min(1).max(13), z.number().int().min(1).max(13)])
            .optional()
            .describe("first and last week in this month, e.g. [1, 5]"),
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
        built_on: z.string().optional(),
        preview: assetPreviewSchema.optional(),
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
    parked: z
      .array(z.object({ text, category: z.string().optional(), cycle: z.number().int().min(1).optional() }))
      .optional(),
  })
  .superRefine((plan, ctx) => {
    const hasLists = !!plan.growth_opportunities?.length && !!plan.strategic_initiatives?.length;
    if (!hasLists && !plan.plan_pairs?.length) {
      ctx.addIssue({ code: "custom", path: ["growth_opportunities"], message: "add growth_opportunities and strategic_initiatives" });
    }
    const primaries = plan.kpis.filter((k) => k.primary).length;
    if (primaries !== 1) {
      ctx.addIssue({ code: "custom", path: ["kpis"], message: `exactly one KPI needs "primary": true (found ${primaries})` });
    }
    plan.assets.forEach((a, i) =>
      a.preview?.blocks.forEach((b, j) => {
        const path = ["assets", i, "preview", "blocks", j];
        if (b.type === "matrix") {
          b.rows.forEach((r, k) => {
            if (r.cells.length !== b.people.length) {
              ctx.addIssue({ code: "custom", path: [...path, "rows", k], message: `needs ${b.people.length} cells, one per person` });
            }
            r.cells.forEach((c) => {
              if (c && !(c in b.key)) ctx.addIssue({ code: "custom", path: [...path, "rows", k], message: `"${c}" isn't in the key` });
            });
          });
        }
        if (b.type === "table" && b.rows.some((r) => r.length !== b.columns.length)) {
          ctx.addIssue({ code: "custom", path, message: `every row needs ${b.columns.length} cells` });
        }
      }),
    );
    if (plan.client.exit?.roadmap?.some((r) => r.cycle > plan.client.exit!.cycles)) {
      ctx.addIssue({ code: "custom", path: ["client", "exit", "roadmap"], message: "a roadmap cycle is beyond the number of cycles" });
    }
    plan.months.forEach((m, i) => {
      if (m.weeks && m.weeks[0] > m.weeks[1]) {
        ctx.addIssue({ code: "custom", path: ["months", i, "weeks"], message: "the first week must come before the last" });
      }
    });
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
