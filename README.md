# OAU Transit

Campus queue reporting, driver location sharing and operator dispatch.

## Run locally

Use Node.js 22 or newer.

```sh
npm install
npm run dev
```

Without Supabase credentials, the app runs in demo mode. Use **Preview as** to switch roles. Demo locations and vehicles are samples. **Reset demo** refreshes their signals.

```sh
npm test
npm run build
```

## Supabase setup

Run these files in SQL Editor, in order:

1. `supabase/migrations/001_transport.sql`
2. Enable Cron, then run `supabase/migrations/002_maintenance.sql`.
3. `supabase/migrations/003_fleet_registration.sql`
4. `supabase/migrations/004_student_access.sql`
5. `supabase/migrations/005_campus_stops.sql`
6. `supabase/migrations/006_driver_assignment.sql`

Migration 004 restricts students to verified `@student.oauife.edu.ng` emails, including existing student accounts. Authorized staff keep access. The domain setting is:

```sql
update public.settings set value = to_jsonb('student.oauife.edu.ng'::text)
where key = 'allowed_email_domain';
```

Authorize staff emails before their first sign-in:

```sql
insert into private.staff_invites(email, role)
values ('driver@example.com', 'driver'), ('operator@example.com', 'operator');
```

Accounts created before the migration need a profile added by an administrator. Configure SMTP for sign-in emails.

Add verified stops in Supabase with `name`, `lat`, `lng` and `area`. Operators can register buses and tricycles from **Vehicle fleet**. After migration 006, select a driver on the vehicle card and save the assignment. Drivers appear after authorization and their first sign-in. To transfer a driver, end the shift, complete or cancel dispatches, remove the old assignment, then assign the new vehicle. New assignments clear previous GPS coordinates and remain off duty until the driver starts a shift.

Copy `.env.example` to `.env` for local development. Set these variables locally and in Vercel:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Use a publishable or anon key. Never put a service-role key in frontend variables. Set the production Site URL and redirect URLs in Supabase Auth. Redeploy Vercel after changing environment variables.

## Operating rules

Migration 005 adds the six pickup coordinates supplied by the project owner. Short names are Campus Gate, Bus Stop 1, SUB, Health Sciences, Awo Hall and Angola/Mozambique. Existing matching short/full stop names are updated in place. Other stops are retained. Demo data uses the same points; this update resets older demo data.

The dispatch form sorts available vehicles by direct-distance travel time, using owner-supplied speeds of 60-70 km/h for buses and 28-30 km/h for tricycles. These are planning assumptions, not verified road averages or recommended speeds. The displayed ideal time range excludes roads, traffic, boarding and confirmation delays. Only fresh, valid locations produce estimates. `src/travel.js` owns the calculation and speed ranges; migration 005 records the supplied assumptions in settings. Operator confirmation remains required. GPS arrival detection still requires actual location and dwell; these estimates never trigger arrivals.

- Three distinct students must support a queue level. Reports expire after ten minutes.
- A repeat report replaces that student's previous report for the stop. Reporting has a 15-second cooldown.
- Operators decide dispatches and confirm acceptance by phone. Unconfirmed dispatches expire after three minutes.
- A vehicle can have only one active dispatch. Cancel with a reason before reassigning.
- Arrival requires an accepted dispatch, location within 50 metres and a 30-second dwell. Departure is recorded beyond 100 metres.
- Driver GPS updates every ten seconds. Vehicles become offline after two minutes without a signal.
- Students see stop summaries, not driver locations or dispatch records.

## Fleet information

The transport contact reported 50 buses and 18 tricycles on 21 October 2026. Vehicles operate as needed without fixed route assignments. Supervisors call vehicles at other locations to check availability. Morning, after lectures and evening were all described as busy. No average daily trip count or daily active fleet count was supplied.

Reported totals are separate from registered vehicles and live availability. Summary text is in `src/operations.js`; migration 003 stores the reported totals in database settings.

## Project files

- `src/App.jsx`: workspace layout and view selection.
- `src/Website.jsx`: landing page and app navigation.
- `src/features/`: auth, student, driver, operator, fleet and dispatch components.
- `src/components/`: shared badges, statistics, dialogs and campus photos.
- `src/hooks/useTransport.js`: session, subscriptions, refresh and action state.
- `src/services/location.js`: browser location requests.
- `src/hooks/useDriverTracking.js`: visible-page tracking, wake lock and recovery after backgrounding or reconnecting.
- `src/Landing.jsx`: landing page.
- `src/domain.js`: queue, distance and availability logic.
- `src/data/`: demo and Supabase adapters.
- `supabase/migrations/`: schema, permissions, functions and scheduled maintenance.

## Pilot checks and limitations

Verify role permissions and one complete report-to-dispatch flow. Test GPS arrival and departure on actual driver phones. Tracking pauses when the page is hidden and resumes when visible. The active shift is restored from Supabase after a reload. Returning to the page refreshes dispatches, requests a fresh position and reacquires screen wake lock where supported. Internet reconnection also retries tracking. End shift stops it. Operators see the last location's age and vehicles become offline after two minutes without an update. Continuous background tracking is not supported.

Confirm stops, driver consent and transport-office approval before a pilot. Set up backups and basic uptime monitoring. Check map-provider and backend usage limits.

Driver email authorization and stop management currently use Supabase. Driver-to-vehicle assignment is available in Vehicle fleet. Dispatch history loads all records, suitable for a small pilot. GPS cadence and offline thresholds are also defined in the frontend; update those constants if database settings change.
