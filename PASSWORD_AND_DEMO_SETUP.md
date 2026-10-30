# Password login and presentation setup

## Apply to the live project

1. Run migrations 001 through 010 if not already applied, then run the full contents of `supabase/migrations/011_queue_counts_and_student_arrivals.sql` in Supabase SQL Editor. Run 011 once.
2. In Supabase Authentication > Sign In / Providers > Email, keep email/password enabled and turn off Confirm email. This removes inbox confirmation for new registrations. Student email suffix restrictions and supervisor approval remain enforced by the database. Without confirmation, the suffix cannot prove ownership of a school mailbox.
3. In a local PowerShell terminal, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the project URL and server service-role key. Keep the key out of Git, browser code and Vercel VITE variables.
4. Preview the existing-account migration: `node scripts/migrate-passwords.mjs`. Apply it: `node scripts/migrate-passwords.mjs --apply`. It sets 12345678 for accounts with a previous sign-in, confirms those existing emails and marks each migrated account so reruns skip it. It does not reset newly registered users or change account roles, disabled status or supervisor approval. Accounts that never signed in need registration or an administrator-assisted password setup.
5. Deploy the code and check student login, one queue report, and one dispatch on two browser tabs.

The shared initial password was requested for the existing accounts. Treat it as temporary. Each signed-in user can select Change password in the top bar. Students can create accounts with their own passwords. Drivers must already be authorized. Supervisor accounts still await super-admin approval.

## Presentation

Open `https://oau-transport.vercel.app/#demo/admin` and `https://oau-transport.vercel.app/#demo/student` in two tabs of the same browser profile. These work even when live Supabase keys are configured, require no login, and never write to Supabase. Both tabs share local simulated data. Separate devices/browser profiles have separate demo sessions.

The admin starts on operations. Dispatch an available bus to a stop. The simulated driver accepts after six seconds, moves toward that stop each second, arrives and boards passengers, then departs after twenty seconds. The student chooses the same stop to see the count, queue age and changing arrival estimate. An initial Campus Gate dispatch is already in progress. Queue reporting works without GPS in demo. Reset demo restores the scenario. Use the role selector for driver or super-admin views.

Demo vehicle movement uses interpolated coordinates for presentation, not road navigation. Demo auto-confirmation and boarding are exclusive to demo mode. Live dispatch confirmation remains with the supervisor and live arrivals still depend on real driver GPS.

## Refresh and estimates

Authenticated workspaces subscribe to buses, dispatches and stops. Realtime bursts are coalesced; requests never overlap; visible tabs have five-second fallback refreshes with randomized scheduling to reduce synchronized traffic. Tabs refresh on reconnect or return to the foreground and pause polling when hidden. Public maps refresh at five seconds and subscribe to available events; student maps reuse their workspace snapshot. Driver/report permissions still apply, so fallback polling covers events a role cannot receive.

This reduces redundant traffic. It does not add dedicated infrastructure load balancing or establish a tested maximum concurrency. Hosting/database capacity and connection limits remain deployment concerns.

Queue counts are the median of current student head-count estimates, not the number of reports. Counts stay unknown until someone reports one. Counts and queue age expire with the existing report window. Queue age is the age of the oldest current report, not a measured individual wait.

Student arrival estimates use the assigned vehicle's latest fresh coordinates, destination stop and configured bus/tricycle speed range, plus a 30-second and 30% allowance. They are approximations based on direct distance rather than road routing or live traffic. No ETA is shown when GPS is stale. Multiple active dispatches appear separately; cancelled/expired dispatches disappear.
