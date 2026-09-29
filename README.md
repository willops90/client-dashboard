# LEAP client dashboard

A private dashboard each Value Build client uses for a 90-day LEAP cycle: the
one goal, the plan, KPI progress, who owes what, and the assets being built.
Clients update it through a two-minute Friday check-in.

It is **one template**. A new client is a JSON file and one command, never new code.

- **Stack:** Next.js 16 (App Router, TypeScript) on Vercel; Supabase (Postgres, magic-link auth, Storage, RLS) in Sydney.
- **Demo:** `/demo` renders the made-up Northside Climate Co. through the same components, with no database, and is always on day 44.

## Pages

| Path | Who | What |
| --- | --- | --- |
| `/c/[slug]` | Client members | The dashboard: KPI hero and chart, due this fortnight, next meeting, Monday update, plan, assets, week by week, scorecard, parked items |
| `/c/[slug]/checkin` | Client members | Friday check-in: numbers, actions, blockers, agenda items, one upload or link. Open Thursday to Sunday, client time |
| `/admin` | Advisor | All active clients, with anything needing attention at the top |
| `/admin/[slug]` | Advisor | The dashboard plus inline editing, check-in review and on-behalf KPI entry |
| `/demo` | Anyone | Northside demo with made-up data |

## Where things live

```
supabase/migrations/   schema, RLS policies, private storage bucket
src/lib/leap.ts        day/week/timezone maths, KPI status, check-in window (unit tested)
src/lib/plan.ts        plan-file schema and validation (unit tested)
src/lib/data.ts        loads a dashboard as the signed-in user, so RLS applies
src/styles/tokens.css  the palette, in one file, to swap for brand colours later
plans/                 plan files; only the made-up Northside example is committed
scripts/               load-plan, add-advisor, seed-demo, offboard
tests/rls.test.ts      proves a member of one client can't read or write another's rows
```

## Setting up (once)

1. **Supabase project** in region *Sydney (ap-southeast-2)*.
2. **Apply the migrations**, either by pasting each file in `supabase/migrations/`
   into the SQL editor in order, or with the Supabase CLI:
   ```
   npx supabase init   # first time only, creates supabase/config.toml
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
3. **Auth settings** (Authentication → Sign In / Providers, and URL Configuration):
   - Email provider on. **Allow new users to sign up: off.** Only invited people get in.
   - Site URL: the app's URL. Add `http://localhost:3000/**` and the production URL to Redirect URLs.
   - Email templates: in both **Magic Link** and **Invite user**, point the link at the confirm route:
     ```
     <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next=/">Sign in</a>
     ```
     (Use `type=invite` in the invite template if `{{ .Type }}` isn't available there.)
   - Set up custom SMTP before real clients use it. Supabase's built-in sender is rate limited.
4. **Environment:** copy `.env.example` to `.env.local` and fill it in.
5. **Make yourself the advisor:**
   ```
   npm install
   npm run add-advisor -- will@owneroptionaladvisory.com "Will"
   ```

## Onboarding a client (about 20 minutes)

After the planning workshop, write `plans/<client>-cycle-<n>.json` (copy the
Northside file for the shape), then:

```
npm run load-plan -- ./plans/acme-cycle-1.json --dry-run   # check it
npm run load-plan -- ./plans/acme-cycle-1.json             # load it and email invites
```

The loader validates the file and says exactly what's wrong if anything is
missing. Running it again for the same cycle updates the plan in place. It
never overwrites day-to-day state: asset, month and week statuses, ticked
actions, readings and check-ins. KPIs or assets that are in the database but
no longer in the file are left alone and listed as warnings.

Action owners are a member's `name`, or the advisor's display name (or `"advisor"`).
Optional `parked` items in the file are added to the client's parked list.

Real client plan files are gitignored. Keep them somewhere private.

## Local development

```
npm install
npm run dev              # http://localhost:3000/demo works with no database
npm test                 # status logic, timezones, plan validation
npm run lint             # typecheck
```

With a Supabase project in `.env.local`, load the example and fill in six weeks
of made-up activity so the real pages look like the demo:

```
npm run load-plan -- ./plans/northside-cycle-1.json --no-invite
npm run seed-demo
```

### RLS tests

`tests/rls.test.ts` needs a Postgres it can create a throwaway database on. It
applies stand-ins for Supabase's `auth` and `storage` schemas, runs every
migration, and checks that members of one client see nothing of another's,
can't write outside their client, can only tick actions (not rewrite them),
can't mark their own check-in reviewed, and lose access when the client is
offboarded.

```
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres npm run test:rls
```

## Rules the app follows

- **Day and week always use the client's timezone.** Day 1 is the start date; week *n* is days 7n−6 to 7n; the cycle ends on start + 89.
- **Target path** on day *d*: `start + (target − start) × d / 90`.
- **KPI status** compares the latest reading (week *n* covers day 7n) with the path: on track within 4% of the KPI's range (|target − start|), slightly behind up to 12%, off track beyond.
- **Check-ins** open Thursday and can be edited until the end of Sunday. The week is the cycle week containing that Friday. One per week; resubmitting edits it. Missing from Saturday 9am.
- **Overdue:** due before today, client time, and not done.
- **Members** can tick client-team actions, submit check-ins and readings, and park items. Everything else is read-only to them, enforced in the database.

## Deploying

A separate Vercel project from the marketing site, importing this repo (the
app is at the top level, so no Root Directory setting). Environment variables: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`. **Never** add the
service role key to Vercel; only the command-line scripts use it. Then add the
subdomain (e.g. `app.owneroptionaladvisory.com`) under Domains.

## Offboarding

```
npm run offboard -- acme              # export data.json and uploads to exports/acme-<date>/
npm run offboard -- acme --confirm    # export, then disable logins and mark offboarded
```

## Still open

- Subdomain and brand colours (swap `src/styles/tokens.css`).
- Check-in weekday for clients whose week doesn't end on Friday (the rule lives in `checkinWindow` in `src/lib/leap.ts`).
- The advisor sees meeting times in the client's timezone. Showing London time alongside is a small change in `src/lib/format.ts` once Will moves.
