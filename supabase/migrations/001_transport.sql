-- OAU Transit: portable Postgres core, Supabase identity at the boundary.
-- Apply once to a fresh Supabase project. No real stops or accounts are seeded.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.settings (key text primary key, value jsonb not null);
insert into public.settings values
 ('allowed_email_domain','"configure-before-signup.invalid"'),
 ('gps_interval_seconds','10'), ('offline_seconds','120'), ('max_accuracy_m','50'),
 ('report_radius_m','50'), ('report_window_seconds','600'), ('reporter_threshold','3'),
 ('arrival_radius_m','50'), ('arrival_dwell_seconds','30'), ('departure_radius_m','100'),
 ('accept_timeout_seconds','180'), ('retention_days','30');

-- Admin pre-authorizes staff email addresses before inviting them in Auth.
create table private.staff_invites (email text primary key check(email = lower(email)), role text not null check(role in ('driver','operator','admin')));
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null unique, role text not null check(role in ('student','driver','operator','admin')),
 created_at timestamptz not null default now()
);
create table public.buses (
 id uuid primary key default gen_random_uuid(), name text not null,
 driver_id uuid unique references public.profiles(id),
 status text not null default 'off_duty' check(status in ('available','on_trip','off_duty')),
 shift_active boolean not null default false,
 last_lat double precision, last_lng double precision, last_accuracy double precision,
 last_speed double precision, last_seen timestamptz,
 check(last_lat between -90 and 90), check(last_lng between -180 and 180)
);
create table public.stops (
 id uuid primary key default gen_random_uuid(), name text not null,
 area text, lat double precision not null check(lat between -90 and 90),
 lng double precision not null check(lng between -180 and 180), active boolean not null default true,
 level smallint not null default 0 check(level between 0 and 3), level_since timestamptz not null default now()
);
-- One latest report per identity and stop, updated in place. Server time only.
create table public.queue_reports (
 user_id uuid not null references public.profiles(id) on delete cascade,
 stop_id uuid not null references public.stops(id), level smallint not null check(level between 1 and 3),
 created_at timestamptz not null default now(), primary key(user_id,stop_id)
);
create index queue_reports_stop_time on public.queue_reports(stop_id,created_at desc);
create table public.dispatches (
 id uuid primary key default gen_random_uuid(), bus_id uuid not null references public.buses(id),
 stop_id uuid not null references public.stops(id), operator_id uuid not null references public.profiles(id),
 status text not null default 'dispatched' check(status in ('dispatched','accepted','arrived','departed','cancelled','expired')),
 cancel_reason text, created_at timestamptz not null default now(), accepted_at timestamptz,
 arrived_at timestamptz, departed_at timestamptz, ended_at timestamptz,
 arrival_candidate_at timestamptz,
 queue_level_at_dispatch smallint, queue_level_after_arrival smallint,
 outcome_checked_at timestamptz, needs_follow_up boolean not null default false
);
create unique index one_active_dispatch_per_bus on public.dispatches(bus_id) where status in ('dispatched','accepted','arrived');
create index dispatches_status on public.dispatches(status);
create index dispatches_stop on public.dispatches(stop_id,created_at desc);

create function private.setting(p_key text) returns double precision language sql stable security definer set search_path='' as $$
 select (value #>> '{}')::double precision from public.settings where key=p_key
$$;
create function private.role() returns text language sql stable security definer set search_path='' as $$
 select role from public.profiles where id=auth.uid()
$$;
create function private.distance_m(a_lat double precision,a_lng double precision,b_lat double precision,b_lng double precision)
 returns double precision language sql immutable set search_path='' as $$
 select 6371000 * 2 * asin(sqrt(least(1.0, greatest(0.0,
 power(sin(radians(b_lat-a_lat)/2),2) + cos(radians(a_lat))*cos(radians(b_lat))*power(sin(radians(b_lng-a_lng)/2),2)))))
$$;
create function private.check_location(p_lat double precision,p_lng double precision,p_accuracy double precision)
 returns void language plpgsql stable security definer set search_path='' as $$
 begin
  if p_lat is null or p_lng is null or p_accuracy is null or not(p_lat between -90 and 90) or not(p_lng between -180 and 180) or not(p_accuracy between 0 and private.setting('max_accuracy_m')) then
   raise exception 'A fresh, accurate location is required. Move outdoors and try again.';
  end if;
 end $$;
create function private.on_signup() returns trigger language plpgsql security definer set search_path='' as $$
 declare assigned_role text; allowed_domain text;
 begin
  select role into assigned_role from private.staff_invites where email=lower(new.email);
  if assigned_role is null then
   select value #>> '{}' into allowed_domain from public.settings where key='allowed_email_domain';
   if new.email is null or lower(split_part(new.email,'@',2)) <> lower(allowed_domain) then raise exception 'Use your university email or ask the administrator to invite you.'; end if;
   assigned_role := 'student';
  end if;
  insert into public.profiles(id,email,role) values(new.id,lower(new.email),assigned_role);
  delete from private.staff_invites where email=lower(new.email);
  return new;
 end $$;
create trigger transport_profile after insert on auth.users for each row execute function private.on_signup();

create function private.queue_level(p_stop uuid) returns smallint language sql stable security definer set search_path='' as $$
 select coalesce(max(l),0)::smallint from generate_series(1,3) as l
 where (select count(*) from public.queue_reports r where r.stop_id=p_stop and r.level>=l and r.created_at>now()-make_interval(secs=>private.setting('report_window_seconds'))) >= private.setting('reporter_threshold')
$$;
create function private.refresh_state() returns void language plpgsql security definer set search_path='' as $$
 begin
  update public.dispatches set status='expired',ended_at=now()
   where status='dispatched' and created_at<=now()-make_interval(secs=>private.setting('accept_timeout_seconds'));
  update public.stops s set level=private.queue_level(s.id),level_since=now() where s.level<>private.queue_level(s.id);
  -- Only score a post-arrival outcome if fresh evidence exists after arrival.
  update public.dispatches d set queue_level_after_arrival=private.queue_level(d.stop_id),
   needs_follow_up=private.queue_level(d.stop_id)=3,outcome_checked_at=now()
   where arrived_at is not null and outcome_checked_at is null and arrived_at<=now()-interval '2 minutes'
   and (select count(*) from public.queue_reports r where r.stop_id=d.stop_id and r.created_at>d.arrived_at
    and r.created_at>now()-make_interval(secs=>private.setting('report_window_seconds')))>=private.setting('reporter_threshold');
 end $$;

-- Direct client writes are denied. Validated RPCs are the only mutation boundary.
alter table public.profiles enable row level security;
alter table public.buses enable row level security;
alter table public.stops enable row level security;
alter table public.queue_reports enable row level security;
alter table public.dispatches enable row level security;
alter table public.settings enable row level security;
alter table private.staff_invites enable row level security;
revoke all on public.profiles,public.buses,public.stops,public.queue_reports,public.dispatches,public.settings from anon,authenticated;
grant select on public.profiles,public.buses,public.stops,public.queue_reports,public.dispatches to authenticated;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or private.role() in ('operator','admin'));
create policy buses_read on public.buses for select to authenticated using(private.role() in ('operator','admin') or (private.role()='driver' and driver_id=auth.uid()));
create policy stops_read on public.stops for select to authenticated using(private.role() is not null);
create policy reports_read on public.queue_reports for select to authenticated using(private.role() in ('operator','admin'));
create policy dispatches_read on public.dispatches for select to authenticated using(private.role() in ('operator','admin') or (private.role()='driver' and exists(select 1 from public.buses b where b.id=bus_id and b.driver_id=auth.uid())));

create function public.transport_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
 declare v_role text:=private.role(); result jsonb;
 begin
  if v_role is null then raise exception 'Sign in to continue.'; end if;
  perform private.refresh_state();
  select jsonb_build_object('role',v_role,
   'stops',coalesce((select jsonb_agg(jsonb_build_object(
    'id',s.id,'name',s.name,'area',s.area,'lat',s.lat,'lng',s.lng,'level',s.level,'level_since',s.level_since,
    'report_count',case when v_role in ('operator','admin') then (select count(*) from public.queue_reports r where r.stop_id=s.id and r.created_at>now()-make_interval(secs=>private.setting('report_window_seconds'))) else null end,
    'latest_report',case when v_role in ('operator','admin') then (select max(created_at) from public.queue_reports r where r.stop_id=s.id and r.created_at>now()-make_interval(secs=>private.setting('report_window_seconds'))) else null end,
    'dispatch_status',(select d.status from public.dispatches d where d.stop_id=s.id and d.status in ('dispatched','accepted','arrived') order by (d.status='arrived') desc,d.created_at desc limit 1)
   ) order by s.name) from public.stops s where s.active),'[]'::jsonb),
   'buses',coalesce((select jsonb_agg(to_jsonb(b) order by b.name) from public.buses b where v_role in ('operator','admin') or (v_role='driver' and b.driver_id=auth.uid())),'[]'::jsonb),
   'dispatches',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from public.dispatches d where v_role in ('operator','admin') or (v_role='driver' and exists(select 1 from public.buses b where b.id=d.bus_id and b.driver_id=auth.uid()))),'[]'::jsonb)
  ) into result;
  return result;
 end $$;

create function public.submit_report(p_stop uuid,p_level smallint,p_lat double precision,p_lng double precision,p_accuracy double precision)
 returns void language plpgsql security definer set search_path='' as $$
 declare s public.stops;
 begin
  if private.role() is distinct from 'student' then raise exception 'Only students can report queues.'; end if;
  if p_level is null or p_level not between 1 and 3 then raise exception 'Select few, many or packed.'; end if;
  perform private.check_location(p_lat,p_lng,p_accuracy);
  -- Serialize writes for a student, preventing concurrent rate-limit bypass.
  perform 1 from public.profiles where id=auth.uid() for update;
  if exists(select 1 from public.queue_reports where user_id=auth.uid() and created_at>now()-interval '15 seconds') then raise exception 'Please wait 15 seconds before another report.'; end if;
  select * into s from public.stops where id=p_stop and active;
  if not found then raise exception 'This stop is unavailable.'; end if;
  if private.distance_m(p_lat,p_lng,s.lat,s.lng)>private.setting('report_radius_m') then raise exception 'Move closer to the stop. You must be within 50 m.'; end if;
  insert into public.queue_reports(user_id,stop_id,level) values(auth.uid(),p_stop,p_level)
   on conflict(user_id,stop_id) do update set level=excluded.level,created_at=now();
  update public.stops set level=private.queue_level(p_stop),level_since=now() where id=p_stop and level<>private.queue_level(p_stop);
 end $$;

create function public.create_dispatch(p_bus uuid,p_stop uuid,p_confirm_duplicate boolean default false)
 returns uuid language plpgsql security definer set search_path='' as $$
 declare b public.buses; result uuid;
 begin
  if coalesce(private.role(),'') not in ('operator','admin') then raise exception 'Operator access required.'; end if;
  -- Always lock bus before dispatch rows (same order as location/change calls).
  select * into b from public.buses where id=p_bus for update;
  if not found or b.status<>'available' or not b.shift_active then raise exception 'This bus is not available.'; end if;
  if b.last_seen is null or b.last_seen<=now()-make_interval(secs=>private.setting('offline_seconds')) then raise exception 'This bus is offline.'; end if;
  update public.dispatches set status='expired',ended_at=now() where bus_id=p_bus and status='dispatched' and created_at<=now()-make_interval(secs=>private.setting('accept_timeout_seconds'));
  if exists(select 1 from public.dispatches where bus_id=p_bus and status in ('dispatched','accepted','arrived')) then raise exception 'This bus already has an active dispatch.'; end if;
  -- Serialize duplicate-target checks across different buses.
  perform 1 from public.stops where id=p_stop and active for update;
  if not found then raise exception 'This stop is unavailable.'; end if;
  if not coalesce(p_confirm_duplicate,false) and exists(select 1 from public.dispatches where stop_id=p_stop and status in ('dispatched','accepted','arrived') and (status<>'dispatched' or created_at>now()-make_interval(secs=>private.setting('accept_timeout_seconds')))) then raise exception 'Another bus is already assigned. Confirm the additional dispatch.'; end if;
  insert into public.dispatches(bus_id,stop_id,operator_id,queue_level_at_dispatch) values(p_bus,p_stop,auth.uid(),private.queue_level(p_stop)) returning id into result;
  return result;
 end $$;

create function public.change_dispatch(p_id uuid,p_action text,p_reason text default null)
 returns void language plpgsql security definer set search_path='' as $$
 declare d public.dispatches; target_bus uuid;
 begin
  if coalesce(private.role(),'') not in ('operator','admin') then raise exception 'Operator access required.'; end if;
  select bus_id into target_bus from public.dispatches where id=p_id;
  perform 1 from public.buses where id=target_bus for update;
  select * into d from public.dispatches where id=p_id for update;
  if not found then raise exception 'Dispatch not found.'; end if;
  if p_action='accept' and d.status='dispatched' and d.created_at>now()-make_interval(secs=>private.setting('accept_timeout_seconds')) then
   update public.dispatches set status='accepted',accepted_at=now() where id=p_id;
  elsif p_action='cancel' and d.status in ('dispatched','accepted') and length(trim(p_reason)) between 1 and 500 then
   update public.dispatches set status='cancelled',cancel_reason=trim(p_reason),ended_at=now() where id=p_id;
  else raise exception 'This dispatch cannot be changed. It may have expired.';
  end if;
 end $$;

create function public.start_shift(p_bus uuid,p_lat double precision,p_lng double precision,p_accuracy double precision)
 returns void language plpgsql security definer set search_path='' as $$
 begin
  if private.role() is distinct from 'driver' then raise exception 'Driver access required.'; end if;
  perform private.check_location(p_lat,p_lng,p_accuracy);
  update public.buses set shift_active=true,status='available',last_lat=p_lat,last_lng=p_lng,last_accuracy=p_accuracy,last_seen=now()
   where id=p_bus and driver_id=auth.uid();
  if not found then raise exception 'This shuttle is not assigned to you.'; end if;
 end $$;
create function public.set_bus_status(p_bus uuid,p_status text)
 returns void language plpgsql security definer set search_path='' as $$
 begin
  if private.role() is distinct from 'driver' then raise exception 'Driver access required.'; end if;
  if p_status is null or p_status not in ('available','on_trip','off_duty') then raise exception 'Invalid driver status.'; end if;
  update public.buses set status=p_status,shift_active=case when p_status='off_duty' then false else shift_active end
   where id=p_bus and driver_id=auth.uid() and (shift_active or p_status='off_duty');
  if not found then raise exception 'Start your shift before setting availability.'; end if;
 end $$;
create function public.send_location(p_bus uuid,p_lat double precision,p_lng double precision,p_accuracy double precision,p_speed double precision default null)
 returns void language plpgsql security definer set search_path='' as $$
 declare b public.buses; d public.dispatches; s public.stops; distance double precision; still boolean;
 begin
  if private.role() is distinct from 'driver' then raise exception 'Driver access required.'; end if;
  perform private.check_location(p_lat,p_lng,p_accuracy);
  if p_speed is not null and not(p_speed between 0 and 100) then raise exception 'Invalid speed.'; end if;
  select * into b from public.buses where id=p_bus and driver_id=auth.uid() for update;
  if not found or not b.shift_active then raise exception 'Start your shift before sharing location.'; end if;
  if b.last_seen>now()-interval '3 seconds' then return; end if;
  select * into d from public.dispatches where bus_id=p_bus and status in ('accepted','arrived') for update;
  if found then
   select * into s from public.stops where id=d.stop_id;
   distance:=private.distance_m(p_lat,p_lng,s.lat,s.lng);
   still:=b.last_seen>now()-interval '25 seconds' and private.distance_m(p_lat,p_lng,b.last_lat,b.last_lng)<=10 and coalesce(p_speed,0)<=1;
   if d.status='accepted' then
    if distance<=private.setting('arrival_radius_m') and still then
     if d.arrival_candidate_at is null then update public.dispatches set arrival_candidate_at=now() where id=d.id;
     elsif d.arrival_candidate_at<=now()-make_interval(secs=>private.setting('arrival_dwell_seconds')) then
      update public.dispatches set status='arrived',arrived_at=now() where id=d.id;
     end if;
    else update public.dispatches set arrival_candidate_at=null where id=d.id and arrival_candidate_at is not null;
    end if;
   elsif d.status='arrived' and distance>private.setting('departure_radius_m') then
    update public.dispatches set status='departed',departed_at=now(),ended_at=now() where id=d.id;
   end if;
  end if;
  update public.buses set last_lat=p_lat,last_lng=p_lng,last_accuracy=p_accuracy,last_speed=p_speed,last_seen=now() where id=p_bus;
 end $$;

-- Explicitly close Postgres' default PUBLIC execution permission.
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.role() to authenticated;
revoke execute on function public.transport_snapshot(),public.submit_report(uuid,smallint,double precision,double precision,double precision),public.create_dispatch(uuid,uuid,boolean),public.change_dispatch(uuid,text,text),public.start_shift(uuid,double precision,double precision,double precision),public.set_bus_status(uuid,text),public.send_location(uuid,double precision,double precision,double precision,double precision) from public,anon;
grant execute on function public.transport_snapshot(),public.submit_report(uuid,smallint,double precision,double precision,double precision),public.create_dispatch(uuid,uuid,boolean),public.change_dispatch(uuid,text,text),public.start_shift(uuid,double precision,double precision,double precision),public.set_bus_status(uuid,text),public.send_location(uuid,double precision,double precision,double precision,double precision) to authenticated;

-- Enable only tables whose row policies support the subscribed audience.
alter publication supabase_realtime add table public.buses,public.dispatches;
commit;
