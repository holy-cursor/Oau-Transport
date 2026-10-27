begin;
create table public.complaints(
 id uuid primary key default gen_random_uuid(),reporter_id uuid not null references public.profiles(id),
 category text not null check(category in ('driver','supervisor','no_bus','other')),
 subject text not null check(length(trim(subject)) between 3 and 120),
 description text not null check(length(trim(description)) between 20 and 2000),
 stop_id uuid references public.stops(id),vehicle_id uuid references public.buses(id),
 attempts integer check(attempts between 1 and 100),
 status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),
 response text,reviewer_id uuid references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index complaints_created on public.complaints(created_at desc);
create table public.report_photos(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),
 stop_id uuid references public.stops(id),complaint_id uuid references public.complaints(id),
 object_path text not null unique,created_at timestamptz not null default now(),
 check((stop_id is not null and complaint_id is null) or (stop_id is null and complaint_id is not null))
);
create function private.can_read_complaint(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.role() is not null and exists(select 1 from public.complaints c where c.id=p_id and
 (c.reporter_id=auth.uid() or private.role()='super_admin' or (private.role()='supervisor' and c.category<>'supervisor')))
$$;
alter table public.complaints enable row level security;
alter table public.report_photos enable row level security;
revoke all on public.complaints,public.report_photos from anon,authenticated;
grant select on public.complaints,public.report_photos to authenticated;
create policy complaints_read on public.complaints for select to authenticated using(private.can_read_complaint(id));
create policy report_photos_read on public.report_photos for select to authenticated using(private.role() is not null and
 ((complaint_id is not null and private.can_read_complaint(complaint_id)) or (stop_id is not null and (user_id=auth.uid() or private.role() in ('supervisor','super_admin')))));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('report-evidence','report-evidence',false,5242880,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy evidence_upload on storage.objects for insert to authenticated with check(bucket_id='report-evidence' and private.role() is not null and split_part(name,'/',1)=auth.uid()::text);
create policy evidence_read on storage.objects for select to authenticated using(bucket_id='report-evidence' and exists(select 1 from public.report_photos p where p.object_path=name));
create policy evidence_cleanup on storage.objects for delete to authenticated using(bucket_id='report-evidence' and private.role() is not null and split_part(name,'/',1)=auth.uid()::text and not exists(select 1 from public.report_photos p where p.object_path=name));

create function private.attach_photo(p_path text,p_stop uuid,p_complaint uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_path is null then return; end if;
 if length(p_path)>300 or split_part(p_path,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='report-evidence' and name=p_path) then raise exception 'Upload a valid photo from your own account.'; end if;
 insert into public.report_photos(user_id,stop_id,complaint_id,object_path) values(auth.uid(),p_stop,p_complaint,p_path);
end $$;
create function public.submit_queue_report(p_stop uuid,p_level smallint,p_lat double precision,p_lng double precision,p_accuracy double precision,p_photo text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.submit_report(p_stop,p_level,p_lat,p_lng,p_accuracy);
 perform private.attach_photo(p_photo,p_stop,null);
end $$;
create function public.submit_complaint(p_category text,p_subject text,p_description text,p_stop uuid default null,p_vehicle uuid default null,p_attempts integer default null,p_photo text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if private.role() is null then raise exception 'Sign in to report an issue.'; end if;
 if p_category is null or p_category not in ('driver','supervisor','no_bus','other') then raise exception 'Choose a report category.'; end if;
 if p_subject is null or length(trim(p_subject)) not between 3 and 120 or p_description is null or length(trim(p_description)) not between 20 and 2000 then raise exception 'Add a subject and a description of at least 20 characters.'; end if;
 if p_category='no_bus' and (p_stop is null or p_attempts is null or p_attempts not between 1 and 100) then raise exception 'Choose a stop and enter how many times you requested a bus.'; end if;
 if p_stop is not null and not exists(select 1 from public.stops where id=p_stop and active) then raise exception 'Choose an active stop.'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if exists(select 1 from public.complaints where reporter_id=auth.uid() and created_at>now()-interval '1 minute') then raise exception 'Wait one minute before submitting another issue.'; end if;
 insert into public.complaints(reporter_id,category,subject,description,stop_id,vehicle_id,attempts) values(auth.uid(),p_category,trim(p_subject),trim(p_description),p_stop,p_vehicle,p_attempts) returning id into result;
 perform private.attach_photo(p_photo,null,result);
 return result;
end $$;
create function public.review_complaint(p_id uuid,p_status text,p_response text) returns void language plpgsql security definer set search_path='' as $$
declare issue public.complaints;
begin
 if coalesce(private.role(),'') not in ('super_admin','supervisor') then raise exception 'Supervisor access required.'; end if;
 select * into issue from public.complaints where id=p_id for update;
 if not found then raise exception 'Report not found.'; end if;
 if issue.category='supervisor' and private.role()<>'super_admin' then raise exception 'Only the super admin can review supervisor complaints.'; end if;
 if p_status is null or p_status not in ('open','reviewing','resolved','dismissed') or length(coalesce(p_response,''))>2000 then raise exception 'Choose a valid status and response.'; end if;
 if p_status in ('resolved','dismissed') and length(trim(coalesce(p_response,'')))<3 then raise exception 'Explain the outcome before closing a report.'; end if;
 update public.complaints set status=p_status,response=nullif(trim(p_response),''),reviewer_id=auth.uid(),updated_at=now() where id=p_id;
end $$;
create trigger audit_complaints after insert or update on public.complaints for each row execute function private.audit_activity();
create function public.reports_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if private.role() is null then raise exception 'Sign in to continue.'; end if;
 return jsonb_build_object(
 'complaints',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from (select * from public.complaints where private.can_read_complaint(id) order by created_at desc limit 100) c),'[]'::jsonb),
 'photos',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from (select * from public.report_photos where
 (complaint_id is not null and private.can_read_complaint(complaint_id)) or (stop_id is not null and (user_id=auth.uid() or private.role() in ('super_admin','supervisor'))) order by created_at desc limit 100) p),'[]'::jsonb));
end $$;
revoke all on function private.can_read_complaint(uuid),private.attach_photo(text,uuid,uuid) from public,anon,authenticated;
grant execute on function private.can_read_complaint(uuid) to authenticated;
revoke all on function public.submit_queue_report(uuid,smallint,double precision,double precision,double precision,text),public.submit_complaint(text,text,text,uuid,uuid,integer,text),public.review_complaint(uuid,text,text),public.reports_snapshot() from public,anon;
grant execute on function public.submit_queue_report(uuid,smallint,double precision,double precision,double precision,text),public.submit_complaint(text,text,text,uuid,uuid,integer,text),public.review_complaint(uuid,text,text),public.reports_snapshot() to authenticated;
commit;
