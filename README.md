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
7. `supabase/migrations/007_public_map.sql`
8. `supabase/migrations/008_roles_and_management.sql`
9. `supabase/migrations/009_reports_and_photos.sql`

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


## Public homepage map

Migration 007 provides `public_transport_map`, a read-only function available to anonymous and authenticated visitors. It returns active stops with aggregate queue levels and active-shift vehicles with locations newer than two minutes. Public vehicle labels hide registration names; driver identities, emails, raw reports and dispatch history are excluded. Direct table permissions are unchanged. Viewing locations is public; student reports and transport controls still require their authorized roles.

The homepage refreshes every 15 seconds while visible and on return/reconnection. Stale locations are filtered from cached results too. `src/features/public/PublicMap.jsx` and `src/hooks/usePublicMap.js` own this view. The main hero button and navigation link to `#live-map`. A missing migration produces an unavailable message, never a silent fallback to sample data. Demo mode is labelled. This expands vehicle-location visibility beyond the original student-only stop summary design.


## Roles, reports and evidence

Migration 008 converts existing operator/admin accounts to **supervisor**. Roles are now **super_admin**, **supervisor**, **driver**, **student**. After applying migrations 008 and 009, edit the email in `supabase/setup_super_admin.sql` and run that file in SQL Editor to promote your existing verified account. This bootstrap is a database-owner action, not a public signup option. No account is automatically promoted. Refresh the app after promotion.

The super-admin control centre manages account roles and enabled status, transport-email authorization, pending authorizations, stops and the latest 100 activity events. Super admins retain fleet registration, assignment and dispatch controls through Operations, Vehicle fleet and Dispatch history. Supervisors retain transport operations but cannot manage accounts, authorize staff or change roles. Disabling an account blocks authenticated transport functions and evidence access even if its Auth session still exists. The public homepage remains open to everyone. Driver shifts and dispatches must finish before role changes or reassignment. The current super admin cannot disable or demote their own account.

The **Reports and photos** page supports driver, supervisor, no-bus and other transport issues. Reporters see their own issues and reviewer responses. Supervisors can review general/driver/no-bus issues; supervisor complaints go only to super admins and the reporter. Closing an issue requires an outcome explanation. Issue submissions have a one-minute cooldown. Reported request counts are supplied by the reporter, not independently verified. Listings show the latest 100 visible records.

Students can add one optional photo to a queue report. Issue reports also support one photo. JPEG, PNG and WebP are allowed, up to 5 MB each. Migration 009 creates the private `report-evidence` Supabase Storage bucket and access policies. Photos are accessed through 60-second signed URLs; they never appear on the public map. Queue photos are visible to supervisors/super admins and their uploader. Complaint-photo access follows the complaint's visibility rules. Photos do not bypass the three-student queue threshold. File uploads that fail before report submission are cleaned up where possible; interrupted uploads can leave private orphan files, so production storage cleanup/retention still needs an operational policy. Real hosted upload and phone checks are still required after migration.

Driver statuses are **Active / available**, **Resting**, **En route**, and **Not working** through End shift. Resting vehicles cannot receive new dispatches. Drivers see anonymous current report counts, queue levels and dispatch status for active stops; they do not see student identities or private complaints from others. Browser background-location limitations still apply.

New landing-page replacement photos were not supplied, so the existing two campus photos remain.
