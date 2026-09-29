-- Exit framing and richer assets.
-- clients: the exit goal and an indicative multi-cycle roadmap.
-- cycles: a short goal for the hero and one line of context under the chart.
-- assets: what each is built on, and a structured preview a client can open.
-- parked_items: which future cycle an item is pencilled in for.

alter table public.clients
  add column exit_goal text,
  add column exit_cycles_estimate int check (exit_cycles_estimate >= 1),
  add column exit_roadmap jsonb;

alter table public.cycles
  add column goal_short text,
  add column goal_note text;

alter table public.assets
  add column built_on text,
  add column preview jsonb;

alter table public.assets drop constraint assets_status_check;
alter table public.assets add constraint assets_status_check
  check (status in ('not_started', 'in_progress', 'drafting', 'waiting_signoff', 'done'));

alter table public.parked_items
  add column planned_cycle int check (planned_cycle >= 1);
