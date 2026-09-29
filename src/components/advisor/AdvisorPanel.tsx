import { enterReading, reviewCheckin } from "@/app/admin/[slug]/actions";
import { formatInstantDate } from "@/lib/format";
import type { DashboardData } from "@/lib/types";
import { InlineForm } from "./InlineForm";

/** Check-in review and on-behalf KPI entry, shown above the dashboard on /admin/[slug]. */
export function AdvisorPanel({ data }: { data: DashboardData }) {
  const { client, checkins, kpis, window, currentWeek } = data;
  const recent = [...checkins].sort((a, b) => b.week_number - a.week_number).slice(0, 4);
  const defaultWeek = window.week ?? Math.max(1, currentWeek - 1);

  return (
    <section className="adv" aria-labelledby="h-adv">
      <h2 id="h-adv" style={{ fontSize: 18 }}>
        Advisor tools
      </h2>
      <div className="adv-grid">
        <div>
          <h3>Recent check-ins</h3>
          {recent.length ? (
            <ul className="checkin-list">
              {recent.map((c) => (
                <li key={c.id}>
                  <div>
                    <b>Week {c.week_number}</b>{" "}
                    <span className="meta">
                      from {c.submitted_by_name ?? "a team member"}, {formatInstantDate(c.submitted_at, client.timezone, { weekday: "short", day: "numeric", month: "short" })}
                    </span>{" "}
                    {c.advisor_reviewed_at ? <span className="tag good">Reviewed</span> : c.review_file_path || c.review_link ? <span className="tag warn">Upload to review</span> : null}
                  </div>
                  {c.blockers && (
                    <div>
                      <span className="meta">Got in the way:</span> {c.blockers}
                    </div>
                  )}
                  {c.for_next_meeting && (
                    <div>
                      <span className="meta">For the meeting:</span> {c.for_next_meeting}
                    </div>
                  )}
                  {(c.review_file_path || c.review_link) && (
                    <div className="row-actions">
                      {c.review_file_path && (
                        <a href={`/files/${c.id}`} target="_blank" rel="noreferrer">
                          Open upload
                        </a>
                      )}
                      {c.review_link && (
                        <a href={c.review_link} target="_blank" rel="noreferrer">
                          Open link
                        </a>
                      )}
                      {c.advisor_feedback_link && (
                        <a href={c.advisor_feedback_link} target="_blank" rel="noreferrer">
                          Your feedback
                        </a>
                      )}
                    </div>
                  )}
                  {!c.advisor_reviewed_at && (
                    <InlineForm action={reviewCheckin} className="form inline">
                      <input type="hidden" name="slug" value={client.slug} />
                      <input type="hidden" name="id" value={c.id} />
                      <input type="url" name="feedback_link" placeholder="Loom link (optional)" aria-label="Feedback link" style={{ flex: "1 1 180px" }} />
                      <button className="btn sm" type="submit">
                        Mark reviewed
                      </button>
                    </InlineForm>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No check-ins yet.</p>
          )}
        </div>
        <div>
          <h3>Enter a KPI reading for the client</h3>
          <p className="hint">Shown as advisor-entered. Overwrites that week's reading if there is one.</p>
          <InlineForm action={enterReading} className="form">
            <input type="hidden" name="slug" value={client.slug} />
            <label className="field">
              <span>KPI</span>
              <select name="kpi_id">
                {kpis.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name} ({k.unit})
                  </option>
                ))}
              </select>
            </label>
            <div className="form inline">
              <label className="field">
                <span>Week</span>
                <input type="number" name="week" min={1} max={13} defaultValue={defaultWeek} style={{ width: 90 }} required />
              </label>
              <label className="field">
                <span>Value</span>
                <input type="text" inputMode="decimal" name="value" style={{ width: 140 }} required />
              </label>
            </div>
            <button className="btn sm" type="submit">
              Save reading
            </button>
          </InlineForm>
        </div>
      </div>
    </section>
  );
}
