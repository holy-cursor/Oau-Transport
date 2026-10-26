begin;
create or replace function public.public_transport_map()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'stops',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'lat',s.lat,'lng',s.lng,'level',s.level) order by s.name) from public.stops s where s.active),'[]'::jsonb),
  'buses',coalesce((select jsonb_agg(jsonb_build_object(
    'id',b.id,'name',case when b.vehicle_type='tricycle' then 'Tricycle ' else 'Bus ' end || left(b.id::text,8),
    'vehicle_type',b.vehicle_type,'status',b.status,'last_lat',b.last_lat,'last_lng',b.last_lng,'last_seen',b.last_seen
  ) order by b.id) from public.buses b where b.shift_active and b.status in ('available','on_trip')
    and b.last_lat is not null and b.last_lng is not null
    and b.last_seen>now()-make_interval(secs=>private.setting('offline_seconds'))),'[]'::jsonb)
 )
$$;
revoke all on function public.public_transport_map() from public;
grant execute on function public.public_transport_map() to anon,authenticated;
commit;
