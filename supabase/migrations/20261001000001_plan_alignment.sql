-- LEAP plan slide alignment.
-- months: the weekly breakdown groups weeks by month, each with a focus line.
-- cycles: pass/fail milestones shown in the KPIs band beside the numeric KPIs
-- (e.g. "Two weeks with Dave away").

alter table public.months
  add column focus text,
  add column first_week int check (first_week between 1 and 13),
  add column last_week int check (last_week between 1 and 13),
  add constraint months_week_range check (first_week is null or last_week is null or first_week <= last_week);

alter table public.cycles
  add column milestones jsonb;
