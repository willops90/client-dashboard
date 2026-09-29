// Offboards a client: exports everything to JSON, then disables member logins.
//
//   npm run offboard -- northside              # export only, to exports/northside-<date>/
//   npm run offboard -- northside --confirm    # export, then disable logins and mark offboarded
//
// Nothing is deleted. The export folder holds data.json plus any check-in uploads.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { config } from "dotenv";
import { adminClient } from "./lib";

config({ path: resolve(__dirname, "../.env.local"), quiet: true });

const CYCLE_TABLES = [
  "kpis",
  "plan_pairs",
  "months",
  "weeks",
  "actions",
  "assets",
  "scorecard_scores",
  "updates",
  "meetings",
  "checkins",
] as const;

async function main() {
  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith("--"));
  const confirm = args.includes("--confirm");
  if (!slug) throw new Error("Usage: npm run offboard -- <client-slug> [--confirm]");

  const db = adminClient();
  const q = async <T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>) => {
    const { data, error } = await p;
    if (error) throw new Error(error.message);
    return data as T;
  };

  const client = await q(db.from("clients").select("*").eq("slug", slug).maybeSingle());
  if (!client) throw new Error(`No client with slug "${slug}"`);
  const c = client as { id: string; name: string };

  const members = (await q(db.from("client_members").select("*").eq("client_id", c.id))) as { user_id: string; display_name: string }[];
  const withEmails = await Promise.all(
    members.map(async (m) => ({ ...m, email: (await db.auth.admin.getUserById(m.user_id)).data.user?.email ?? null })),
  );
  const cycles = (await q(db.from("cycles").select("*").eq("client_id", c.id).order("number"))) as { id: string }[];
  const cycleIds = cycles.map((cy) => cy.id);

  const byTable: Record<string, unknown[]> = {};
  for (const t of CYCLE_TABLES) byTable[t] = (await q(db.from(t).select("*").in("cycle_id", cycleIds))) as unknown[];
  const kpiIds = (byTable.kpis as { id: string }[]).map((k) => k.id);
  byTable.kpi_goals = (await q(db.from("kpi_goals").select("*").in("kpi_id", kpiIds))) as unknown[];
  byTable.kpi_readings = (await q(db.from("kpi_readings").select("*").in("kpi_id", kpiIds))) as unknown[];
  byTable.parked_items = (await q(db.from("parked_items").select("*").eq("client_id", c.id))) as unknown[];

  const dir = resolve(__dirname, "../exports", `${slug}-${new Date().toISOString().slice(0, 10)}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "data.json"),
    JSON.stringify({ exported_at: new Date().toISOString(), client, members: withEmails, cycles, ...byTable }, null, 2),
  );

  let files = 0;
  for (const ch of byTable.checkins as { review_file_path: string | null }[]) {
    if (!ch.review_file_path) continue;
    const { data, error } = await db.storage.from("checkin-uploads").download(ch.review_file_path);
    if (error || !data) {
      console.warn(`  ⚠ couldn't download ${ch.review_file_path}: ${error?.message}`);
      continue;
    }
    const out = join(dir, "uploads", ch.review_file_path);
    mkdirSync(join(out, ".."), { recursive: true });
    writeFileSync(out, Buffer.from(await data.arrayBuffer()));
    files++;
  }
  console.log(`\n✓ Exported ${c.name} to ${dir} (${files} uploaded files)`);

  if (!confirm) {
    console.log(`  Logins are still active. Re-run with --confirm to disable them.\n`);
    return;
  }
  for (const m of withEmails) {
    const { error } = await db.auth.admin.updateUserById(m.user_id, { ban_duration: "876000h" });
    if (error) throw new Error(`Disabling ${m.email}: ${error.message}`);
  }
  await q(db.from("clients").update({ status: "offboarded" }).eq("id", c.id).select());
  console.log(`✓ Disabled ${withEmails.length} logins and marked ${c.name} offboarded.\n`);
}

main().catch((e) => {
  console.error(`\n✗ ${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
