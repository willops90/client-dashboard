-- L · Focus: the client's own words from the sales call ("As you put it: …").
alter table public.cycles add column anchor_quote text;

-- A one-line summary on meeting recaps, shown as "After the <date> meeting: …"
-- so nobody acts on a step that was superseded in the last meeting.
alter table public.updates add column summary text;
