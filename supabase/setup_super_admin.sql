-- Run after migrations 008 and 009. Replace the email with your current login.
do $$
declare account_email text := 'adeyemidavid1507@gmail.com';
begin
 update public.profiles p set role='super_admin',active=true
 from auth.users u where u.id=p.id and lower(p.email)=lower(trim(account_email)) and u.email_confirmed_at is not null;
 if not found then raise exception 'No verified account found for that email. Enter the email you already use to sign in.'; end if;
end $$;
