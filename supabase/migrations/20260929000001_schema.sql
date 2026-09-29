-- LEAP client dashboard v1: schema.
-- Every client is a row, never code. Everything below `clients` hangs off a
-- client_id or cycle_id so Row Level Security can scope it to one client.

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Advisors are a table, not a flag, so a second advisor is one insert.
create table public.advisors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  industry text,
  timezone text not null default 'Australia/Sydney',
  status text not null default 'active' check (status in ('active', 'paused', 'offboarded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_members (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  -- A person belongs to one client, so user_id is unique across the table.
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null,
  role_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.client_members (client_id);

create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  number int not null check (number >= 1),
  start_date date not null,
  end_date date generated always as (start_date + 89) stored,
  goal_title text not null,
  goal_why text,
  status text not null default 'active' check (status in ('planned', 'active', 'review', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, number)
);

create table public.kpis (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles (id) on delete cascade,
  name text not null,
  unit text not null check (unit in ('hrs', '%', '$', 'count')),
  start_value numeric not null,
  target_value numeric not null,
  lower_is_better boolean not null default false,
  is_primary boolean not null default false,
  how_measured text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, name)
);
-- At most one primary KPI per cycle; the loader enforces exactly one.
create unique index kpis_one_primary on public.kpis (cycle_id) where is_primary;

create table public.kpi_goals (
  id uuid primary key default gen_random_uuid(),
  kpi_id uuid not null references public.kpis (id) on delete cascade,
  day int not null check (day in (30, 60, 90)),
  value numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kpi_id, day)
);

create table public.plan_pairs (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles (id) on delete cascade,
  problem text not null,
  initiative text not null,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, sort)
);

create table public.months (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles (id) on delete cascade,
  number int not null check (number between 1 and 3),
  summary text not null,
  goal_text text,
  status text not null default 'upcoming' check (status in ('upcoming', 'in_progress', 'met', 'missed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, number)
);

create table public.weeks (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles (id) on delete cascade,
  number int not null check (number between 1 and 13),
  meeting text,
  asset text not null default '',
  status text not null default 'upcoming' check (status in ('upcoming', 'this_week', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, number)
);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles (id) on delete cascade,
  week_number int not null check (week_number between 1 and 13),
  submitted_by uuid references auth.users (id) on delete set null,
  submitted_at timestamptz not null default now(),
  blockers text,
  for_next_meeting text,
  review_file_path text,
  review_link text,
  advisor_reviewed_at timestamptz,
  advisor_feedback_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, week_number)
);

create table public.kpi_readings (
  id uuid primary key default gen_random_uuid(),
  kpi_id uuid not null references public.kpis (id) on delete cascade,
  week_number int not null check (week_number between 1 and 13),
  value numeric not null,
  entered_by uuid references auth.users (id) on delete set null,
  entered_by_advisor boolean not null default false,
  checkin_id uuid references public.checkins (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kpi_id, week_number)
);

create table public.actions (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles (id) on delete cascade,
  owner_member_id uuid references public.client_members (id) on delete set null,
  owner_is_advisor boolean not null default false,
  title text not null,
  due_date date not null,
  done_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not (owner_is_advisor and owner_member_id is not null))
);
create index on public.actions (cycle_id);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles (id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'not_started' check (status in ('not_started', 'drafting', 'waiting_signoff', 'done')),
  due_week int check (due_week between 1 and 13),
  link text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, name)
);

create table public.scorecard_scores (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles (id) on delete cascade,
  drag text not null check (drag in ('owner_dependency', 'management_layer', 'reliable_numbers', 'customer_concentration', 'revenue_quality')),
  score int not null check (score between 1 and 10),
  target int check (target between 1 and 10),
  in_focus boolean not null default false,
  note text,
  scored_at text not null default 'start' check (scored_at in ('start', 'day_90')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, drag, scored_at)
);

-- Parked items belong to the client, not the cycle, so they carry forward.
create table public.parked_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  text text not null,
  category text,
  added_by uuid references auth.users (id) on delete set null,
  picked_up_in_cycle_id uuid references public.cycles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.parked_items (client_id);

create table public.updates (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles (id) on delete cascade,
  kind text not null check (kind in ('monday', 'recap')),
  sent_on date not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.updates (cycle_id, sent_on desc);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles (id) on delete cascade,
  starts_at timestamptz not null,
  duration_min int not null default 60 check (duration_min > 0),
  agenda text,
  link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.meetings (cycle_id, starts_at);

do $$
declare t text;
begin
  foreach t in array array[
    'advisors', 'clients', 'client_members', 'cycles', 'kpis', 'kpi_goals', 'plan_pairs',
    'months', 'weeks', 'checkins', 'kpi_readings', 'actions', 'assets', 'scorecard_scores',
    'parked_items', 'updates', 'meetings'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;
