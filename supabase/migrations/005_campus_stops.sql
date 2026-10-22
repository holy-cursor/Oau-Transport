begin;
do $$
declare stop record;
begin
 for stop in select * from (values
   ('Campus Gate', 7.497281, 4.522773, 'Campus Gate Bus Stop'),
   ('Bus Stop 1', 7.517183, 4.523138, 'Bus Stop 1'),
   ('SUB', 7.518379, 4.520709, 'Students Union Building Bus Stop'),
   ('Health Sciences', 7.517587, 4.525306, 'College of Health Sciences Bus Stop'),
   ('Awo Hall', 7.521105, 4.516403, 'Awolowo Hall Bus Stop'),
   ('Angola/Mozambique', 7.521870, 4.513715, 'Angola & Mozambique Hall Car Park')
 ) as stops(name,lat,lng,full_name)
 loop
   update public.stops set name=stop.name, lat=stop.lat, lng=stop.lng, active=true
   where lower(name) in (lower(stop.name),lower(stop.full_name));
   if not found then
     insert into public.stops(name,lat,lng) values(stop.name,stop.lat,stop.lng);
   end if;
 end loop;
end $$;

insert into public.settings(key,value) values
 ('planning_speed_kmh','{"bus":{"min":60,"max":70},"tricycle":{"min":28,"max":30},"source":"Project owner, 2026-10-22","road_verified":false}'::jsonb)
on conflict(key) do update set value=excluded.value;
commit;
