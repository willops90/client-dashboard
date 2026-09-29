"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate, formatValue } from "@/lib/leap";
import type { Checkin, Kpi } from "@/lib/types";
import { createClient } from "@/lib/supabase/browser";
import { submitCheckin } from "../actions";

const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.doc,.docx";

type Props = {
  slug: string;
  week: number;
  clientId: string;
  cycleId: string;
  advisorName: string;
  kpis: { id: string; name: string; unit: Kpi["unit"]; target: number; last: { week_number: number; value: number } | null; current: number | null }[];
  actions: { id: string; title: string; owner: string; due: string }[];
  existing: Checkin | null;
};

export function CheckinForm({ slug, week, clientId, cycleId, advisorName, kpis, actions, existing }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    let reviewFilePath: string | null = null;
    setPending(true);
    try {
      if (file instanceof File && file.size > 0) {
        if (file.size > MAX_BYTES) throw new Error("That file is over 20 MB. Share a link to it instead.");
        const safeName = file.name.replace(/[^\w.-]+/g, "-").slice(-80);
        reviewFilePath = `${clientId}/${cycleId}/week-${week}/${Date.now()}-${safeName}`;
        // Straight to private Storage under the member's own session; RLS
        // only allows their client's folder.
        const { error: upErr } = await createClient()
          .storage.from("checkin-uploads")
          .upload(reviewFilePath, file, { contentType: file.type || undefined, upsert: false });
        if (upErr) throw new Error(`The upload didn't work (${upErr.message}). Try a PDF, image or Word file, or share a link.`);
      }
      const result = await submitCheckin({
        slug,
        week,
        readings: Object.fromEntries(kpis.map((k) => [k.id, String(form.get(`kpi-${k.id}`) ?? "")])),
        actionIds: form.getAll("action").map(String),
        blockers: String(form.get("blockers") ?? ""),
        forNextMeeting: String(form.get("for_next_meeting") ?? ""),
        reviewFilePath,
        removeFile: form.get("remove_file") === "on",
        reviewLink: String(form.get("review_link") ?? ""),
      });
      if (result.error) throw new Error(result.error);
      setSaved(`${result.ok} ${advisorName} reviews these by Monday.`);
      router.refresh();
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (saved) {
    return (
      <div className="form">
        <div className="notice" role="status">
          <p>
            <strong>{saved}</strong>
          </p>
        </div>
        <p>
          <Link href={`/c/${slug}`}>Back to the dashboard</Link> · <button className="linkish" onClick={() => setSaved(null)}>Edit this check-in</button>
        </p>
      </div>
    );
  }

  const existingFile = existing?.review_file_path?.split("/").pop()?.replace(/^\d+-/, "");

  return (
    <form className="form" onSubmit={onSubmit} noValidate={false}>
      {existing && (
        <p className="notice warn">
          You already sent this week's check-in. Saving again updates it.
        </p>
      )}

      <fieldset className="step">
        <legend>1. This week's numbers</legend>
        {kpis.map((k) => (
          <label key={k.id} className="kpi-input" htmlFor={`kpi-${k.id}`}>
            <span style={{ fontWeight: 600 }}>{k.name}</span>
            <span className="hint">
              {k.last ? `Week ${k.last.week_number}: ${formatValue(k.last.value, k.unit)}` : "First reading"} · Target {formatValue(k.target, k.unit)}
            </span>
            <span className="row">
              {k.unit === "$" && <span className="unit">$</span>}
              <input
                id={`kpi-${k.id}`}
                name={`kpi-${k.id}`}
                type="text"
                inputMode="decimal"
                pattern="[0-9.,\-]*"
                autoComplete="off"
                required
                defaultValue={k.current ?? ""}
              />
              {k.unit !== "$" && k.unit !== "count" && <span className="unit">{k.unit}</span>}
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="step">
        <legend>2. Your actions</legend>
        <p className="lede">Tick anything that's done. Optional.</p>
        {actions.length ? (
          <ul className="checks">
            {actions.map((a) => (
              <li key={a.id}>
                <label>
                  <input type="checkbox" name="action" value={a.id} />
                  <span>
                    <b>{a.owner}:</b> {a.title}
                    <span className="due">Due {formatDate(a.due, { weekday: "long", day: "numeric", month: "long" })}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">No open actions for the team right now.</p>
        )}
      </fieldset>

      <fieldset className="step">
        <legend>3. What got in the way?</legend>
        <p className="lede">Optional.</p>
        <textarea name="blockers" rows={3} defaultValue={existing?.blockers ?? ""} aria-label="What got in the way?" />
      </fieldset>

      <fieldset className="step">
        <legend>4. Anything for our next meeting?</legend>
        <p className="lede">Optional.</p>
        <textarea name="for_next_meeting" rows={3} defaultValue={existing?.for_next_meeting ?? ""} aria-label="Anything for our next meeting?" />
      </fieldset>

      <fieldset className="step">
        <legend>5. One thing for {advisorName} to review</legend>
        <p className="lede">A draft, a document, a photo of a whiteboard. PDF, image or Word, up to 20 MB. Optional.</p>
        {existingFile && (
          <p className="hint">
            Already uploaded: <b>{existingFile}</b>.{" "}
            <label>
              <input type="checkbox" name="remove_file" /> Remove it
            </label>
          </p>
        )}
        <label className="field">
          <span className="sr-only">File</span>
          <input type="file" name="file" accept={ACCEPT} />
        </label>
        <p className="or">or share a link</p>
        <label className="field">
          <span className="sr-only">Link</span>
          <input type="url" name="review_link" placeholder="https://docs.google.com/…" defaultValue={existing?.review_link ?? ""} />
        </label>
      </fieldset>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Saving…" : existing ? "Update check-in" : "Send check-in"}
      </button>
    </form>
  );
}
