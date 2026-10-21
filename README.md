# OAU Transit

Local MVP implementation based on `Smart School Transport Manager - PRD and System Design.md`.

## Run

Node.js 22+ is recommended.

```sh
npm install
npm run dev
```

Open the URL printed by Vite. Without Supabase environment variables, the app runs a **clearly labelled, browser-local demo**. Use **Preview as** to switch between operator, student and driver. Demo reports simulate location and do not contact anyone. Sample coordinates are illustrative, not verified pickup points. Sample buses become stale after two minutes; **Reset demo** restores fresh sample data. Start a demo driver shift to keep Shuttle 01 online. The demo does not simulate physical arrival/departure.

```sh
npm test
npm run build
```

## Connect a Supabase project

1. Create a Supabase project. Apply `supabase/migrations/001_transport.sql` in its SQL editor. Enable Cron and apply `002_maintenance.sql`. The latter schedules state refresh every ten seconds and daily retention cleanup. Apply each migration only once.
2. Confirm the actual student email domain with OAU. Set it in SQL; the shipped value intentionally blocks student signup:

```sql
update public.settings set value = to_jsonb('CONFIRMED_DOMAIN'::text)
where key = 'allowed_email_domain';
```

3. Before inviting any staff member through Authentication, pre-authorize their exact email:

```sql
insert into private.staff_invites(email, role)
values ('driver@example.com', 'driver'), ('operator@example.com', 'operator');
```

The Auth insert trigger creates profiles using this allowlist or the university domain. Roles never come from browser-supplied metadata. Existing Auth accounts created before the migration need administrator-created profile rows. Configure Supabase Auth email rate limits and a production email sender before a pilot. This database trigger blocks unauthorized profile creation; an Auth Before User Created hook may also be added for friendlier signup errors.

4. Insert verified stops (`name, lat, lng, area`) and buses (`name, driver_id`) using the database dashboard. `driver_id` is the invited driver's Auth UUID. No real-world stops or driver identities are inserted by migrations.
5. Copy `.env.example` to `.env`; supply the project URL and **publishable key** (or legacy anon key). Never use a secret/service-role key in Vite variables. Restart Vite.
6. Configure Supabase Auth Site URL and allowed redirect URLs to include the local origin printed by Vite, and later the production HTTPS origin.

With both variables configured, demo switching disappears and the signed-in profile determines access. Students receive aggregate stop status only, not driver locations, identities, raw report counts or dispatch records. Operators and assigned drivers receive realtime database notifications; snapshots also refresh every five seconds for queue changes and time-based state. Mutations run through role-checked database functions; tables deny direct client writes.

## Architecture and portability

- `src/domain.js`: provider-independent queue/distance/availability helpers.
- `src/data/index.js`: adapter selection. There is no automatic fallback from a failed live backend to demo data.
- `src/data/demo.js`: local sample-data adapter.
- `src/data/supabase.js`: the Supabase SDK and RPC calls are isolated here; authentication UI uses the exported client.
- `src/App.jsx`, `src/Map.jsx`, `src/styles.css`: React views and Leaflet map.
- `supabase/migrations`: relational schema, constraints, RLS, validated RPCs and scheduled maintenance.

The tables and business rules use PostgreSQL. Moving to another PostgreSQL host preserves most SQL; replace the `auth.uid()`/Auth trigger boundary, realtime publication, cron scheduling and adapter. Keeping Supabase but self-hosting requires less application change. The current code avoids storing optional GPS history.

## Decisions made to reconcile the PRD

- A new queue report replaces the same student's previous report for that stop; a 15-second global cooldown prevents rapid spam. Each student contributes at most one current opinion per stop.
- `departed` is the terminal successful dispatch state; no separate `closed` enum.
- Reassignment means cancelling with a reason, then creating a new dispatch. Both records stay in history.
- Arrival: accepted assigned bus only, within 50 m, at most 1 m/s when available, movement at most 10 m between pings, sustained for 30 seconds. A gap above 25 seconds resets the candidate. Departure uses 100 m. Physical GPS behavior still requires field tests.
- Queue outcomes are evaluated only with three fresh post-arrival reporters. Lack of fresh evidence is not treated as an empty queue.
- No automatic change to driver availability after acceptance or departure; active-dispatch uniqueness independently prevents double assignment.

## Before a real pilot

- Apply and test the migrations in a disposable Supabase project, including permissions as each role. An SQL smoke harness is provided under `tests` when available; it is not a substitute for hosted Auth/realtime checks.
- Verify the university domain, stop coordinates and staff roster.
- Test actual driver phones: location permission, screen wake lock, foreground/background, signal loss, a drive-by, dwell and departure. GPS from a browser can be spoofed; distance checking is not proof of presence.
- Obtain driver consent and transport office approval. Location sharing stops when the driver ends the shift; closing the page stops new pings and makes the bus offline after the timeout.
- Check tile-provider usage requirements and backend quotas against actual load. The map uses OpenStreetMap tiles with attribution and does not prefetch them.
- Set up database backups/exports and uptime monitoring. These external services are not provisioned by this code.

## Current boundaries

This is a first implementation, not a field-validated deployment. Driver/operator accounts, hosted database, email delivery and hosting require project configuration. History currently loads all dispatch records and is filtered in the browser, suitable for a small pilot; add paginated history before larger usage. Settings exist in the database; the initial UI uses the PRD's default 10-second GPS cadence and 120-second offline display threshold. If those values change, update UI constants too. No admin UI, fares, payments, guaranteed ETAs, background tracking or automatic dispatch.
