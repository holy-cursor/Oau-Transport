begin;
alter table public.profiles add column supervisor_approved_at timestamptz;
alter table public.profiles add column supervisor_approved_by uuid references public.profiles(id);

create or replace function private.role() returns text language sql stable security definer set search_path='' as $$
 select p.role from public.profiles p join auth.users u on u.id=p.id
 where p.id=auth.uid() and p.active and u.email_confirmed_at is not null and
 (p.role in ('super_admin','driver') or (p.role='supervisor' and p.supervisor_approved_at is not null)
 or (p.role='student' and lower(u.email) ~ '^[^@[:space:]]+@student[.]oauife[.]edu[.]ng$'))
$$;

create or replace function private.on_signup() returns trigger language plpgsql security definer set search_path='' as $$
declare assigned_role text;
begin
 select role into assigned_role from private.staff_invites where email=lower(new.email);
 if assigned_role is null then
   if new.raw_user_meta_data->>'access_request'='supervisor' then assigned_role:='supervisor';
   elsif new.email is not null and lower(new.email) ~ '^[^@[:space:]]+@student[.]oauife[.]edu[.]ng$' then assigned_role:='student';
   else raise exception 'Use your student email or ask the super admin to authorize your driver account.';
   end if;
 end if;
 insert into public.profiles(id,email,role) values(new.id,lower(new.email),assigned_role);
 delete from private.staff_invites where email=lower(new.email);
 return new;
end $$;

create function private.reset_supervisor_approval() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.role is distinct from old.role then
   new.supervisor_approved_at:=null; new.supervisor_approved_by:=null;
 end if;
 return new;
end $$;
create trigger reset_supervisor_approval before update of role on public.profiles for each row execute function private.reset_supervisor_approval();
revoke all on function private.reset_supervisor_approval() from public,anon,authenticated;

create function public.account_access() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare profile public.profiles; confirmed boolean;
begin
 select p.* into profile from public.profiles p where p.id=auth.uid();
 if not found then raise exception 'Sign in to continue.'; end if;
 select email_confirmed_at is not null into confirmed from auth.users where id=auth.uid();
 return jsonb_build_object('role',profile.role,'access_status',case
 when not profile.active then 'disabled'
 when not coalesce(confirmed,false) then 'unverified'
 when profile.role='supervisor' and profile.supervisor_approved_at is null then 'pending'
 when private.role() is null then 'restricted' else 'approved' end);
end $$;

create function public.approve_supervisor(p_id uuid,p_approved boolean) returns void language plpgsql security definer set search_path='' as $$
declare target public.profiles;
begin
 if private.role() is distinct from 'super_admin' then raise exception 'Super admin access required.'; end if;
 if p_approved is null then raise exception 'Choose an approval status.'; end if;
 perform pg_advisory_xact_lock(268502);
 select * into target from public.profiles where id=p_id for update;
 if not found or target.role<>'supervisor' then raise exception 'Select a supervisor account.'; end if;
 if p_approved and (not target.active or not exists(select 1 from auth.users where id=p_id and email_confirmed_at is not null)) then raise exception 'The account must be enabled and its email verified before approval.'; end if;
 update public.profiles set supervisor_approved_at=case when p_approved then now() else null end,
 supervisor_approved_by=case when p_approved then auth.uid() else null end where id=p_id;
 insert into public.activity_log(actor_id,entity,entity_id,action,details)
 values(auth.uid(),'supervisor_access',p_id,case when p_approved then 'approved' else 'revoked' end,jsonb_build_object('email',target.email));
end $$;

create or replace function private.can_read_complaint(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.role() is not null and exists(select 1 from public.complaints c where c.id=p_id and
 (c.reporter_id=auth.uid() or private.role()='super_admin'))
$$;
alter policy reports_read on public.queue_reports using(private.role()='super_admin');
alter policy report_photos_read on public.report_photos using(private.role() is not null and
 ((complaint_id is not null and private.can_read_complaint(complaint_id)) or (stop_id is not null and (user_id=auth.uid() or private.role()='super_admin'))));

create or replace function public.review_complaint(p_id uuid,p_status text,p_response text) returns void language plpgsql security definer set search_path='' as $$
declare issue public.complaints;
begin
 if private.role() is distinct from 'super_admin' then raise exception 'Super admin access required.'; end if;
 select * into issue from public.complaints where id=p_id for update;
 if not found then raise exception 'Report not found.'; end if;
 if p_status is null or p_status not in ('open','reviewing','resolved','dismissed') or length(coalesce(p_response,''))>2000 then raise exception 'Choose a valid status and response.'; end if;
 if p_status in ('resolved','dismissed') and length(trim(coalesce(p_response,'')))<3 then raise exception 'Explain the outcome before closing a report.'; end if;
 update public.complaints set status=p_status,response=nullif(trim(p_response),''),reviewer_id=auth.uid(),updated_at=now() where id=p_id;
end $$;

create or replace function public.reports_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if private.role() is null then raise exception 'Sign in to continue.'; end if;
 return jsonb_build_object(
 'complaints',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from (select * from public.complaints where private.can_read_complaint(id) order by created_at desc limit 100) c),'[]'::jsonb),
 'photos',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from (select * from public.report_photos where
 (complaint_id is not null and private.can_read_complaint(complaint_id)) or (stop_id is not null and (user_id=auth.uid() or private.role()='super_admin')) order by created_at desc limit 100) p),'[]'::jsonb));
end $$;

revoke all on function public.account_access(),public.approve_supervisor(uuid,boolean) from public,anon;
grant execute on function public.account_access(),public.approve_supervisor(uuid,boolean) to authenticated;
commit;
