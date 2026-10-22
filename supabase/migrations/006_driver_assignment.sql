begin;

create or replace function public.transport_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
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
   'drivers',case when v_role in ('operator','admin') then coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'email',p.email) order by p.email) from public.profiles p where p.role='driver'),'[]'::jsonb) else '[]'::jsonb end,
   'dispatches',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from public.dispatches d where v_role in ('operator','admin') or (v_role='driver' and exists(select 1 from public.buses b where b.id=d.bus_id and b.driver_id=auth.uid()))),'[]'::jsonb)
  ) into result;
  return result;
 end $$;

create or replace function public.assign_driver(p_bus uuid, p_driver uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare vehicle public.buses;
begin
 if coalesce(private.role(),'') not in ('operator','admin') then
   raise exception 'Operator access required.';
 end if;
 select * into vehicle from public.buses where id=p_bus for update;
 if not found then raise exception 'Vehicle not found.'; end if;
 if vehicle.driver_id is not distinct from p_driver then return; end if;
 if vehicle.shift_active or vehicle.status <> 'off_duty' then
   raise exception 'End the vehicle shift before changing its driver.';
 end if;
 if exists(select 1 from public.dispatches where bus_id=p_bus and status in ('dispatched','accepted','arrived')) then
   raise exception 'Finish or cancel the active dispatch before changing its driver.';
 end if;
 if p_driver is not null then
   perform 1 from public.profiles where id=p_driver and role='driver' for update;
   if not found then raise exception 'Select a registered driver account.'; end if;
   if exists(select 1 from public.buses where driver_id=p_driver and id<>p_bus) then
     raise exception 'This driver already has a vehicle. Remove their current assignment first.';
   end if;
 end if;
 update public.buses set driver_id=p_driver, status='off_duty', shift_active=false,
   last_lat=null,last_lng=null,last_accuracy=null,last_speed=null,last_seen=null
 where id=p_bus;
end $$;

revoke all on function public.assign_driver(uuid,uuid) from public,anon;
grant execute on function public.assign_driver(uuid,uuid) to authenticated;
revoke all on function public.transport_snapshot() from public,anon;
grant execute on function public.transport_snapshot() to authenticated;
commit;

