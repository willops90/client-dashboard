"use server";

import { revalidatePath } from "next/cache";
import { canEditCheckin, checkinWindow } from "@/lib/leap";
import { currentCycle, getViewer } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export type FormState = { ok?: string; error?: string };

function refresh(slug: string) {
  revalidatePath(`/c/${slug}`);
  revalidatePath(`/admin/${slug}`);
  revalidatePath("/admin");
}

/** Tick or untick an action on the dashboard. Members tick their own; the advisor any. */
export async function setActionDone(slug: string, actionId: string, done: boolean): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer) return { error: "You're signed out. Sign in again." };
  const supabase = await createClient();

  let query = supabase
    .from("actions")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", actionId);
  if (viewer.kind === "member") query = query.eq("owner_member_id", viewer.memberId);
  const { data, error } = await query.select("id");
  if (error || !data?.length) return { error: "Couldn't update that action." };
  refresh(slug);
  return { ok: "Saved" };
}

export async function addParkedItem(slug: string, _prev: FormState, form: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer) return { error: "You're signed out. Sign in again." };
  const text = String(form.get("text") ?? "").trim();
  const category = String(form.get("category") ?? "").trim();
  if (!text) return { error: "Write the idea or issue first." };
  if (text.length > 500) return { error: "Keep it under 500 characters." };

  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id").eq("slug", slug).maybeSingle();
  if (!client) return { error: "Couldn't find this dashboard." };
  const { error } = await supabase
    .from("parked_items")
    .insert({ client_id: client.id, text, category: category || null, added_by: viewer.userId });
  if (error) return { error: "Couldn't save that. Try again." };
  refresh(slug);
  return { ok: "Parked for a future cycle." };
}

export type CheckinInput = {
  slug: string;
  week: number;
  readings: Record<string, string>;
  actionIds: string[];
  blockers: string;
  forNextMeeting: string;
  reviewFilePath: string | null;
  removeFile: boolean;
  reviewLink: string;
};

export async function submitCheckin(input: CheckinInput): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer) return { error: "You're signed out. Sign in again, then resubmit." };
  if (viewer.kind !== "member") return { error: "Advisors enter readings from the advisor view." };

  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id, timezone").eq("slug", input.slug).maybeSingle();
  if (!client) return { error: "Couldn't find this dashboard." };
  const cycle = await currentCycle(supabase, client.id);
  if (!cycle) return { error: "There's no active cycle." };

  const window = checkinWindow(cycle.start_date, client.timezone);
  if (!canEditCheckin(window, input.week)) {
    return { error: `The check-in for week ${input.week} is closed. Check-ins open Thursday and close at the end of Sunday.` };
  }

  const { data: kpis } = await supabase.from("kpis").select("id, name").eq("cycle_id", cycle.id);
  const values: { kpi_id: string; value: number }[] = [];
  for (const k of kpis ?? []) {
    const raw = (input.readings[k.id] ?? "").trim().replace(/[,$%\s]/g, "");
    const value = Number(raw);
    if (raw === "" || !Number.isFinite(value)) return { error: `Enter a number for "${k.name}".` };
    values.push({ kpi_id: k.id, value });
  }

  const link = input.reviewLink.trim();
  if (link && !/^https?:\/\/\S+$/i.test(link)) return { error: "The review link needs to start with https://" };
  const folder = `${client.id}/${cycle.id}/week-${input.week}/`;
  if (input.reviewFilePath && !input.reviewFilePath.startsWith(folder)) return { error: "That upload didn't go to the right place. Try again." };

  const { data: checkin, error: checkinError } = await supabase
    .from("checkins")
    .upsert(
      {
        cycle_id: cycle.id,
        week_number: input.week,
        submitted_by: viewer.userId,
        submitted_at: new Date().toISOString(),
        blockers: input.blockers.trim() || null,
        for_next_meeting: input.forNextMeeting.trim() || null,
        review_link: link || null,
        ...(input.reviewFilePath ? { review_file_path: input.reviewFilePath } : input.removeFile ? { review_file_path: null } : {}),
      },
      { onConflict: "cycle_id,week_number" },
    )
    .select("id")
    .single();
  if (checkinError || !checkin) return { error: "Couldn't save the check-in. Try again." };

  const { error: readingError } = await supabase.from("kpi_readings").upsert(
    values.map((v) => ({
      ...v,
      week_number: input.week,
      entered_by: viewer.userId,
      entered_by_advisor: false,
      checkin_id: checkin.id,
    })),
    { onConflict: "kpi_id,week_number" },
  );
  if (readingError) return { error: "The check-in saved but the numbers didn't. Try again." };

  if (input.actionIds.length) {
    await supabase
      .from("actions")
      .update({ done_at: new Date().toISOString() })
      .in("id", input.actionIds)
      .eq("cycle_id", cycle.id)
      .eq("owner_is_advisor", false)
      .is("done_at", null);
  }

  refresh(input.slug);
  return { ok: `Check-in for week ${input.week} saved.` };
}
