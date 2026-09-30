import Markdown from "react-markdown";
import { actionStatus, formatDate, inFortnight } from "@/lib/leap";
import { dueLabel, formatMeetingTime, toLocalInput, tzAbbrev } from "@/lib/format";
import type { Action, DashboardData } from "@/lib/types";
import { deleteAction, postUpdate, saveAction, setMeeting } from "@/app/admin/[slug]/actions";
import { InlineForm } from "@/components/advisor/InlineForm";
import { ActionTick } from "./ActionTick";

function sortActions(a: Action, b: Action) {
  if (!!a.done_at !== !!b.done_at) return a.done_at ? 1 : -1;
  return a.due_date.localeCompare(b.due_date);
}

export function Fortnight({ data }: { data: DashboardData }) {
  const { actions, today, client, viewer } = data;
  const advisor = viewer.kind === "advisor";
  const recent = actions.filter((a) => inFortnight(a, today, client.timezone)).sort(sortActions);
  const team = recent.filter((a) => !a.owner_is_advisor);
  const mine = recent.filter((a) => a.owner_is_advisor);
  const teamName = client.name.replace(/\s+(Co\.?|Pty\.? Ltd\.?|Ltd\.?|Inc\.?)$/i, "");

  return (
    <section className="block" aria-labelledby="h-fortnight">
      <div className="split">
        <div>
          <h2 id="h-fortnight">Due this fortnight</h2>
          <p className="lede">Tick things off as they're done. Anything overdue gets raised at the next meeting.</p>
          <h3>{teamName} team</h3>
          <ActionList data={data} items={team} empty="Nothing due for the team in the next two weeks." />
          <h3>{data.advisorName}</h3>
          <ActionList data={data} items={mine} empty={`Nothing due for ${data.advisorName} in the next two weeks.`} />
          {advisor && (
            <div className="adv">
              <h3>Add an action</h3>
              <ActionEditor data={data} />
              <AllActions data={data} />
            </div>
          )}
        </div>
        <div>
          <h2>Next meeting</h2>
          <MeetingCard data={data} />
          <h2>{data.latestUpdate?.kind === "recap" ? "Meeting recap" : "Monday update"}</h2>
          {data.latestUpdate ? (
            <div className="email">
              <p className="from">Sent {formatDate(data.latestUpdate.sent_on, { weekday: "long", day: "numeric", month: "long" })}</p>
              <div className="md">
                <Markdown>{data.latestUpdate.body}</Markdown>
              </div>
            </div>
          ) : (
            <p className="empty">The first Monday update will appear here.</p>
          )}
          {advisor && (
            <div className="adv">
              <h3>Post an update</h3>
              <InlineForm action={postUpdate} reset>
                <input type="hidden" name="slug" value={client.slug} />
                <input type="hidden" name="cycle_id" value={data.cycle.id} />
                <div className="form inline">
                  <select name="kind" defaultValue="monday" aria-label="Kind">
                    <option value="monday">Monday update</option>
                    <option value="recap">Meeting recap</option>
                  </select>
                  <input type="date" name="sent_on" defaultValue={today} aria-label="Sent on" required />
                </div>
                <label className="field">
                  <span>
                    One-line summary <small>(recaps: what we decided, shown at the top of the dashboard)</small>
                  </span>
                  <input type="text" name="summary" maxLength={200} />
                </label>
                <label className="field">
                  <span>
                    Body <small>(Markdown)</small>
                  </span>
                  <textarea name="body" rows={6} required />
                </label>
                <button className="btn sm" type="submit">
                  Post
                </button>
              </InlineForm>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ActionList({ data, items, empty }: { data: DashboardData; items: Action[]; empty: string }) {
  if (!items.length) return <p className="empty">{empty}</p>;
  const { viewer, today, client } = data;
  return (
    <ul className="actions">
      {items.map((a) => {
        const st = actionStatus(a, today);
        const canTick =
          viewer.kind === "demo" || viewer.kind === "advisor" || (viewer.kind === "member" && a.owner_member_id === viewer.memberId);
        return (
          <li key={a.id} className={a.done_at ? "done" : undefined}>
            <ActionTick
              slug={client.slug}
              actionId={a.id}
              done={!!a.done_at}
              label={a.title}
              canTick={canTick}
              demo={viewer.kind === "demo"}
            />
            <label htmlFor={`act-${a.id}`}>
              <span className="who">{a.owner_name}:</span> <span className="what">{a.title}</span>
              <span className="due">{dueLabel(a.due_date, a.done_at, today, client.timezone)}</span>
            </label>
            <span className={`tag ${st.key}`}>{st.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

function ActionEditor({ data, action }: { data: DashboardData; action?: Action }) {
  const owner = action ? (action.owner_is_advisor ? "advisor" : (action.owner_member_id ?? "")) : "advisor";
  return (
    <InlineForm action={saveAction} className="form inline" reset={!action}>
      <input type="hidden" name="slug" value={data.client.slug} />
      <input type="hidden" name="cycle_id" value={data.cycle.id} />
      {action && <input type="hidden" name="id" value={action.id} />}
      <input type="text" name="title" defaultValue={action?.title} placeholder="What needs doing" aria-label="Title" required style={{ flex: "1 1 220px" }} />
      <select name="owner" defaultValue={owner} aria-label="Owner">
        <option value="advisor">{data.advisorName}</option>
        {data.members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.display_name}
          </option>
        ))}
      </select>
      <input type="date" name="due_date" defaultValue={action?.due_date ?? data.today} aria-label="Due" required />
      <button className="btn sm" type="submit">
        {action ? "Save" : "Add"}
      </button>
    </InlineForm>
  );
}

function AllActions({ data }: { data: DashboardData }) {
  return (
    <details className="edit" style={{ marginTop: 14 }}>
      <summary>Edit all {data.actions.length} actions this cycle</summary>
      <ul className="checkin-list">
        {[...data.actions].sort(sortActions).map((a) => (
          <li key={a.id}>
            <ActionEditor data={data} action={a} />
            <div className="row-actions">
              <span className="meta">{a.done_at ? "Done" : actionStatus(a, data.today).label}</span>
              <InlineForm action={deleteAction} className="row-actions">
                <input type="hidden" name="slug" value={data.client.slug} />
                <input type="hidden" name="id" value={a.id} />
                <button className="linkish" type="submit">
                  Remove
                </button>
              </InlineForm>
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

function MeetingCard({ data }: { data: DashboardData }) {
  const m = data.nextMeeting;
  const tz = data.client.timezone;
  return (
    <>
      {m ? (
        <div className="meeting">
          <p className="when">{formatMeetingTime(m.starts_at, tz)}</p>
          <p className="sub">
            {m.duration_min} minutes, {tzAbbrev(m.starts_at, tz)}
            {m.link && (
              <>
                {" · "}
                <a href={m.link} target="_blank" rel="noreferrer">
                  Join the call
                </a>
              </>
            )}
          </p>
          {m.agenda && (
            <div className="md">
              <Markdown>{m.agenda}</Markdown>
            </div>
          )}
        </div>
      ) : (
        <p className="empty">No meeting booked yet.</p>
      )}
      {data.viewer.kind === "advisor" && (
        <div className="adv">
          <h3>{m ? "Change this meeting" : "Set the next meeting"}</h3>
          <InlineForm action={setMeeting}>
            <input type="hidden" name="slug" value={data.client.slug} />
            <input type="hidden" name="cycle_id" value={data.cycle.id} />
            <input type="hidden" name="timezone" value={tz} />
            {m && <input type="hidden" name="id" value={m.id} />}
            <div className="form inline">
              <label className="field">
                <span>
                  Starts <small>({tz} time)</small>
                </span>
                <input type="datetime-local" name="starts_local" defaultValue={m ? toLocalInput(m.starts_at, tz) : undefined} required />
              </label>
              <label className="field">
                <span>Minutes</span>
                <input type="number" name="duration_min" defaultValue={m?.duration_min ?? 60} min={15} step={15} style={{ width: 90 }} />
              </label>
            </div>
            <label className="field">
              <span>Link</span>
              <input type="url" name="link" defaultValue={m?.link ?? ""} placeholder="https://meet.google.com/…" />
            </label>
            <label className="field">
              <span>
                Agenda <small>(Markdown)</small>
              </span>
              <textarea name="agenda" defaultValue={m?.agenda ?? ""} rows={5} />
            </label>
            <div className="row-actions">
              <button className="btn sm" type="submit">
                Save meeting
              </button>
            </div>
          </InlineForm>
        </div>
      )}
    </>
  );
}
