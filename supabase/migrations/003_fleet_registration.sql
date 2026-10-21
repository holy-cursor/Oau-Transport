begin;
alter table public.buses add column if not exists vehicle_type text not null default 'bus'
  check (vehicle_type in ('bus','tricycle'));

insert into public.settings(key,value) values
 ('reported_fleet', '{"buses":50,"tricycles":18,"source":"Transport contact interview, 2026-10-21","daily_active_count":null,"fixed_route_assignments":false,"average_daily_trips":null}'::jsonb)
on conflict(key) do update set value=excluded.value;

create or replace function public.register_vehicle(p_name text, p_type text)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if private.role() is null or private.role() not in ('operator','admin') then
   raise exception 'Only transport operators can register vehicles.';
 end if;
 if p_name is null or length(trim(p_name)) < 2 or length(trim(p_name)) > 80 then
   raise exception 'Enter a vehicle name or plate number between 2 and 80 characters.';
 end if;
 if p_type is null or p_type not in ('bus','tricycle') then raise exception 'Choose a valid vehicle type.'; end if;
 -- Serialize registration so duplicate checks also cover concurrent requests.
 perform pg_advisory_xact_lock(268501);
 if exists(select 1 from public.buses where lower(trim(name))=lower(trim(p_name))) then
   raise exception 'A vehicle with this name or plate number already exists.';
 end if;
 insert into public.buses(name,vehicle_type) values(trim(p_name),p_type) returning id into result;
 return result;
end $$;
revoke all on function public.register_vehicle(text,text) from public,anon;
grant execute on function public.register_vehicle(text,text) to authenticated;
commit;
