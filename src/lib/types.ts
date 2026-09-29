import type { CheckinState, CheckinWindow } from "./leap";
import type { AssetPreview } from "./plan";

export type ExitRoadmapItem = { cycle: number; focus: string; dates?: string };

export type Client = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  industry: string | null;
  status: string;
  exit_goal: string | null;
  exit_cycles_estimate: number | null;
  exit_roadmap: ExitRoadmapItem[] | null;
};

export type Cycle = {
  id: string;
  number: number;
  start_date: string;
  end_date: string;
  goal_title: string;
  goal_short: string | null;
  goal_note: string | null;
  goal_why: string | null;
  status: string;
};

export type Member = { id: string; user_id: string; display_name: string; role_label: string | null };

export type KpiReading = { week_number: number; value: number; entered_by_advisor: boolean };

export type Kpi = {
  id: string;
  name: string;
  unit: "hrs" | "%" | "$" | "count";
  start_value: number;
  target_value: number;
  lower_is_better: boolean;
  is_primary: boolean;
  how_measured: string | null;
  goals: { day: number; value: number }[];
  readings: KpiReading[];
};

export type PlanPair = { id: string; problem: string; initiative: string };

export type MonthStatus = "upcoming" | "in_progress" | "met" | "missed";
export type Month = { id: string; number: number; summary: string; goal_text: string | null; status: MonthStatus };

export type WeekStatus = "upcoming" | "this_week" | "done";
export type Week = { id: string; number: number; meeting: string | null; asset: string; status: WeekStatus };

export type Action = {
  id: string;
  title: string;
  due_date: string;
  done_at: string | null;
  owner_is_advisor: boolean;
  owner_member_id: string | null;
  owner_name: string;
};

export type AssetStatus = "not_started" | "in_progress" | "drafting" | "waiting_signoff" | "done";
export type Asset = {
  id: string;
  name: string;
  description: string | null;
  status: AssetStatus;
  due_week: number | null;
  link: string | null;
  built_on: string | null;
  preview: AssetPreview | null;
};

export type Drag = "owner_dependency" | "management_layer" | "reliable_numbers" | "customer_concentration" | "revenue_quality";
export type Score = { id: string; drag: Drag; score: number; target: number | null; in_focus: boolean; note: string | null };

export type Parked = { id: string; text: string; category: string | null; planned_cycle: number | null };

export type Update = { id: string; kind: "monday" | "recap"; sent_on: string; body: string };

export type Meeting = { id: string; starts_at: string; duration_min: number; agenda: string | null; link: string | null };

export type Checkin = {
  id: string;
  week_number: number;
  submitted_by: string | null;
  submitted_by_name: string | null;
  submitted_at: string;
  blockers: string | null;
  for_next_meeting: string | null;
  review_file_path: string | null;
  review_link: string | null;
  advisor_reviewed_at: string | null;
  advisor_feedback_link: string | null;
};

export type Viewer =
  | { kind: "member"; userId: string; memberId: string; name: string }
  | { kind: "advisor"; userId: string; name: string }
  | { kind: "demo" };

export type DashboardData = {
  client: Client;
  cycle: Cycle;
  advisorName: string;
  members: Member[];
  kpis: Kpi[];
  planPairs: PlanPair[];
  months: Month[];
  weeks: Week[];
  actions: Action[];
  assets: Asset[];
  scorecard: Score[];
  parked: Parked[];
  latestUpdate: Update | null;
  nextMeeting: Meeting | null;
  checkins: Checkin[];
  // Derived from the client's clock
  today: string;
  day: number;
  currentWeek: number;
  window: CheckinWindow;
  checkinState: CheckinState;
  viewer: Viewer;
};

export const DRAG_LABELS: Record<Drag, string> = {
  owner_dependency: "Owner dependency",
  management_layer: "Management layer",
  reliable_numbers: "Numbers a buyer can rely on",
  customer_concentration: "Customer concentration",
  revenue_quality: "Revenue quality",
};

export const ASSET_STATUS: Record<AssetStatus, { label: string; key: "good" | "warn" | "idle" }> = {
  not_started: { label: "Not started", key: "idle" },
  in_progress: { label: "In progress", key: "warn" },
  drafting: { label: "Drafting", key: "warn" },
  waiting_signoff: { label: "Waiting on sign-off", key: "warn" },
  done: { label: "Done", key: "good" },
};

export const MONTH_STATUS: Record<MonthStatus, { label: string; key: "good" | "warn" | "bad" | "idle" }> = {
  upcoming: { label: "Upcoming", key: "idle" },
  in_progress: { label: "In progress", key: "warn" },
  met: { label: "Met", key: "good" },
  missed: { label: "Missed", key: "bad" },
};

export const WEEK_STATUS: Record<WeekStatus, { label: string; key: "good" | "warn" | "idle" }> = {
  upcoming: { label: "Upcoming", key: "idle" },
  this_week: { label: "This week", key: "warn" },
  done: { label: "Done", key: "good" },
};
