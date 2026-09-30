import Markdown from "react-markdown";
import { actionStatus, formatDate, inFortnight } from "@/lib/leap";
import { dueLabel, formatMeetingTime, tzAbbrev } from "@/lib/format";
import type { Action, DashboardData } from "@/lib/types";
import { ActionTick } from "@/components/dashboard/ActionTick";

function Row({ a, data }: { a: Action; data: DashboardData }) {
  const { viewer, today, client } = data;
  const st = actionStatus(a, today);
  const canTick = viewer.kind === "demo" || viewer.kind === "advisor" || (viewer.kind === "member" && a.owner_member_id === viewer.memberId);
  return (
    <li className={a.done_at ? "done" : undefined}>
      <ActionTick slug={client.slug} actionId={a.id} done={!!a.done_at} label={a.title} canTick={canTick} demo={viewer.kind === "demo"} />
      <label htmlFor={`act-${a.id}`}>
        <span className="what">{a.title}</span>
        <span className="due">
          <span className={`v2-who${a.owner_is_advisor ? " is-advisor" : ""}`}>{a.owner_name}</span> {dueLabel(a.due_date, a.done_at, today, client.timezone)}
        </span>
      </label>
      {!a.done_at && st.key !== "idle" && <span className={`tag ${st.key}`}>{st.label}</span>}
    </li>
  );
}

/** What needs doing now: open actions (overdue first), the next meeting, and the latest update. */
export function ThisWeek({ data }: { data: DashboardData }) {
  const { actions, today, client, nextMeeting: m, latestUpdate: u } = data;
  const recent = actions.filter((a) => inFortnight(a, today, client.timezone));
  const open = recent.filter((a) => !a.done_at).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const done = recent.filter((a) => a.done_at);
  const [firstPara, ...rest] = (u?.body ?? "").split(/\n\s*\n/);

  return (
    <section className="block v2-week" aria-labelledby="h-week">
      <h2 id="h-week">This week</h2>
      <div className="split">
        <div>
          {open.length ? (
            <ul className="actions">
              {open.map((a) => (
                <Row key={a.id} a={a} data={data} />
              ))}
            </ul>
          ) : (
            <p className="empty">Nothing open. Nice.</p>
          )}
          {done.length > 0 && (
            <details className="v2-more">
              <summary>{done.length} done recently</summary>
              <ul className="actions">
                {done.map((a) => (
                  <Row key={a.id} a={a} data={data} />
                ))}
              </ul>
            </details>
          )}
        </div>
        <div className="v2-week-side">
          {m ? (
            <div className="v2-meeting">
              <p className="v2-kicker">Next meeting</p>
              <p className="v2-meeting-when">
                {formatMeetingTime(m.starts_at, client.timezone)} <span className="hint">{tzAbbrev(m.starts_at, client.timezone)}</span>
              </p>
              <div className="row-actions">
                {m.link && (
                  <a className="btn sm" href={m.link} target="_blank" rel="noreferrer">
                    Join
                  </a>
                )}
                {m.agenda && (
                  <details className="v2-more inline">
                    <summary>Agenda</summary>
                    <div className="md">
                      <Markdown>{m.agenda}</Markdown>
                    </div>
                  </details>
                )}
              </div>
            </div>
          ) : (
            <p className="empty">No meeting booked yet.</p>
          )}
          {u && (
            <div className="v2-update">
              <p className="v2-kicker">
                {u.kind === "recap" ? `Meeting recap from ${data.advisorName}` : `Weekly update from ${data.advisorName}`}
              </p>
              <p className="v2-sent">
                Sent {formatDate(u.sent_on, { weekday: "long", day: "numeric", month: "long" })}
                {u.kind === "recap" ? ", after our last meeting" : ""}
              </p>
              <div className="md">
                <Markdown>{firstPara}</Markdown>
              </div>
              {rest.length > 0 && (
                <details className="v2-more">
                  <summary>Read more</summary>
                  <div className="md">
                    <Markdown>{rest.join("\n\n")}</Markdown>
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
