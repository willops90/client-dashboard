-- Laura's LEAP plan lists growth opportunities and strategic initiatives as two
-- separate lists (counts can differ), not one-to-one pairs. plan_pairs stays
-- for plans loaded before this change.
alter table public.cycles
  add column growth_opportunities text[],
  add column strategic_initiatives text[];
