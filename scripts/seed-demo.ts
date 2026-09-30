// Fills a loaded Northside cycle with made-up activity (readings for weeks
// 1–6, statuses, a Monday update, the next meeting) so a local database looks
// like the design reference. For local development only.
//
//   npm run load-plan -- ./plans/northside-cycle-1.json --no-invite
//   npm run seed-demo

import { resolve } from "node:path";
import { config } from "dotenv";
import { addDays, zonedTimeToUtc } from "../src/lib/leap";
import {
  demoAssetStatus,
  demoCheckinWeeks,
  demoDoneActions,
  demoExtraAdvisorAction,
  demoLastMeeting,
  demoMeeting,
  demoRecap,
  demoMonthStatus,
  demoReadings,
  demoUpdate,
} from "../src/lib/demo-activity";
import { adminClient } from "./lib";

config({ path: resolve(__dirname, "../.env.local"), quiet: true });

async function main() {
  const db = adminClient();
  const ok = <T>(r: { data: T | null; error: { message: string } | null }, what: string): T => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
    return r.data as T;
  };

  const client = ok(await db.from("clients").select("id, timezone").eq("slug", "northside").maybeSingle(), "Reading client") as {
    id: string;
    timezone: string;
  } | null;
  if (!client) throw new Error("Load the plan first: npm run load-plan -- ./plans/northside-cycle-1.json --no-invite");
  const cycle = ok(await db.from("cycles").select("id, start_date").eq("client_id", client.id).eq("number", 1).single(), "Reading cycle") as {
    id: string;
    start_date: string;
  };
  const at = (offset: number) => addDays(cycle.start_date, offset);
  const tz = client.timezone;

  const members = ok(await db.from("client_members").select("id, user_id, display_name").eq("client_id", client.id), "Reading members") as {
    user_id: string;
    display_name: string;
  }[];
  const dave = members.find((m) => m.display_name === "Dave");

  const checkinRows = ok(
    await db
      .from("checkins")
      .upsert(
        demoCheckinWeeks.map((w) => ({
          cycle_id: cycle.id,
          week_number: w,
          submitted_by: dave?.user_id ?? null,
          submitted_at: zonedTimeToUtc(`${at(w * 7 - 3)}T16:00`, tz).toISOString(),
        })),
        { onConflict: "cycle_id,week_number" },
      )
      .select("id, week_number"),
    "Saving check-ins",
  ) as { id: string; week_number: number }[];

  const kpis = ok(await db.from("kpis").select("id, name").eq("cycle_id", cycle.id), "Reading KPIs") as { id: string; name: string }[];
  for (const k of kpis) {
    const values = demoReadings[k.name] ?? [];
    if (!values.length) continue;
    ok(
      await db.from("kpi_readings").upsert(
        values.map((value, i) => ({
          kpi_id: k.id,
          week_number: i + 1,
          value,
          entered_by: dave?.user_id ?? null,
          checkin_id: checkinRows.find((c) => c.week_number === i + 1)?.id ?? null,
        })),
        { onConflict: "kpi_id,week_number" },
      ),
      `Saving readings for ${k.name}`,
    );
  }

  for (const [n, status] of Object.entries(demoMonthStatus)) {
    ok(await db.from("months").update({ status }).eq("cycle_id", cycle.id).eq("number", Number(n)), "Saving month status");
  }
  for (const [name, status] of Object.entries(demoAssetStatus)) {
    ok(await db.from("assets").update({ status }).eq("cycle_id", cycle.id).eq("name", name), "Saving asset status");
  }
  ok(await db.from("weeks").update({ status: "done" }).eq("cycle_id", cycle.id).lt("number", 7), "Saving week status");
  ok(await db.from("weeks").update({ status: "this_week" }).eq("cycle_id", cycle.id).eq("number", 7), "Saving week status");

  const { data: existing } = await db.from("actions").select("id").eq("cycle_id", cycle.id).eq("title", demoExtraAdvisorAction.title).maybeSingle();
  if (!existing) {
    ok(
      await db.from("actions").insert({
        cycle_id: cycle.id,
        title: demoExtraAdvisorAction.title,
        due_date: at(demoExtraAdvisorAction.dueOffset),
        owner_is_advisor: true,
      }),
      "Saving action",
    );
  }
  for (const [title, offset] of Object.entries(demoDoneActions)) {
    ok(
      await db
        .from("actions")
        .update({ done_at: zonedTimeToUtc(`${at(offset)}T12:00`, tz).toISOString() })
        .eq("cycle_id", cycle.id)
        .eq("title", title),
      "Ticking action",
    );
  }

  ok(await db.from("updates").delete().eq("cycle_id", cycle.id).eq("sent_on", at(demoUpdate.offset)), "Clearing update");
  ok(await db.from("updates").insert({ cycle_id: cycle.id, kind: "monday", sent_on: at(demoUpdate.offset), body: demoUpdate.body }), "Saving update");

  ok(await db.from("updates").delete().eq("cycle_id", cycle.id).eq("sent_on", at(demoRecap.offset)), "Clearing recap");
  ok(
    await db
      .from("updates")
      .insert({ cycle_id: cycle.id, kind: "recap", sent_on: at(demoRecap.offset), body: demoRecap.body, summary: demoRecap.summary }),
    "Saving recap",
  );
  const lastStartsAt = zonedTimeToUtc(`${at(demoLastMeeting.offset)}T${demoLastMeeting.time}`, tz).toISOString();
  ok(await db.from("meetings").delete().eq("cycle_id", cycle.id).eq("starts_at", lastStartsAt), "Clearing last meeting");
  ok(
    await db.from("meetings").insert({ cycle_id: cycle.id, starts_at: lastStartsAt, duration_min: demoLastMeeting.duration_min }),
    "Saving last meeting",
  );

  const startsAt = zonedTimeToUtc(`${at(demoMeeting.offset)}T${demoMeeting.time}`, tz).toISOString();
  ok(await db.from("meetings").delete().eq("cycle_id", cycle.id).eq("starts_at", startsAt), "Clearing meeting");
  ok(
    await db.from("meetings").insert({
      cycle_id: cycle.id,
      starts_at: startsAt,
      duration_min: demoMeeting.duration_min,
      agenda: demoMeeting.agenda,
      link: demoMeeting.link,
    }),
    "Saving meeting",
  );

  console.log("\n✓ Northside demo activity added: readings for weeks 1–6, statuses, a Monday update and the next meeting.\n");
}

main().catch((e) => {
  console.error(`\n✗ ${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
