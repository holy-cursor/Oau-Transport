begin;
alter table public.profiles add column active boolean not null default true;
alter table public.profiles drop constraint profiles_role_check;
alter table private.staff_invites drop constraint staff_invites_role_check;
update public.profiles set role='supervisor' where role in ('operator','admin');
update private.staff_invites set role='supervisor' where role in ('operator','admin');
alter table public.profiles add constraint profiles_role_check check(role in ('super_admin','supervisor','driver','student'));
alter table private.staff_invites add constraint staff_invites_role_check check(role in ('super_admin','supervisor','driver'));
alter table public.buses drop constraint buses_status_check;
alter table public.buses add constraint buses_status_check check(status in ('available','resting','on_trip','off_duty'));
do $$declare f record; policy_row record; definition text;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f' and p.proname in ('role','on_signup','transport_snapshot','register_vehicle','assign_driver','create_dispatch','change_dispatch')
 loop
 definition:=pg_get_functiondef(f.oid);
 if definition like '%public.assign_driver(%' then definition:=replace(definition,' select * into vehicle from public.buses',' perform pg_advisory_xact_lock(268502);
 select * into vehicle from public.buses'); end if;
 if definition like '%where id=p_driver and role=''driver''%' then definition:=replace(definition,'where id=p_driver and role=''driver''','where id=p_driver and role=''driver'' and active'); end if;
 execute replace(replace(definition,'''operator''','''supervisor'''),'''admin''','''super_admin''');
 end loop;
 for policy_row in select * from pg_policies where schemaname='public'
 loop
 if policy_row.qual like '%''operator''%' or policy_row.qual like '%''admin''%' then execute format('alter policy %I on %I.%I using (%s)',policy_row.policyname,policy_row.schemaname,policy_row.tablename,replace(replace(policy_row.qual,'''operator''','''supervisor'''),'''admin''','''super_admin''')); end if;
 end loop;
end $$;
create or replace function private.role() returns text language sql stable security definer set search_path='' as $$
 select p.role from public.profiles p join auth.users u on u.id=p.id where p.id=auth.uid() and p.active and
 (p.role in ('super_admin','supervisor','driver') or (p.role='student' and u.email_confirmed_at is not null and lower(u.email) ~ '^[^@[:space:]]+@student[.]oauife[.]edu[.]ng$'))
$$;
alter policy profiles_read on public.profiles using(id=auth.uid() or private.role()='super_admin' or (private.role()='supervisor' and role='driver'));
create table public.activity_log(id uuid primary key default gen_random_uuid(),actor_id uuid,entity text not null,entity_id uuid,action text not null,details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
alter table public.activity_log enable row level security;
revoke all on public.activity_log from anon,authenticated;
create function private.audit_activity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='buses' then
 if tg_op='UPDATE' and new.driver_id is not distinct from old.driver_id and new.status=old.status and new.shift_active=old.shift_active and new.name=old.name then return new; end if;
 end if;
 insert into public.activity_log(actor_id,entity,entity_id,action,details) values(auth.uid(),tg_table_name,new.id,lower(tg_op),
 case when tg_table_name='profiles' then jsonb_build_object('role',to_jsonb(new)->>'role','active',to_jsonb(new)->'active')
 when tg_table_name='buses' then jsonb_build_object('status',to_jsonb(new)->>'status','driver_id',to_jsonb(new)->'driver_id')
 when tg_table_name='complaints' then jsonb_build_object('status',to_jsonb(new)->>'status','category',to_jsonb(new)->>'category')
 when tg_table_name='dispatches' then jsonb_build_object('status',to_jsonb(new)->>'status','stop_id',to_jsonb(new)->'stop_id') else '{}'::jsonb end);
 return new;
end $$;
create trigger audit_profiles after insert or update on public.profiles for each row execute function private.audit_activity();
create trigger audit_buses after insert or update on public.buses for each row execute function private.audit_activity();
create trigger audit_dispatches after insert or update on public.dispatches for each row execute function private.audit_activity();
create trigger audit_stops after insert or update on public.stops for each row execute function private.audit_activity();
create function public.manage_account(p_id uuid,p_role text,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
declare target public.profiles;
begin
 if private.role() is distinct from 'super_admin' then raise exception 'Super admin access required.'; end if;
 if p_role is null or p_role not in ('super_admin','supervisor','driver','student') or p_active is null then raise exception 'Choose a valid role and account status.'; end if;
 perform pg_advisory_xact_lock(268502);
 select * into target from public.profiles where id=p_id for update;
 if not found then raise exception 'Account not found.'; end if;
 if p_id=auth.uid() and (p_role<>'super_admin' or not p_active) then raise exception 'You cannot disable or demote your own super admin account.'; end if;
 if p_role='student' and lower(target.email) !~ '^[^@[:space:]]+@student[.]oauife[.]edu[.]ng$' then raise exception 'Student accounts need a school student email.'; end if;
 if (target.role<>p_role or not p_active) and exists(select 1 from public.buses b where b.driver_id=p_id and (b.shift_active or b.status<>'off_duty' or exists(select 1 from public.dispatches d where d.bus_id=b.id and d.status in ('dispatched','accepted','arrived')))) then raise exception 'End the driver shift and finish active dispatches first.'; end if;
 if target.role<>p_role or not p_active then delete from public.queue_reports where user_id=p_id; update public.buses set driver_id=null,last_lat=null,last_lng=null,last_seen=null,last_accuracy=null,last_speed=null where driver_id=p_id; end if;
 update public.profiles set role=p_role,active=p_active where id=p_id;
end $$;
create function public.authorize_account(p_email text,p_role text) returns void language plpgsql security definer set search_path='' as $$
begin
 if private.role() is distinct from 'super_admin' then raise exception 'Super admin access required.'; end if;
 if p_email is null or length(trim(p_email))>254 or trim(p_email) !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' or p_role is null or p_role not in ('driver','supervisor','super_admin') then raise exception 'Enter a valid email and transport role.'; end if;
 if exists(select 1 from public.profiles where email=lower(trim(p_email))) then raise exception 'This account exists. Change its role in the accounts list.'; end if;
 insert into private.staff_invites(email,role) values(lower(trim(p_email)),p_role) on conflict(email) do update set role=excluded.role;
 insert into public.activity_log(actor_id,entity,action,details) values(auth.uid(),'invitations','authorized',jsonb_build_object('email',lower(trim(p_email)),'role',p_role));
end $$;
create function public.revoke_authorization(p_email text) returns void language plpgsql security definer set search_path='' as $$
begin
 if private.role() is distinct from 'super_admin' then raise exception 'Super admin access required.'; end if;
 delete from private.staff_invites where email=lower(trim(p_email));
 insert into public.activity_log(actor_id,entity,action,details) values(auth.uid(),'invitations','revoked',jsonb_build_object('email',lower(trim(p_email))));
end $$;
create function public.save_stop(p_id uuid,p_name text,p_lat double precision,p_lng double precision,p_active boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if private.role() is distinct from 'super_admin' then raise exception 'Super admin access required.'; end if;
 if p_name is null or length(trim(p_name)) not between 2 and 80 or p_lat is null or p_lng is null or not(p_lat between -90 and 90) or not(p_lng between -180 and 180) or p_active is null then raise exception 'Enter a valid name and coordinates.'; end if;
 if p_id is not null then
   perform 1 from public.stops where id=p_id for update;
   if not found then raise exception 'Stop not found.'; end if;
   if exists(select 1 from public.dispatches where stop_id=p_id and status in ('dispatched','accepted','arrived')) and
      (not p_active or exists(select 1 from public.stops where id=p_id and (lat<>p_lat or lng<>p_lng))) then
     raise exception 'Finish active dispatches before moving or disabling a stop.';
   end if;
 end if;
 if p_id is null then insert into public.stops(name,lat,lng,active) values(trim(p_name),p_lat,p_lng,p_active) returning id into result;
 else update public.stops set name=trim(p_name),lat=p_lat,lng=p_lng,active=p_active where id=p_id returning id into result; if not found then raise exception 'Stop not found.'; end if; end if;
 return result;
end $$;
create or replace function public.set_bus_status(p_bus uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if private.role() is distinct from 'driver' then raise exception 'Driver access required.'; end if;
 if p_status is null or p_status not in ('available','resting','on_trip','off_duty') then raise exception 'Choose a valid work status.'; end if;
 update public.buses set status=p_status,shift_active=case when p_status='off_duty' then false else shift_active end where id=p_bus and driver_id=auth.uid() and (shift_active or p_status='off_duty');
 if not found then raise exception 'Start your shift before setting availability.'; end if;
end $$;
create function public.admin_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if private.role() is distinct from 'super_admin' then raise exception 'Super admin access required.'; end if;
 return jsonb_build_object(
 'accounts',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from public.profiles p),'[]'::jsonb),
 'invitations',coalesce((select jsonb_agg(to_jsonb(i) order by i.email) from private.staff_invites i),'[]'::jsonb),
 'all_stops',coalesce((select jsonb_agg(to_jsonb(s) order by s.name) from public.stops s),'[]'::jsonb),
 'activity',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (select * from public.activity_log order by created_at desc limit 100) a),'[]'::jsonb));
end $$;
create or replace function public.transport_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
 declare v_role text:=private.role(); result jsonb;
 begin
  if v_role is null then raise exception 'Sign in to continue.'; end if;
  perform private.refresh_state();
  select jsonb_build_object('role',v_role,
   'stops',coalesce((select jsonb_agg(jsonb_build_object(
    'id',s.id,'name',s.name,'area',s.area,'lat',s.lat,'lng',s.lng,'level',s.level,'level_since',s.level_since,
    'report_count',case when v_role in ('supervisor','super_admin','driver') then (select count(*) from public.queue_reports r where r.stop_id=s.id and r.created_at>now()-make_interval(secs=>private.setting('report_window_seconds'))) else null end,
    'latest_report',case when v_role in ('supervisor','super_admin','driver') then (select max(created_at) from public.queue_reports r where r.stop_id=s.id and r.created_at>now()-make_interval(secs=>private.setting('report_window_seconds'))) else null end,
    'dispatch_status',(select d.status from public.dispatches d where d.stop_id=s.id and d.status in ('dispatched','accepted','arrived') order by (d.status='arrived') desc,d.created_at desc limit 1)
   ) order by s.name) from public.stops s where s.active),'[]'::jsonb),
   'buses',coalesce((select jsonb_agg(to_jsonb(b) order by b.name) from public.buses b where v_role in ('supervisor','super_admin') or (v_role='driver' and b.driver_id=auth.uid())),'[]'::jsonb),
   'drivers',case when v_role in ('supervisor','super_admin') then coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'email',p.email) order by p.email) from public.profiles p where p.role='driver' and p.active),'[]'::jsonb) else '[]'::jsonb end,
   'dispatches',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from public.dispatches d where v_role in ('supervisor','super_admin') or (v_role='driver' and exists(select 1 from public.buses b where b.id=d.bus_id and b.driver_id=auth.uid()))),'[]'::jsonb)
  ) into result;
  return result;
 end $$;


revoke all on function private.audit_activity() from public,anon,authenticated;
revoke all on function public.manage_account(uuid,text,boolean),public.authorize_account(text,text),public.revoke_authorization(text),public.save_stop(uuid,text,double precision,double precision,boolean),public.admin_snapshot() from public,anon;
grant execute on function public.manage_account(uuid,text,boolean),public.authorize_account(text,text),public.revoke_authorization(text),public.save_stop(uuid,text,double precision,double precision,boolean),public.admin_snapshot() to authenticated;
commit;
