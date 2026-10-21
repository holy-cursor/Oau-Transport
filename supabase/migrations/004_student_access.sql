begin;

update public.settings set value = '"student.oauife.edu.ng"'::jsonb
where key = 'allowed_email_domain';

create or replace function private.role() returns text
language sql stable security definer set search_path='' as $$
 select p.role from public.profiles p
 join auth.users u on u.id = p.id
 where p.id = auth.uid()
 and (p.role in ('operator','driver','admin') or (
   p.role = 'student'
   and u.email_confirmed_at is not null
   and lower(u.email) ~ '^[^@[:space:]]+@student[.]oauife[.]edu[.]ng$'
 ))
$$;

create or replace function private.on_signup() returns trigger
language plpgsql security definer set search_path='' as $$
declare assigned_role text;
begin
 select role into assigned_role from private.staff_invites where email=lower(new.email);
 if assigned_role is null then
   if new.email is null or lower(new.email) !~ '^[^@[:space:]]+@student[.]oauife[.]edu[.]ng$' then
     raise exception 'Use your @student.oauife.edu.ng email. Staff must be authorized by an administrator.';
   end if;
   assigned_role := 'student';
 end if;
 insert into public.profiles(id,email,role) values(new.id,lower(new.email),assigned_role);
 delete from private.staff_invites where email=lower(new.email);
 return new;
end $$;

commit;
