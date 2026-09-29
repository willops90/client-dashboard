import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentCycle, getViewer } from "@/lib/data";
import { CYCLE_DAYS, cycleClock, formatValue, isOverdue, kpiStatus, latestReading, readingDay, targetPath, type CheckinState, type StatusKey } from "@/lib/leap";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "All clients" };

type Row = {
  slug: string;
  name: string;
  day: number | null;
  kpi: { name: string; latest: string; path: string; status: { key: StatusKey; label: string } } | null;
  checkin: { state: CheckinState; week: number | null };
  overdue: number;
  unreviewed: number;
  score: number;
};

const CHECKIN_LABEL: Record<CheckinState, { key: StatusKey; label: (w: number | null) => string }> = {
  submitted: { key: "good", label: (w) => `Week ${w} in` },
  due: { key: "warn", label: (w) => `Week ${w} open, not in yet` },
  missing: { key: "bad", label: (w) => `Week ${w} missing` },
  not_open: { key: "idle", label: () => "Opens Thursday" },
  none: { key: "idle", label: () => "Outside the cycle" },
};

export default async function AdminPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/admin");
  if (viewer.kind !== "advisor") redirect("/");

  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("id, name, slug, timezone").eq("status", "active").order("name");

  const rows: Row[] = await Promise.all(
    (clients ?? []).map(async (c): Promise<Row> => {
      const cycle = await currentCycle(supabase, c.id);
      if (!cycle) {
        return { slug: c.slug, name: c.name, day: null, kpi: null, checkin: { state: "none", week: null }, overdue: 0, unreviewed: 0, score: 0 };
      }
      const [kpi, checkins, actions] = await Promise.all([
        supabase.from("kpis").select("*, kpi_readings(week_number, value)").eq("cycle_id", cycle.id).eq("is_primary", true).maybeSingle(),
        supabase.from("checkins").select("week_number, review_file_path, review_link, advisor_reviewed_at").eq("cycle_id", cycle.id),
        supabase.from("actions").select("due_date, done_at").eq("cycle_id", cycle.id),
      ]);
      const weeks = (checkins.data ?? []).map((ch) => ch.week_number);
      const clock = cycleClock(c.timezone, cycle.start_date, weeks);

      let kpiCell: Row["kpi"] = null;
      if (kpi.data) {
        const k = {
          ...kpi.data,
          start_value: Number(kpi.data.start_value),
          target_value: Number(kpi.data.target_value),
        };
        const readings = (kpi.data.kpi_readings ?? []).map((r: { week_number: number; value: unknown }) => ({ week_number: r.week_number, value: Number(r.value) }));
        const last = latestReading(readings);
        kpiCell = {
          name: k.name,
          latest: last ? formatValue(last.value, k.unit) : "No readings",
          path: last ? formatValue(Math.round(targetPath(k, readingDay(last.week_number)) * 10) / 10, k.unit) : "",
          status: kpiStatus(k, readings),
        };
      }
      const overdue = (actions.data ?? []).filter((a) => isOverdue(a, clock.today)).length;
      const unreviewed = (checkins.data ?? []).filter((ch) => (ch.review_file_path || ch.review_link) && !ch.advisor_reviewed_at).length;
      const score =
        (clock.checkinState === "missing" ? 8 : 0) +
        (kpiCell?.status.key === "bad" ? 4 : kpiCell?.status.key === "warn" ? 2 : 0) +
        (overdue ? 2 : 0) +
        (unreviewed ? 1 : 0);
      return {
        slug: c.slug,
        name: c.name,
        day: clock.day,
        kpi: kpiCell,
        checkin: { state: clock.checkinState, week: clock.window.week },
        overdue,
        unreviewed,
        score,
      };
    }),
  );
  rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">Owner Optional Advisory</div>
        <div className="top-right">
          <p>
            Signed in as {viewer.name}
            <span className="badge teal">Advisor</span>
          </p>
          <form action="/auth/signout" method="post">
            <button className="linkish" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <section className="hero">
        <h1 className="h1-sm">All clients</h1>
        <p className="lede">Anything needing attention is at the top: a missing check-in, an off-track KPI, overdue actions, uploads waiting for feedback.</p>
        {rows.length ? (
          <div className="scroll" tabIndex={0} role="region" aria-label="Clients">
            <table className="overview">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Cycle day</th>
                  <th>Primary KPI (latest vs path)</th>
                  <th>Check-in this week</th>
                  <th>Overdue actions</th>
                  <th>Unreviewed uploads</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ch = CHECKIN_LABEL[r.checkin.state];
                  return (
                    <tr key={r.slug}>
                      <td className="client">
                        <Link href={`/admin/${r.slug}`}>{r.name}</Link>
                      </td>
                      <td>{r.day === null ? "No cycle" : r.day < 1 ? `Starts in ${1 - r.day} days` : r.day > CYCLE_DAYS ? "Finished" : `Day ${r.day}`}</td>
                      <td>
                        {r.kpi ? (
                          <>
                            <span className={`tag ${r.kpi.status.key}`}>{r.kpi.status.label}</span>{" "}
                            {r.kpi.latest}
                            {r.kpi.path && <span className="hint"> vs {r.kpi.path}</span>}
                            <div className="hint">{r.kpi.name}</div>
                          </>
                        ) : (
                          <span className="none">No primary KPI</span>
                        )}
                      </td>
                      <td>
                        <span className={`tag ${ch.key}`}>{ch.label(r.checkin.week)}</span>
                      </td>
                      <td className={r.overdue ? "flag" : "none"}>{r.overdue || "None"}</td>
                      <td className={r.unreviewed ? "flag" : "none"}>{r.unreviewed || "None"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">
            No active clients yet. Load one with <code>npm run load-plan -- ./plans/&lt;client&gt;.json</code>.
          </p>
        )}
      </section>
    </div>
  );
}
