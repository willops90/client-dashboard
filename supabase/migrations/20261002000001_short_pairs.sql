-- Short headlines for each growth opportunity / strategic initiative pair,
-- shown as one-line rows that expand to the full sentences.
alter table public.plan_pairs
  add column problem_short text,
  add column initiative_short text;
