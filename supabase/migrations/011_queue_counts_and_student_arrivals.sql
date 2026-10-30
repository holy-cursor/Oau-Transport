begin;
alter table public.queue_reports add column queue_count integer check(queue_count between 0 and 500);

create function public.submit_counted_queue_report(p_stop uuid,p_level smallint,p_lat double precision,p_lng double precision,p_accuracy double precision,p_photo text default null,p_count integer default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_count is not null and (p_count < 0 or p_count > 500) then raise exception 'Enter a queue count between 0 and 500.'; end if;
 perform public.submit_queue_report(p_stop,p_level,p_lat,p_lng,p_accuracy,p_photo);
 update public.queue_reports set queue_count=p_count where stop_id=p_stop and user_id=auth.uid();
 -- Notify students without exposing individual queue reports through Realtime.
 update public.stops set level=private.queue_level(p_stop) where id=p_stop;
end $$;
revoke all on function public.submit_counted_queue_report(uuid,smallint,double precision,double precision,double precision,text,integer) from public,anon;
grant execute on function public.submit_counted_queue_report(uuid,smallint,double precision,double precision,double precision,text,integer) to authenticated;

create or replace function public.public_transport_map()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'stops',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'lat',s.lat,'lng',s.lng,'level',s.level,'queue_count',(select round(percentile_cont(.5) within group(order by r.queue_count))::integer from public.queue_reports r where r.stop_id=s.id and r.created_at>now()-make_interval(secs=>private.setting('report_window_seconds')))) order by s.name) from public.stops s where s.active),'[]'::jsonb),
  'buses',coalesce((select jsonb_agg(jsonb_build_object(
    'id',b.id,'name',case when b.vehicle_type='tricycle' then 'Tricycle ' else 'Bus ' end || left(b.id::text,8),
    'vehicle_type',b.vehicle_type,'status',b.status,'last_lat',b.last_lat,'last_lng',b.last_lng,'last_seen',b.last_seen
  ) order by b.id) from public.buses b where b.shift_active and b.status in ('available','on_trip')
    and b.last_lat is not null and b.last_lng is not null
    and b.last_seen>now()-make_interval(secs=>private.setting('offline_seconds'))),'[]'::jsonb)
 )
$$;

alter function public.transport_snapshot() set schema private;
alter function private.transport_snapshot() rename to transport_snapshot_base;
revoke all on function private.transport_snapshot_base() from public,anon,authenticated;
create function public.transport_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; v_role text:=private.role(); stops jsonb;
begin
 if v_role is null then raise exception 'Sign in to continue.'; end if;
 result:=private.transport_snapshot_base();
 select coalesce(jsonb_agg(s.value || jsonb_build_object(
   'queue_count',q.queue_count,'report_count',q.report_count,'queue_since',q.queue_since,'latest_report',q.latest_report)), '[]'::jsonb)
 into stops from jsonb_array_elements(result->'stops') s
 cross join lateral (
   select round(percentile_cont(.5) within group(order by r.queue_count))::integer as queue_count,
   count(*) as report_count,min(created_at) as queue_since,max(created_at) as latest_report
   from public.queue_reports r where r.stop_id=(s.value->>'id')::uuid
   and r.created_at>now()-make_interval(secs=>private.setting('report_window_seconds'))
 ) q;
 result:=jsonb_set(result,'{stops}',stops);
 if v_role='student' then
   result:=result || jsonb_build_object(
     'buses',(public.public_transport_map()->'buses'),
     'dispatches',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'bus_id',d.bus_id,'stop_id',d.stop_id,'status',d.status,'created_at',d.created_at,'accepted_at',d.accepted_at,'arrived_at',d.arrived_at))
       from public.dispatches d where d.status in ('dispatched','accepted','arrived')),'[]'::jsonb));
 end if;
 return result;
end $$;
revoke all on function public.transport_snapshot() from public,anon;
grant execute on function public.transport_snapshot() to authenticated;
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='stops') then
 alter publication supabase_realtime add table public.stops;
 end if;
end $$;
NOTIFY pgrst, 'reload schema';
commit;
