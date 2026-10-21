# Smart School Transport Manager: PRD and System Design

OAU SWEP/SIWES project | Web-based MVP | Version 1.0 | Prepared for the build team

## 1. Overview

### 1.1 Problem

Shuttles at Obafemi Awolowo University (OAU) often wait at quiet locations while large crowds of students queue at other stops. Nobody has a shared, live view of where shuttles are and where queues are building. The result is long waits, missed lectures, overcrowding, and some stops (for example Road 7 Campus Gate) that are hard to get transport from.

The core issue is distribution, not only fleet size. The software cannot add vehicles. It can place the vehicles that exist where students are waiting.

### 1.2 Product summary

A mobile-friendly web application (no app install) with three pages:

- **Driver page:** shares the shuttle's live GPS and the driver's status.
- **Student page:** lets students report queue size at a stop and see whether a bus has been dispatched.
- **Operator dashboard:** one live map of buses and queues, with a dispatch log. The operator decides where to send a bus, phones the driver, and logs the dispatch on the site.

### 1.3 Core principle

A human operator makes every dispatch decision. The system shows, suggests and records. It never controls drivers, and it never promises students a bus.

## 2. Goals, Non-Goals and Success Measures

### 2.1 Goals

1. Give the operator a live view of shuttle positions and verified queue levels on one map.
2. Give the operator a recorded, traceable way to send a shuttle to a stop and confirm it arrived.
3. Give students a simple way to report queues, and clear information on whether help is on the way.
4. Run on free or near-free tools, on phones people already own, with no installation.

### 2.2 Non-goals (out of scope for the MVP)

- Cabs and independent vehicles. Official shuttles only.
- Fares, tickets and payments.
- Vehicle capacity records.
- Automatic dispatch or any control over drivers.
- Background GPS tracking (needs a native app).
- Camera-based queue counting, marshal counts, and driver "people left behind" buttons.
- Guaranteed arrival-time predictions.
- A full admin interface (setup is done through seed data and the database dashboard).

### 2.2 Success measures for the pilot

| Measure | How it is measured |
| --- | --- |
| Dispatches that reach the stop | Share of dispatches ending in Arrived |
| Time from dispatch to arrival | arrived\_at minus created\_at |
| Report coverage | Number of stops with a confirmed queue level during peak hours |
| Operator adoption | Share of dispatches that were logged on the site before the phone call |
| Queue outcome | Whether the confirmed queue level dropped after an arrival |
| Student and driver feedback | Short survey at the end of the pilot |

## 3. Users and Roles

| Role | Who | Created how | Can do |
| --- | --- | --- | --- |
| Student | Students and staff | Self sign-up with university email | Report queues, view stop status |
| Driver | Shuttle drivers | Created by admin, linked to one bus | Share GPS, set status, view own dispatch alerts |
| Operator | Transport office staff | Created by admin | View everything, create and cancel dispatches, confirm acceptance |
| Admin | A team member | Database owner | Manage buses, stops, users, settings |

## 4. Functional Requirements

### 4.1 Driver page

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| D1 | Driver logs in with an account created by the admin | Driver sees only their assigned bus |
| D2 | Driver taps **Start shift** to begin location sharing | Browser asks location permission; GPS pings begin; screen wake lock is requested; audio is enabled for alerts |
| D3 | Driver sets status: Available, On trip, Off duty | Status change is saved and visible on the operator map within 5 s |
| D4 | Location sent about every 10 seconds while the shift is active | Each ping carries lat, lng, accuracy, speed (if available), timestamp |
| D5 | Driver sees a sound and visual alert when a dispatch is created for their bus | Alert shows stop name; stays until the dispatch is accepted, cancelled or expired |
| D6 | Driver sees a clear connection indicator | Shows Live, Reconnecting or Offline |
| D7 | **End shift** stops sharing | Pings stop; status becomes Off duty |

The driver does not need to tap anything to accept a dispatch. Acceptance is logged by the operator after the phone call, so the driver can stay focused on driving.

### 4.2 Student page

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| S1 | Student logs in with a university email (one-time link or code) | Sign-up is restricted to the allowed email domain |
| S2 | Student selects a stop and reports few, many or packed | Report accepted only if the phone is within 50 m of the stop |
| S3 | One report per student per stop per 10 minutes | A second report in the window replaces the first |
| S4 | Student sees each stop's confirmed queue level and dispatch status | Statuses shown: None, Bus dispatched, Bus arrived |
| S5 | Clear messages on failure | Examples: "Move closer to the stop", "You already reported recently" |

### 4.3 Operator dashboard

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| O1 | Live map with all buses and stops | Bus markers colour-coded by status; stale buses shown as Offline |
| O2 | Queue level per stop | Shows confirmed level plus the raw report count and the age of the latest report |
| O3 | A ranked list of stops needing attention | Ordered by queue level and how long the stop has been at that level |
| O4 | Create a dispatch (Bus to Stop) | Only Available, online buses can be selected; one active dispatch per bus |
| O5 | **Driver confirmed by phone** button | Moves the dispatch to Accepted and records the time |
| O6 | Cancel or reassign a dispatch | Reason recorded |
| O7 | Alert when a dispatch is not accepted in time | Default 3 minutes; operator told to call again or pick another bus |
| O8 | Dispatch history list | Filter by date, bus, stop, outcome |
| O9 | Warning when two active dispatches target the same stop | Operator can proceed after confirming |

Rule for operators: **no dispatch exists unless it is logged on the dashboard first.** The phone call is only the communication channel.

### 4.4 Automatic behaviours (server side)

- Compute the confirmed queue level of each stop (Section 7.2).
- Mark a bus Offline when no GPS has arrived for 2 minutes.
- Detect Arrived and Departed for the assigned bus only (Section 7.1).
- Expire stale queue reports and unaccepted dispatches.
- Flag a dispatch outcome when the queue is still packed after arrival.

## 5. Non-Functional Requirements

| Area | Requirement |
| --- | --- |
| Scale (pilot, assumed) | 2-5 drivers, 1-2 operators, 200-500 students |
| Read:write ratio | About 20:1. Many people read the map; few write. |
| Write volume | About 6 pings per minute per bus (roughly 20,000 per day for 5 buses), plus student reports |
| Latency | Bus position visible to operator within 5 s; queue report reflected within 10 s; page load under 3 s on mobile data |
| Availability | Brief outages acceptable in the pilot; peak hours (morning, after lectures) matter most; fallback is phone dispatch as today |
| Devices | Current Android Chrome and iOS Safari; test the wake lock and GPS behaviour on the actual driver phones |
| Data usage | Light: a few MB per day per driver phone |
| Accessibility | Large tap targets, high contrast, plain language; works on slow connections |
| Cost | Free tiers only for the pilot |

## 6. System Architecture

### 6.1 Components

| Layer | Component | Notes |
| --- | --- | --- |
| Clients | Driver page, Student page, Operator dashboard | Static web pages (HTML, CSS, JavaScript; React optional) |
| Maps | Leaflet with OpenStreetMap tiles | Free; for heavier use switch to a tile provider, as the public OSM tile server has a usage policy |
| Backend | Supabase (recommended) or Firebase | Provides login, database, realtime push, server functions |
| Database | Postgres (Supabase) | Relational data fits dispatches and reports well |
| Live state (cache) | Latest position and status stored on the bus row; computed queue view | Replaces a separate Redis cache in the MVP |
| Server logic | Database functions and edge functions | Validation, queue calculation, arrival detection |
| Hosting | Static hosting (Vercel, Netlify or Supabase) | Free tier |
| Skipped | Dedicated load balancer and API servers | The managed backend handles these |

Supabase is recommended because Postgres handles relations, row-level security and distance checks well. Firebase is a valid alternative if the team already knows it. Choose one and do not mix.

### 6.2 Data flow

1. **Driver GPS:** the driver page sends a location ping to the backend. The backend validates it, updates the bus's latest position, and appends to the optional location log.
2. **Student report:** the student page sends stop, level, and the phone's location. The backend checks login, distance to the stop, and the rate rule, then saves the report.
3. **Queue level:** the backend computes each stop's confirmed level from recent reports and exposes it as a view.
4. **Operator view:** the dashboard subscribes to buses, queue levels and dispatches, and receives live updates over the realtime channel.
5. **Dispatch:** the operator creates a dispatch. The backend rejects it if the bus is not available and online, or already has an active dispatch. The driver's page receives the alert through realtime. The operator phones the driver and clicks **Driver confirmed by phone**.
6. **Arrival:** on each location ping from a bus with an Accepted dispatch, the backend checks proximity and stillness, and moves the dispatch to Arrived, then Departed.
7. **Student view:** students see the stop's dispatch status through the same realtime channel.

### 6.3 Realtime channels

| Channel | Subscribers | Content |
| --- | --- | --- |
| buses | Operator (and students if enabled) | Position, status, last\_seen |
| stop\_queue | Operator, students | Confirmed level, raw counts |
| dispatches | Operator (all), driver (own bus), students (status per stop) | State changes |

## 7. Core Logic and Business Rules

### 7.1 Dispatch lifecycle

| State | Entered when | Next states |
| --- | --- | --- |
| Dispatched | Operator creates it on the dashboard | Accepted, Cancelled, Expired |
| Accepted | Operator clicks "Driver confirmed by phone" | Arrived, Cancelled |
| Arrived | Assigned bus within 50 m of the stop and nearly stopped for 20-30 s | Departed |
| Departed | Bus moves beyond about 100 m of the stop (larger than the arrival radius, to avoid flicker) | Closed (final) |
| Expired | Not accepted within the timeout (default 3 min) | Final; operator alerted |
| Cancelled | Operator cancels, with reason | Final |

Rules:

- Only the **assigned bus** can trigger Arrived. Other buses driving past the stop are ignored, and being near a stop is not enough on its own.
- One active dispatch per bus at any time.
- Operator sees a warning if another active dispatch already targets the same stop.
- Operator logs the dispatch **before** calling the driver.

### 7.2 Queue level calculation

Levels: few = 1, many = 2, packed = 3.

For each stop:

1. Take each student's **latest** report within the last 10 minutes.
2. The **confirmed level** is the highest level L such that at least 3 different students reported level L or higher.
3. If fewer than 3 students have reported, the stop shows as **Unconfirmed** with the raw count visible to the operator only.

Students see the confirmed level or "No recent reports". The operator also sees unconfirmed reports and their age.

### 7.3 Anti-abuse rules for reports

- Login required with the university email domain.
- Phone must be within 50 m of the stop, using a location with accuracy no worse than about 50 m.
- One report per user per stop per 10 minutes (later reports replace earlier ones).
- Overall rate limit per user.
- 3-reporter threshold before a level is confirmed.
- Reports expire after 10 minutes.
- No promise of a bus to students. The operator decides, which removes the incentive to fake a crowd.
- Optional later: weight reporters by how often their reports match the majority.

### 7.4 Configurable values

| Setting | Default |
| --- | --- |
| GPS ping interval | 10 s |
| Bus considered Offline after | 120 s without a ping |
| Ignore location readings with accuracy worse than | 50 m |
| Report distance limit | 50 m |
| Report window and expiry | 10 min |
| Reporters needed to confirm | 3 |
| Arrival radius and stillness time | 50 m, 20-30 s |
| Departure distance | 100 m |
| Dispatch acceptance timeout | 3 min |
| Location log retention | 30 days |

Keep these in a settings table so they can change without redeploying.

## 8. Data Model

### 8.1 Tables

**users**

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid, primary key | Matches the auth user |
| email | text, unique | University email |
| role | enum | student, driver, operator, admin |
| created\_at | timestamp |  |

**buses**

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid, primary key |  |
| name | text | Shown on the map, for example Bus 2 |
| driver\_id | uuid, foreign key to users | One driver per bus per shift |
| status | enum | available, on\_trip, off\_duty |
| last\_lat, last\_lng | double | Latest position |
| last\_accuracy | double | Metres |
| last\_seen | timestamp | Used to derive Offline |

**stops**

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid, primary key |  |
| name | text | For example Road 7 Campus Gate |
| lat, lng | double |  |
| active | boolean |  |

**queue\_reports**

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid, primary key |  |
| user\_id | uuid, foreign key |  |
| stop\_id | uuid, foreign key |  |
| level | smallint | 1 few, 2 many, 3 packed |
| created\_at | timestamp | Unique per user and stop within the window |

**dispatches**

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid, primary key |  |
| bus\_id | uuid, foreign key |  |
| stop\_id | uuid, foreign key |  |
| operator\_id | uuid, foreign key |  |
| status | enum | dispatched, accepted, arrived, departed, expired, cancelled |
| cancel\_reason | text, nullable |  |
| created\_at, accepted\_at, arrived\_at, departed\_at | timestamps |  |
| queue\_level\_at\_dispatch | smallint | For outcome analysis |
| queue\_level\_after\_arrival | smallint, nullable | For outcome analysis |

**location\_log** (optional)

| Field | Type | Notes |
| --- | --- | --- |
| bus\_id | uuid |  |
| lat, lng, accuracy, speed | double |  |
| recorded\_at | timestamp | Delete after the retention period |

**settings**

| Field | Type | Notes |
| --- | --- | --- |
| key | text, primary key | For example report\_window\_minutes |
| value | text or number |  |

### 8.2 Views and indexes

- **stop\_queue view:** computes the confirmed level and raw count per stop from recent queue\_reports.
- **Indexes:** queue\_reports by stop\_id and created\_at; dispatches by status; location\_log by bus\_id and recorded\_at.
- **Constraint:** a partial unique index so a bus has only one dispatch in an active state.

## 9. API Specification

All calls require login. Implement them as database functions or edge functions behind the backend's API, with the rules enforced on the server and never trusted from the client.

### 9.1 Calls

| Call | Role | Purpose |
| --- | --- | --- |
| POST /buses/{id}/location | Driver | Send a ping |
| PATCH /buses/{id}/status | Driver | Set Available, On trip, Off duty |
| POST /stops/{id}/reports | Student | Submit a queue report |
| GET /stops | All | Stops with confirmed queue level and active dispatch status |
| GET /buses | Operator | All buses with position, status, online flag |
| POST /dispatches | Operator | Create a dispatch |
| PATCH /dispatches/{id} | Operator | Accept (after phone call) or cancel |
| GET /dispatches | Operator | History with filters |

### 9.2 Examples

**Location ping**

Request: `POST /buses/{id}/location` with `{ "lat": 7.5186, "lng": 4.5280, "accuracy": 12, "speed": 0.4, "recorded_at": "2026-10-21T08:15:30Z" }`

Response: `204 No Content`. Errors: `400` invalid data, `403` not the assigned driver.

**Queue report**

Request: `POST /stops/{id}/reports` with `{ "level": 3, "lat": 7.5190, "lng": 4.5275, "accuracy": 15 }`

Response: `201` with the saved report. Errors: `422 too_far_from_stop`, `429 already_reported`, `403 not_a_student`.

**Create dispatch**

Request: `POST /dispatches` with `{ "bus_id": "...", "stop_id": "..." }`

Response: `201` with the dispatch in state dispatched. Errors: `409 bus_not_available`, `409 bus_has_active_dispatch`, `409 bus_offline`. A warning flag is returned if another active dispatch targets the same stop.

**Accept or cancel dispatch**

Request: `PATCH /dispatches/{id}` with `{ "action": "accept" }` or `{ "action": "cancel", "reason": "driver unreachable" }`

Response: `200` with the updated dispatch. Errors: `409 invalid_transition`.

### 9.3 Access control summary

| Table | Student | Driver | Operator | Admin |
| --- | --- | --- | --- | --- |
| users | Own row | Own row | Read | Full |
| buses | Status only (see 10.1) | Own bus | Read | Full |
| stops | Read | Read | Read | Full |
| queue\_reports | Insert own; read confirmed view | None | Read | Full |
| dispatches | Read status per stop | Own bus only | Full | Full |
| location\_log | None | None | Read | Full |

Enforce this with row-level security, not only in the page code.

## 10. Security and Privacy

### 10.1 Privacy decisions

- Drivers must be told what is shared and agree before the pilot. The message: location is shared to send passengers to them, not to punish or monitor them.
- Location is shared only during an active shift.
- Students see dispatch status per stop. Whether students see live bus positions is a decision for the supervisor (see Section 13). Default: do not show live bus tracks to students.
- Student reports are anonymous to other students; only the confirmed level is public.
- Collect only what is needed: email, role, reports. No names or matric numbers.
- Location log and reports are deleted after the retention period.
- Get the transport office's and the university's permission before the pilot.

### 10.2 Security

- University email domain restriction on sign-up (confirm the exact domain).
- Driver, operator and admin roles are assigned only by the admin.
- Row-level security on every table.
- Server-side validation of distance, time and role on every write. Never trust client timestamps for decisions; use server time for rate rules.
- Rate limits on login and writes.
- HTTPS only; no secrets in front-end code except the public client key.

## 11. Edge Cases and Failure Handling

### 11.1 Single points of failure

| Risk | Mitigation |
| --- | --- |
| One backend provider | Scheduled database backups; keep an export of stops and buses |
| One operator | Two operator accounts so a second person can take over |
| One driver phone per bus | Phone holder and charger in each shuttle; spare logged-in phone if possible |

### 11.2 Failures and fallbacks

| Situation | Behaviour |
| --- | --- |
| No GPS for 120 s | Bus shown Offline and cannot be dispatched |
| Poor accuracy reading | Ignored; the previous position stays |
| Phone loses signal | Driver page shows Reconnecting; on return it sends the latest ping only and discards stale ones |
| Screen locks or tab goes to background | Pings stop; the bus goes Offline; the driver page warns when the wake lock is lost |
| Audio blocked by the browser | Driver taps Start shift, which unlocks sound; vibration and a large visual alert as backup |
| Driver not reachable by phone | Dispatch expires after 3 min; operator picks another bus |
| Backend or site down | Operator dispatches by phone as before; dispatches logged afterwards if needed |
| Queue clears before the bus arrives | A new report lowers the level; the operator may cancel the dispatch |
| Two dispatches for one stop | Warning to operator |
| Dispatch to a bus that just went Offline | Rejected at creation |
| Bus drives past the stop without stopping | No Arrived; only the assigned bus needs the near and still conditions |
| GPS drift near the stop | Arrival needs stillness for 20-30 s; departure uses a larger radius |
| Fake or copied reports | Location check, rate rule, 3-reporter threshold, expiry |
| Report from a moving phone passing the stop | Distance check plus accuracy limit; consider also requiring low speed |

### 11.3 Redundancy

- Daily automatic backups.
- Two operator logins.
- Printed list of stops and driver phone numbers at the operator desk.
- Fallback of the existing phone process at all times.

### 11.4 Monitoring and alerting (lightweight)

- Dashboard shows last\_seen age for every bus.
- Alert the operator on screen if an Available bus stops sending GPS.
- Alert if a dispatch is not accepted in time.
- Free uptime checker on the site (for example UptimeRobot) with email alerts to the team.
- Backend usage alerts so the free tier is not exceeded unexpectedly.
- Error logging for the three pages (basic console or a free error tracker).

## 12. Tradeoffs and Decisions

| Decision | Chosen | Alternative | Reason and cost |
| --- | --- | --- | --- |
| Web app vs native app | Web app | Native app | No install and faster to build; GPS stops if the screen locks |
| Dispatcher | Human operator | Auto-dispatch | Simpler and safer; depends on one person |
| Queue data | Student reports | Cameras or sensors | Free; depends on adoption and honesty |
| Backend | Managed (Supabase) | Self-hosted | Fast start; limits and lock-in later |
| Realtime | Push subscriptions | Polling | Lower latency; slightly more setup |
| Cache | Latest fields on rows | Redis | Enough for the pilot |
| Maps | OpenStreetMap + Leaflet | Google Maps | Free with no billing account; fewer extras |
| GPS history | Optional, 30 days | None | Enables busy-time analysis; privacy cost, needs driver consent |
| Dispatch acceptance | Operator logs it after the call | Driver taps accept | Safer for drivers; relies on the operator being honest |

## 13. Open Questions for the Transport Supervisor

1. How many shuttles run on a normal day?
2. Where do students wait the most (names of the main pickup points)?
3. What are the busiest times?
4. How is a waiting shuttle sent somewhere today?
5. Will drivers share their phone location, and do they have mobile data?
6. Who calls the drivers and would be the operator?
7. Should students be able to see live bus positions, or only dispatch status per stop?
8. What is the exact university email domain for sign-up?

## 14. Future Extensions

In rough order of value: native driver app for background GPS, SMS or push alerts to students, history charts for busy-time patterns, suggested bus-to-stop matching for the operator, camera-based queue counting (counts only, no video stored), reporter reliability scoring, and an admin interface.

## 15. Definition of Done for the MVP

- All requirements D1-D7, S1-S5 and O1-O9 pass their acceptance criteria.
- Arrival and departure detection verified with real GPS tests at two stops, including a bus passing without stopping.
- Queue confirmation verified with at least 4 test users, including the threshold, expiry and distance rules.
- Row-level security tested for each role.
- A full dispatch exercised end to end: create, phone call, accept, arrive, depart.
- Behaviour with a locked screen, lost signal and backend outage observed and documented.
- Driver consent and transport office permission obtained.
