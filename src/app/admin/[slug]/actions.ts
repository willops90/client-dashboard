"use server";

import { revalidatePath } from "next/cache";
import { zonedTimeToUtc } from "@/lib/leap";
import { getViewer } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/app/c/[slug]/actions";

// Light, inline editing for the advisor. Structure (goal, KPIs, plan pairs,
// scorecard) only changes through the JSON loader. RLS also requires the
// advisor role for every write here; the check below just gives a clear error.

async function advisorClient() {
  const viewer = await getViewer();
  if (viewer?.kind !== "advisor") return null;
  return { supabase: await createClient(), viewer };
}

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function done(slug: string, ok: string): FormState {
  revalidatePath(`/admin/${slug}`);
  revalidatePath(`/c/${slug}`);
  revalidatePath("/admin");
  return { ok };
}

const STATUSES = {
  assets: ["not_started", "drafting", "waiting_signoff", "done"],
  months: ["upcoming", "in_progress", "met", "missed"],
  weeks: ["upcoming", "this_week", "done"],
} as const;

export async function setStatus(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await advisorClient();
  if (!ctx) return { error: "Advisor access only." };
  const table = str(form, "table") as keyof typeof STATUSES;
  const status = str(form, "status");
  if (!(table in STATUSES) || !(STATUSES[table] as readonly string[]).includes(status)) return { error: "Unknown status." };
  const { error } = await ctx.supabase.from(table).update({ status }).eq("id", str(form, "id"));
  return error ? { error: error.message } : done(str(form, "slug"), "Saved");
}

export async function saveAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await advisorClient();
  if (!ctx) return { error: "Advisor access only." };
  const id = str(form, "id");
  const title = str(form, "title");
  const due = str(form, "due_date");
  const owner = str(form, "owner");
  if (!title) return { error: "Give the action a title." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return { error: "Pick a due date." };
  const fields = {
    title,
    due_date: due,
    owner_is_advisor: owner === "advisor",
    owner_member_id: owner === "advisor" || owner === "" ? null : owner,
  };
  const { error } = id
    ? await ctx.supabase.from("actions").update(fields).eq("id", id)
    : await ctx.supabase.from("actions").insert({ ...fields, cycle_id: str(form, "cycle_id"), created_by: ctx.viewer.userId });
  return error ? { error: error.message } : done(str(form, "slug"), id ? "Action updated." : "Action added.");
}

export async function deleteAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await advisorClient();
  if (!ctx) return { error: "Advisor access only." };
  const { error } = await ctx.supabase.from("actions").delete().eq("id", str(form, "id"));
  return error ? { error: error.message } : done(str(form, "slug"), "Action removed.");
}

export async function postUpdate(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await advisorClient();
  if (!ctx) return { error: "Advisor access only." };
  const kind = str(form, "kind") === "recap" ? "recap" : "monday";
  const body = str(form, "body");
  const sentOn = str(form, "sent_on");
  if (!body) return { error: "Write the update first." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sentOn)) return { error: "Pick the date it was sent." };
  const { error } = await ctx.supabase.from("updates").insert({ cycle_id: str(form, "cycle_id"), kind, sent_on: sentOn, body });
  return error ? { error: error.message } : done(str(form, "slug"), kind === "monday" ? "Monday update posted." : "Recap posted.");
}

export async function setMeeting(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await advisorClient();
  if (!ctx) return { error: "Advisor access only." };
  const local = str(form, "starts_local");
  const tz = str(form, "timezone");
  const duration = Number(str(form, "duration_min") || 60);
  const link = str(form, "link");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(local)) return { error: "Pick a date and time." };
  if (!Number.isInteger(duration) || duration <= 0) return { error: "Duration must be whole minutes." };
  if (link && !/^https?:\/\//i.test(link)) return { error: "The meeting link needs to start with https://" };
  const row = {
    cycle_id: str(form, "cycle_id"),
    starts_at: zonedTimeToUtc(local, tz).toISOString(),
    duration_min: duration,
    agenda: str(form, "agenda") || null,
    link: link || null,
  };
  const id = str(form, "id");
  const { error } = id
    ? await ctx.supabase.from("meetings").update(row).eq("id", id)
    : await ctx.supabase.from("meetings").insert(row);
  return error ? { error: error.message } : done(str(form, "slug"), "Meeting saved.");
}

export async function reviewCheckin(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await advisorClient();
  if (!ctx) return { error: "Advisor access only." };
  const link = str(form, "feedback_link");
  if (link && !/^https?:\/\//i.test(link)) return { error: "The feedback link needs to start with https://" };
  const { error } = await ctx.supabase
    .from("checkins")
    .update({ advisor_reviewed_at: new Date().toISOString(), advisor_feedback_link: link || null })
    .eq("id", str(form, "id"));
  return error ? { error: error.message } : done(str(form, "slug"), "Marked reviewed.");
}

export async function enterReading(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await advisorClient();
  if (!ctx) return { error: "Advisor access only." };
  const week = Number(str(form, "week"));
  const value = Number(str(form, "value").replace(/[,$%\s]/g, ""));
  if (!Number.isInteger(week) || week < 1 || week > 13) return { error: "Week must be 1 to 13." };
  if (str(form, "value") === "" || !Number.isFinite(value)) return { error: "Enter a number." };
  const { error } = await ctx.supabase.from("kpi_readings").upsert(
    { kpi_id: str(form, "kpi_id"), week_number: week, value, entered_by: ctx.viewer.userId, entered_by_advisor: true },
    { onConflict: "kpi_id,week_number" },
  );
  return error ? { error: error.message } : done(str(form, "slug"), `Week ${week} reading saved (flagged as advisor-entered).`);
}
