// Loads a client's LEAP plan from a JSON file.
//
//   npm run load-plan -- ./plans/northside-cycle-1.json            # load and invite members
//   npm run load-plan -- ./plans/northside-cycle-1.json --dry-run  # validate only
//   npm run load-plan -- ./plans/northside-cycle-1.json --no-invite  # create logins without emailing
//
// Safe to run again for the same cycle: it updates the plan in place. Anything
// clients or the advisor change day to day (asset, month and week status,
// ticked actions, readings, check-ins) is left alone.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { isAdvisorOwner, parsePlan, unknownOwners, type Plan } from "../src/lib/plan";
import { adminClient, findUserByEmail } from "./lib";

config({ path: resolve(__dirname, "../.env.local"), quiet: true });

type Db = ReturnType<typeof adminClient>;

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function must<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) fail(`${what}: ${result.error.message}`);
  return result.data as T;
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  const invite = !args.includes("--no-invite");
  if (!file) fail("Usage: npm run load-plan -- ./plans/<client>-cycle-<n>.json [--dry-run] [--no-invite]");

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(resolve(file), "utf8"));
  } catch (e) {
    fail(`Couldn't read ${file}: ${(e as Error).message}`);
  }

  const parsed = parsePlan(raw);
  if (!parsed.ok) fail(`${file} has problems:\n  - ${parsed.errors.join("\n  - ")}`);
  const plan = parsed.plan;

  if (dryRun) {
    console.log(`✓ ${file} is valid: ${plan.client.name}, cycle ${plan.cycle.number}, ${plan.kpis.length} KPIs.`);
    return;
  }

  const db = adminClient();
  const advisors = must(await db.from("advisors").select("display_name"), "Reading advisors") as { display_name: string }[];
  const advisorNames = advisors.map((a) => a.display_name);
  const unknown = unknownOwners(plan, advisorNames);
  if (unknown.length) {
    fail(
      `These action owners match no member or advisor: ${unknown.join(", ")}.\n` +
        `  Members: ${plan.members.map((m) => m.name).join(", ")}. Advisors: ${advisorNames.join(", ") || "(none yet: run npm run add-advisor)"}.`,
    );
  }

  const log: string[] = [];
  const clientId = await loadClient(db, plan, log);
  const memberIds = await loadMembers(db, plan, clientId, invite, log);
  const cycleId = await loadCycle(db, plan, clientId, log);
  await loadKpis(db, plan, cycleId, log);
  await loadPlanPairs(db, plan, cycleId);
  await loadMonthsAndWeeks(db, plan, cycleId, log);
  await loadAssets(db, plan, cycleId, log);
  await loadScorecard(db, plan, cycleId);
  await loadActions(db, plan, cycleId, memberIds, advisorNames, log);
  await loadParked(db, plan, clientId, log);

  console.log(`\n✓ Loaded ${plan.client.name}, cycle ${plan.cycle.number}\n  ${log.join("\n  ")}\n`);
  console.log(`  Dashboard: ${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/c/${plan.client.slug}\n`);
}

async function loadClient(db: Db, plan: Plan, log: string[]): Promise<string> {
  const { name, slug, industry, timezone, status, exit } = plan.client;
  const row = must(
    await db
      .from("clients")
      .upsert(
        {
          name,
          slug,
          industry: industry ?? null,
          timezone,
          exit_goal: exit?.goal ?? null,
          exit_cycles_estimate: exit?.cycles ?? null,
          exit_roadmap: exit?.roadmap ?? null,
          ...(status ? { status } : {}),
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single(),
    "Saving client",
  ) as { id: string };
  log.push(`client: ${name} (/c/${slug})`);
  return row.id;
}

async function loadMembers(db: Db, plan: Plan, clientId: string, invite: boolean, log: string[]) {
  const ids = new Map<string, string>(); // lower-case name → member id
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  for (const m of plan.members) {
    let user = await findUserByEmail(db, m.email);
    if (!user) {
      if (invite) {
        const { data, error } = await db.auth.admin.inviteUserByEmail(m.email, {
          redirectTo: siteUrl ? `${siteUrl}/auth/confirm` : undefined,
          data: { name: m.name },
        });
        if (error) fail(`Inviting ${m.email}: ${error.message}`);
        user = data.user;
        log.push(`invited ${m.name} <${m.email}>`);
      } else {
        const { data, error } = await db.auth.admin.createUser({ email: m.email, email_confirm: true, user_metadata: { name: m.name } });
        if (error) fail(`Creating login for ${m.email}: ${error.message}`);
        user = data.user;
        log.push(`created login for ${m.name} <${m.email}> (no email sent)`);
      }
    }
    const existing = must(
      await db.from("client_members").select("id, client_id").eq("user_id", user.id).maybeSingle(),
      "Reading members",
    ) as { id: string; client_id: string } | null;
    if (existing && existing.client_id !== clientId) {
      fail(`${m.email} already belongs to another client. A person can belong to one client only.`);
    }
    const row = must(
      await db
        .from("client_members")
        .upsert({ client_id: clientId, user_id: user.id, display_name: m.name, role_label: m.role ?? null }, { onConflict: "user_id" })
        .select("id")
        .single(),
      `Saving member ${m.email}`,
    ) as { id: string };
    ids.set(m.name.toLowerCase(), row.id);
  }
  log.push(`members: ${plan.members.map((m) => m.name).join(", ")}`);
  return ids;
}

async function loadCycle(db: Db, plan: Plan, clientId: string, log: string[]): Promise<string> {
  const c = plan.cycle;
  const row = must(
    await db
      .from("cycles")
      .upsert(
        {
          client_id: clientId,
          number: c.number,
          start_date: c.start_date,
          goal_title: c.goal_title,
          goal_short: c.goal_short ?? null,
          goal_note: c.goal_note ?? null,
          goal_why: c.goal_why ?? null,
          ...(c.status ? { status: c.status } : {}),
        },
        { onConflict: "client_id,number" },
      )
      .select("id, start_date, end_date")
      .single(),
    "Saving cycle",
  ) as { id: string; start_date: string; end_date: string };
  log.push(`cycle ${c.number}: ${row.start_date} to ${row.end_date}`);
  return row.id;
}

async function loadKpis(db: Db, plan: Plan, cycleId: string, log: string[]) {
  // Clear the primary flag first so moving it between KPIs can't trip the
  // one-primary-per-cycle index.
  must(await db.from("kpis").update({ is_primary: false }).eq("cycle_id", cycleId), "Resetting primary KPI");
  const rows = must(
    await db
      .from("kpis")
      .upsert(
        plan.kpis.map((k, i) => ({
          cycle_id: cycleId,
          name: k.name,
          unit: k.unit,
          start_value: k.start,
          target_value: k.target,
          lower_is_better: k.lower_is_better,
          is_primary: !!k.primary,
          how_measured: k.how_measured ?? null,
          sort: i,
        })),
        { onConflict: "cycle_id,name" },
      )
      .select("id, name"),
    "Saving KPIs",
  ) as { id: string; name: string }[];

  for (const k of plan.kpis) {
    const id = rows.find((r) => r.name === k.name)!.id;
    must(await db.from("kpi_goals").delete().eq("kpi_id", id), "Clearing KPI goals");
    const goals = Object.entries(k.goals ?? {}).map(([day, value]) => ({ kpi_id: id, day: Number(day), value }));
    if (goals.length) must(await db.from("kpi_goals").insert(goals), "Saving KPI goals");
  }

  const all = must(await db.from("kpis").select("name").eq("cycle_id", cycleId), "Reading KPIs") as { name: string }[];
  const stale = all.filter((r) => !plan.kpis.some((k) => k.name === r.name));
  if (stale.length) {
    log.push(`⚠ KPIs in the database but not the file (left in place, with their readings): ${stale.map((s) => s.name).join(", ")}`);
  }
  log.push(`KPIs: ${plan.kpis.map((k) => k.name).join(", ")}`);
}

async function loadPlanPairs(db: Db, plan: Plan, cycleId: string) {
  must(await db.from("plan_pairs").delete().eq("cycle_id", cycleId), "Clearing plan pairs");
  must(
    await db.from("plan_pairs").insert(plan.plan_pairs.map((p, i) => ({ cycle_id: cycleId, ...p, sort: i }))),
    "Saving plan pairs",
  );
}

async function loadMonthsAndWeeks(db: Db, plan: Plan, cycleId: string, log: string[]) {
  // Status is day-to-day state the advisor sets, so it is never overwritten here.
  if (plan.months.length) {
    must(
      await db.from("months").upsert(
        plan.months.map((m) => ({ cycle_id: cycleId, number: m.number, summary: m.summary, goal_text: m.goal ?? null })),
        { onConflict: "cycle_id,number" },
      ),
      "Saving months",
    );
  }
  must(
    await db.from("months").delete().eq("cycle_id", cycleId).not("number", "in", `(${plan.months.map((m) => m.number).join(",") || 0})`),
    "Removing old months",
  );
  if (plan.weeks.length) {
    must(
      await db.from("weeks").upsert(
        plan.weeks.map((w) => ({ cycle_id: cycleId, number: w.number, meeting: w.meeting ?? null, asset: w.asset })),
        { onConflict: "cycle_id,number" },
      ),
      "Saving weeks",
    );
  }
  must(
    await db.from("weeks").delete().eq("cycle_id", cycleId).not("number", "in", `(${plan.weeks.map((w) => w.number).join(",") || 0})`),
    "Removing old weeks",
  );
  log.push(`${plan.months.length} months, ${plan.weeks.length} weeks`);
}

async function loadAssets(db: Db, plan: Plan, cycleId: string, log: string[]) {
  if (plan.assets.length) {
    must(
      await db.from("assets").upsert(
        plan.assets.map((a, i) => ({
          cycle_id: cycleId,
          name: a.name,
          description: a.description ?? null,
          due_week: a.due_week ?? null,
          link: a.link ?? null,
          built_on: a.built_on ?? null,
          preview: a.preview ?? null,
          sort: i,
        })),
        { onConflict: "cycle_id,name" },
      ),
      "Saving assets",
    );
  }
  const all = must(await db.from("assets").select("name").eq("cycle_id", cycleId), "Reading assets") as { name: string }[];
  const stale = all.filter((r) => !plan.assets.some((a) => a.name === r.name));
  if (stale.length) log.push(`⚠ assets in the database but not the file (left in place): ${stale.map((s) => s.name).join(", ")}`);
  log.push(`${plan.assets.length} assets`);
}

async function loadScorecard(db: Db, plan: Plan, cycleId: string) {
  must(await db.from("scorecard_scores").delete().eq("cycle_id", cycleId).eq("scored_at", "start"), "Clearing scorecard");
  if (plan.scorecard.length) {
    must(
      await db.from("scorecard_scores").insert(
        plan.scorecard.map((s) => ({
          cycle_id: cycleId,
          drag: s.drag,
          score: s.score,
          target: s.target ?? null,
          in_focus: !!s.in_focus,
          note: s.note ?? null,
          scored_at: "start",
        })),
      ),
      "Saving scorecard",
    );
  }
}

async function loadActions(
  db: Db,
  plan: Plan,
  cycleId: string,
  memberIds: Map<string, string>,
  advisorNames: string[],
  log: string[],
) {
  const existing = must(await db.from("actions").select("id, title").eq("cycle_id", cycleId), "Reading actions") as {
    id: string;
    title: string;
  }[];
  let added = 0;
  for (const a of plan.actions ?? []) {
    const advisor = isAdvisorOwner(a.owner, advisorNames);
    const fields = {
      cycle_id: cycleId,
      title: a.title,
      due_date: a.due,
      owner_is_advisor: advisor,
      owner_member_id: advisor ? null : memberIds.get(a.owner.trim().toLowerCase())!,
    };
    const match = existing.find((e) => e.title === a.title);
    if (match) {
      must(await db.from("actions").update(fields).eq("id", match.id), `Updating action "${a.title}"`);
    } else {
      must(await db.from("actions").insert(fields), `Saving action "${a.title}"`);
      added++;
    }
  }
  if (plan.actions?.length) log.push(`actions: ${added} new, ${plan.actions.length - added} updated`);
}

async function loadParked(db: Db, plan: Plan, clientId: string, log: string[]) {
  if (!plan.parked?.length) return;
  const existing = must(await db.from("parked_items").select("id, text").eq("client_id", clientId), "Reading parked items") as {
    id: string;
    text: string;
  }[];
  const fresh = plan.parked.filter((p) => !existing.some((e) => e.text === p.text));
  for (const p of plan.parked) {
    const match = existing.find((e) => e.text === p.text);
    if (match) {
      must(
        await db.from("parked_items").update({ category: p.category ?? null, planned_cycle: p.cycle ?? null }).eq("id", match.id),
        "Updating parked item",
      );
    }
  }
  if (fresh.length) {
    must(
      await db
        .from("parked_items")
        .insert(fresh.map((p) => ({ client_id: clientId, text: p.text, category: p.category ?? null, planned_cycle: p.cycle ?? null }))),
      "Saving parked items",
    );
  }
  log.push(`parked items: ${fresh.length} new`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
