// Row Level Security: a member of one client must never read or write
// another client's rows. Runs against a real Postgres.
//
//   TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres npm run test:rls
//
// The test creates a throwaway database, applies Supabase stand-ins and every
// migration, runs, and drops it. Without TEST_DATABASE_URL it is skipped.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const adminUrl = process.env.TEST_DATABASE_URL;
const root = join(__dirname, "..");
const dbName = `leap_rls_${Date.now()}`;

const ids = {
  advisor: randomUUID(),
  dave: randomUUID(), // member of Northside
  erin: randomUUID(), // member of Other Co
  stranger: randomUUID(), // signed in, member of nothing
  northside: randomUUID(),
  other: randomUUID(),
  nCycle: randomUUID(),
  oCycle: randomUUID(),
  nKpi: randomUUID(),
  oKpi: randomUUID(),
  daveMember: randomUUID(),
  erinMember: randomUUID(),
  nTeamAction: randomUUID(),
  nAdvisorAction: randomUUID(),
  oAction: randomUUID(),
  nCheckin: randomUUID(),
  oCheckin: randomUUID(),
};

let db: Client;

async function asUser<T>(userId: string | null, fn: (c: Client) => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    await db.query(`set local role ${userId ? "authenticated" : "anon"}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    return await fn(db);
  } finally {
    await db.query("rollback");
  }
}

const count = async (c: Client, sql: string, params: unknown[] = []) =>
  Number((await c.query(`select count(*)::int as n from (${sql}) q`, params)).rows[0].n);

describe.skipIf(!adminUrl)("row level security", () => {
  beforeAll(async () => {
    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`create database ${dbName}`);
    await admin.end();

    const url = new URL(adminUrl!);
    url.pathname = `/${dbName}`;
    db = new Client({ connectionString: url.toString() });
    await db.connect();

    await db.query(readFileSync(join(root, "tests/support/supabase-stubs.sql"), "utf8"));
    const migrations = readdirSync(join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
    for (const f of migrations) await db.query(readFileSync(join(root, "supabase/migrations", f), "utf8"));

    await db.query(
      `insert into auth.users (id, email) values ($1,'will@x'),($2,'dave@x'),($3,'erin@x'),($4,'nobody@x')`,
      [ids.advisor, ids.dave, ids.erin, ids.stranger],
    );
    await db.query(`insert into advisors (user_id, display_name) values ($1, 'Will')`, [ids.advisor]);
    await db.query(
      `insert into clients (id, name, slug, timezone) values ($1,'Northside','northside','Australia/Brisbane'),($2,'Other Co','other','Australia/Perth')`,
      [ids.northside, ids.other],
    );
    await db.query(
      `insert into client_members (id, client_id, user_id, display_name) values ($1,$2,$3,'Dave'),($4,$5,$6,'Erin')`,
      [ids.daveMember, ids.northside, ids.dave, ids.erinMember, ids.other, ids.erin],
    );
    await db.query(
      `insert into cycles (id, client_id, number, start_date, goal_title) values ($1,$2,1,'2026-08-17','N goal'),($3,$4,1,'2026-08-17','O goal')`,
      [ids.nCycle, ids.northside, ids.oCycle, ids.other],
    );
    await db.query(
      `insert into kpis (id, cycle_id, name, unit, start_value, target_value, is_primary) values ($1,$2,'Hours','hrs',58,35,true),($3,$4,'Hours','hrs',50,40,true)`,
      [ids.nKpi, ids.nCycle, ids.oKpi, ids.oCycle],
    );
    await db.query(`insert into kpi_readings (kpi_id, week_number, value) values ($1,1,57),($2,1,49)`, [ids.nKpi, ids.oKpi]);
    await db.query(
      `insert into actions (id, cycle_id, owner_member_id, owner_is_advisor, title, due_date) values
        ($1,$2,$3,false,'Sign off pricing','2026-09-25'),
        ($4,$2,null,true,'Record Loom','2026-09-29'),
        ($5,$6,$7,false,'Other action','2026-09-25')`,
      [ids.nTeamAction, ids.nCycle, ids.daveMember, ids.nAdvisorAction, ids.oAction, ids.oCycle, ids.erinMember],
    );
    await db.query(
      `insert into checkins (id, cycle_id, week_number, submitted_by) values ($1,$2,1,$3),($4,$5,1,$6)`,
      [ids.nCheckin, ids.nCycle, ids.dave, ids.oCheckin, ids.oCycle, ids.erin],
    );
    await db.query(`insert into parked_items (client_id, text) values ($1,'N parked'),($2,'O parked')`, [ids.northside, ids.other]);
    await db.query(
      `insert into storage.objects (bucket_id, name) values ('checkin-uploads', $1),('checkin-uploads', $2)`,
      [`${ids.northside}/${ids.nCycle}/week-1/a.pdf`, `${ids.other}/${ids.oCycle}/week-1/b.pdf`],
    );
  });

  afterAll(async () => {
    await db?.end();
    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`drop database if exists ${dbName} with (force)`);
    await admin.end();
  });

  it("shows a member only their own client, across every table", async () => {
    await asUser(ids.dave, async (c) => {
      const tables: [string, number][] = [
        ["clients", 1],
        ["client_members", 1],
        ["cycles", 1],
        ["kpis", 1],
        ["kpi_readings", 1],
        ["actions", 2],
        ["checkins", 1],
        ["parked_items", 1],
      ];
      for (const [t, n] of tables) expect(await count(c, `select * from ${t}`), t).toBe(n);
      expect(await count(c, `select * from clients where slug = 'other'`)).toBe(0);
      expect(await count(c, `select * from kpi_readings where kpi_id = $1`, [ids.oKpi])).toBe(0);
    });
  });

  it("hides uploads in another client's folder", async () => {
    await asUser(ids.dave, async (c) => {
      const names = (await c.query(`select name from storage.objects`)).rows.map((r) => r.name);
      expect(names).toEqual([`${ids.northside}/${ids.nCycle}/week-1/a.pdf`]);
    });
    await asUser(ids.dave, async (c) => {
      await expect(
        c.query(`insert into storage.objects (bucket_id, name) values ('checkin-uploads', $1)`, [`${ids.other}/x/week-2/evil.pdf`]),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it("shows a signed-in stranger and anonymous visitors nothing", async () => {
    for (const who of [ids.stranger, null]) {
      await asUser(who, async (c) => {
        for (const t of ["clients", "cycles", "kpis", "kpi_readings", "actions", "checkins", "parked_items"]) {
          expect(await count(c, `select * from ${t}`), t).toBe(0);
        }
      });
    }
  });

  it("lets the advisor see every client", async () => {
    await asUser(ids.advisor, async (c) => {
      expect(await count(c, `select * from clients`)).toBe(2);
      expect(await count(c, `select * from kpi_readings`)).toBe(2);
      expect(await count(c, `select * from storage.objects`)).toBe(2);
    });
  });

  it("blocks writing a check-in or reading into another client's cycle", async () => {
    await asUser(ids.dave, async (c) => {
      await expect(
        c.query(`insert into checkins (cycle_id, week_number, submitted_by) values ($1, 2, $2)`, [ids.oCycle, ids.dave]),
      ).rejects.toThrow(/row-level security/);
    });
    await asUser(ids.dave, async (c) => {
      await expect(
        c.query(`insert into kpi_readings (kpi_id, week_number, value, entered_by) values ($1, 2, 1, $2)`, [ids.oKpi, ids.dave]),
      ).rejects.toThrow(/row-level security/);
    });
    await asUser(ids.dave, async (c) => {
      const r = await c.query(`update kpi_readings set value = 0 where kpi_id = $1`, [ids.oKpi]);
      expect(r.rowCount).toBe(0);
    });
  });

  it("lets a member write their own check-in and readings", async () => {
    await asUser(ids.dave, async (c) => {
      await c.query(`insert into checkins (cycle_id, week_number, submitted_by, blockers) values ($1, 2, $2, 'none')`, [ids.nCycle, ids.dave]);
      await c.query(`insert into kpi_readings (kpi_id, week_number, value, entered_by) values ($1, 2, 55, $2)`, [ids.nKpi, ids.dave]);
      expect(await count(c, `select * from kpi_readings where kpi_id = $1`, [ids.nKpi])).toBe(2);
    });
  });

  it("stops a member marking their own check-in reviewed", async () => {
    await asUser(ids.dave, async (c) => {
      await c.query(`update checkins set advisor_reviewed_at = now(), blockers = 'x' where id = $1`, [ids.nCheckin]);
      const row = (await c.query(`select advisor_reviewed_at, blockers from checkins where id = $1`, [ids.nCheckin])).rows[0];
      expect(row.advisor_reviewed_at).toBeNull();
      expect(row.blockers).toBe("x");
    });
  });

  it("lets a member tick client-team actions but nothing else about them", async () => {
    await asUser(ids.dave, async (c) => {
      const tick = await c.query(`update actions set done_at = now() where id = $1`, [ids.nTeamAction]);
      expect(tick.rowCount).toBe(1);
      const advisors = await c.query(`update actions set done_at = now() where id = $1`, [ids.nAdvisorAction]);
      expect(advisors.rowCount).toBe(0);
      const others = await c.query(`update actions set done_at = now() where id = $1`, [ids.oAction]);
      expect(others.rowCount).toBe(0);
    });
    await asUser(ids.dave, async (c) => {
      await expect(c.query(`update actions set title = 'changed' where id = $1`, [ids.nTeamAction])).rejects.toThrow(
        /only mark actions done/,
      );
    });
    await asUser(ids.dave, async (c) => {
      await expect(
        c.query(`insert into actions (cycle_id, title, due_date) values ($1, 'new', '2026-10-01')`, [ids.nCycle]),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it("lets a member park items for their own client only", async () => {
    await asUser(ids.dave, async (c) => {
      await c.query(`insert into parked_items (client_id, text, added_by) values ($1, 'idea', $2)`, [ids.northside, ids.dave]);
    });
    await asUser(ids.dave, async (c) => {
      await expect(
        c.query(`insert into parked_items (client_id, text, added_by) values ($1, 'idea', $2)`, [ids.other, ids.dave]),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it("stops members changing the plan", async () => {
    await asUser(ids.dave, async (c) => {
      const r = await c.query(`update cycles set goal_title = 'hacked' where id = $1`, [ids.nCycle]);
      expect(r.rowCount).toBe(0);
      const k = await c.query(`update kpis set target_value = 0 where id = $1`, [ids.nKpi]);
      expect(k.rowCount).toBe(0);
    });
  });

  it("cuts off members of an offboarded client", async () => {
    await db.query(`update clients set status = 'offboarded' where id = $1`, [ids.northside]);
    try {
      await asUser(ids.dave, async (c) => {
        expect(await count(c, `select * from clients`)).toBe(0);
        expect(await count(c, `select * from kpi_readings`)).toBe(0);
      });
    } finally {
      await db.query(`update clients set status = 'active' where id = $1`, [ids.northside]);
    }
  });
});
