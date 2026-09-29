-- Row Level Security. Client members read and write only their own client's
-- rows; advisors can reach everything. The UI never relies on hiding things.

-- Helper functions run as definer so policies can look up membership without
-- recursing through the RLS on client_members itself.

create or replace function public.is_advisor()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.advisors where user_id = auth.uid());
$$;

-- Members of an offboarded client lose access even before their login is disabled.
create or replace function public.is_client_member(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.client_members m
    join public.clients c on c.id = m.client_id
    where m.client_id = cid and m.user_id = auth.uid() and c.status <> 'offboarded'
  );
$$;

create or replace function public.can_access_client(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_advisor() or public.is_client_member(cid);
$$;

create or replace function public.cycle_client_id(cyid uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select client_id from public.cycles where id = cyid;
$$;

create or replace function public.can_access_cycle(cyid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_access_client(public.cycle_client_id(cyid));
$$;

create or replace function public.can_access_kpi(kid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_access_cycle((select cycle_id from public.kpis where id = kid));
$$;

-- Parses a storage folder name without throwing on junk input.
create or replace function public.try_uuid(t text)
returns uuid language plpgsql immutable as $$
begin
  return t::uuid;
exception when others then
  return null;
end;
$$;

-- Policies ------------------------------------------------------------------

alter table public.advisors enable row level security;
alter table public.clients enable row level security;
alter table public.client_members enable row level security;
alter table public.cycles enable row level security;
alter table public.kpis enable row level security;
alter table public.kpi_goals enable row level security;
alter table public.plan_pairs enable row level security;
alter table public.months enable row level security;
alter table public.weeks enable row level security;
alter table public.checkins enable row level security;
alter table public.kpi_readings enable row level security;
alter table public.actions enable row level security;
alter table public.assets enable row level security;
alter table public.scorecard_scores enable row level security;
alter table public.parked_items enable row level security;
alter table public.updates enable row level security;
alter table public.meetings enable row level security;

-- Advisors: full access to every table.
do $$
declare t text;
begin
  foreach t in array array[
    'advisors', 'clients', 'client_members', 'cycles', 'kpis', 'kpi_goals', 'plan_pairs',
    'months', 'weeks', 'checkins', 'kpi_readings', 'actions', 'assets', 'scorecard_scores',
    'parked_items', 'updates', 'meetings'
  ] loop
    execute format(
      'create policy advisor_all on public.%I for all to authenticated using (public.is_advisor()) with check (public.is_advisor())', t);
  end loop;
end;
$$;

-- Everyone signed in can see advisor names (the dashboard shows "Will").
create policy read_advisors on public.advisors for select to authenticated using (true);

create policy member_read on public.clients for select to authenticated
  using (public.is_client_member(id));
create policy member_read on public.client_members for select to authenticated
  using (public.is_client_member(client_id));
create policy member_read on public.parked_items for select to authenticated
  using (public.is_client_member(client_id));

-- Cycle-scoped tables that members can only read.
do $$
declare t text;
begin
  foreach t in array array[
    'cycles', 'plan_pairs', 'months', 'weeks', 'assets', 'scorecard_scores', 'updates', 'meetings',
    'kpis', 'actions', 'checkins'
  ] loop
    execute format(
      'create policy member_read on public.%I for select to authenticated using (public.is_client_member(public.cycle_client_id(%s)))',
      t, case when t = 'cycles' then 'id' else 'cycle_id' end);
  end loop;
end;
$$;

create policy member_read on public.kpi_goals for select to authenticated
  using (public.can_access_kpi(kpi_id));
create policy member_read on public.kpi_readings for select to authenticated
  using (public.can_access_kpi(kpi_id));

-- Members write: the weekly check-in, their KPI readings, ticking client-team
-- actions, and parking items.
create policy member_insert on public.checkins for insert to authenticated
  with check (public.is_client_member(public.cycle_client_id(cycle_id)) and submitted_by = auth.uid());
create policy member_update on public.checkins for update to authenticated
  using (public.is_client_member(public.cycle_client_id(cycle_id)))
  with check (public.is_client_member(public.cycle_client_id(cycle_id)));

create policy member_insert on public.kpi_readings for insert to authenticated
  with check (public.can_access_kpi(kpi_id) and entered_by = auth.uid() and not entered_by_advisor);
create policy member_update on public.kpi_readings for update to authenticated
  using (public.can_access_kpi(kpi_id))
  with check (public.can_access_kpi(kpi_id) and entered_by = auth.uid() and not entered_by_advisor);

create policy member_tick on public.actions for update to authenticated
  using (public.is_client_member(public.cycle_client_id(cycle_id)) and not owner_is_advisor)
  with check (public.is_client_member(public.cycle_client_id(cycle_id)) and not owner_is_advisor);

create policy member_insert on public.parked_items for insert to authenticated
  with check (public.is_client_member(client_id) and added_by = auth.uid() and picked_up_in_cycle_id is null);

-- Column guards. RLS decides which rows a member may touch; these triggers
-- decide which columns. Service role and the advisor are unrestricted.

create or replace function public.is_restricted_writer()
returns boolean language sql stable as $$
  select current_user in ('authenticated', 'anon') and not public.is_advisor();
$$;

create or replace function public.guard_action_update()
returns trigger language plpgsql as $$
begin
  if public.is_restricted_writer() and (
    new.cycle_id, new.owner_member_id, new.owner_is_advisor, new.title, new.due_date, new.created_by
  ) is distinct from (
    old.cycle_id, old.owner_member_id, old.owner_is_advisor, old.title, old.due_date, old.created_by
  ) then
    raise exception 'Client members can only mark actions done or not done';
  end if;
  return new;
end;
$$;
create trigger guard_action_update before update on public.actions
  for each row execute function public.guard_action_update();

create or replace function public.guard_checkin_write()
returns trigger language plpgsql as $$
begin
  if public.is_restricted_writer() then
    if tg_op = 'INSERT' then
      new.advisor_reviewed_at := null;
      new.advisor_feedback_link := null;
    else
      new.cycle_id := old.cycle_id;
      new.week_number := old.week_number;
      new.advisor_reviewed_at := old.advisor_reviewed_at;
      new.advisor_feedback_link := old.advisor_feedback_link;
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_checkin_write before insert or update on public.checkins
  for each row execute function public.guard_checkin_write();

create or replace function public.guard_reading_update()
returns trigger language plpgsql as $$
begin
  if public.is_restricted_writer() then
    new.kpi_id := old.kpi_id;
    new.week_number := old.week_number;
  end if;
  return new;
end;
$$;
create trigger guard_reading_update before update on public.kpi_readings
  for each row execute function public.guard_reading_update();
