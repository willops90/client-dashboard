import Markdown from "react-markdown";
import { actionStatus, formatDate, inFortnight } from "@/lib/leap";
import { dueLabel, formatInstantDate } from "@/lib/format";
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

/**
 * The quick view: what was decided last time, what's open now, and the
 * Monday email. The four LEAP sections below stay the reference point.
 */
export function ThisWeek({ data }: { data: DashboardData }) {
  const { actions, today, client, latestUpdate: u, lastRecap: r, lastMeeting } = data;
  const recent = actions.filter((a) => inFortnight(a, today, client.timezone));
  const open = recent.filter((a) => !a.done_at).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const done = recent.filter((a) => a.done_at);
  const [firstPara, ...rest] = (u?.body ?? "").split(/\n\s*\n/);
  const recapLine = r ? (r.summary ?? r.body.split(/\n/)[0]) : null;
  const meetingDate = lastMeeting
    ? formatInstantDate(lastMeeting.starts_at, client.timezone, { day: "numeric", month: "long" })
    : r
      ? formatDate(r.sent_on, { day: "numeric", month: "long" })
      : null;

  return (
    <section className="v2-week" aria-labelledby="h-week">
      <h2 id="h-week">
        This week <span className="v2-quick">Quick view</span>
      </h2>

      {r && recapLine && (
        <div className="v2-since">
          <p className="v2-kicker">{meetingDate ? `After the ${meetingDate} meeting` : "After our last meeting"}</p>
          <p className="v2-since-line">{recapLine}</p>
          <details className="v2-more">
            <summary>Full recap</summary>
            <div className="md">
              <Markdown>{r.body}</Markdown>
            </div>
          </details>
        </div>
      )}

      <p className="v2-kicker">Next steps</p>
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

      {u && (
        <div className="v2-update">
          <p className="v2-kicker">{u.kind === "recap" ? `Meeting recap from ${data.advisorName}` : `Monday email from ${data.advisorName}`}</p>
          <p className="v2-sent">Sent {formatDate(u.sent_on, { weekday: "long", day: "numeric", month: "long" })}</p>
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
    </section>
  );
}
