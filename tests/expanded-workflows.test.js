import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('role hierarchy, private evidence, complaints and driver work states work together', async () => {
 const db = new PGlite();
 const admin='00000000-0000-0000-0000-000000000011', supervisor='00000000-0000-0000-0000-000000000012', driver='00000000-0000-0000-0000-000000000013', student='00000000-0000-0000-0000-000000000014', other='00000000-0000-0000-0000-000000000015';
 const as = id => db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
 const rpc = (name,args=[]) => db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args);
 try {
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema auth,storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`);
  for (const name of ['001_transport','003_fleet_registration','004_student_access','005_campus_stops','006_driver_assignment','007_public_map']) {
   let sql=await readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8');
   sql=sql.replace('alter publication supabase_realtime add table public.buses,public.dispatches;','');
   await db.exec(sql);
  }
  await db.query("insert into private.staff_invites values('supervisor@example.com','operator')");
  await db.query("insert into auth.users values($1,'supervisor@example.com',now())",[supervisor]);
  for (const name of ['008_roles_and_management','009_reports_and_photos']) await db.exec(await readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8'));
  assert.equal((await db.query('select role from public.profiles where id=$1',[supervisor])).rows[0].role,'supervisor');
  await db.exec("insert into private.staff_invites values('admin@example.com','super_admin'),('driver@example.com','driver')");
  await db.query("insert into auth.users values($1,'admin@example.com',now()),($2,'driver@example.com',now()),($3,'a@student.oauife.edu.ng',now()),($4,'b@student.oauife.edu.ng',now())",[admin,driver,student,other]);
  await as(supervisor);
  await assert.rejects(rpc('admin_snapshot'),/Super admin/);
  await assert.rejects(rpc('authorize_account',['bad@example.com','super_admin']),/Super admin/);
  await assert.rejects(rpc('manage_account',[supervisor,'super_admin',true]),/Super admin/);
  await as(admin);
  await assert.rejects(rpc('manage_account',[admin,'student',false]),/own super admin/);
  await rpc('authorize_account',['new@example.com','driver']);
  const bus=(await rpc('register_vehicle',['TEST 101','bus'])).rows[0].value;
  await rpc('assign_driver',[bus,driver]);
  const stop=(await db.query("select * from public.stops where name='SUB'")).rows[0];
  await as(driver);await rpc('start_shift',[bus,stop.lat,stop.lng,5]);await rpc('set_bus_status',[bus,'resting']);
  await as(supervisor);await assert.rejects(rpc('create_dispatch',[bus,stop.id,false]),/not available/);
  await as(student);
  const complaintPath=student+'/complaint.jpg', queuePath=student+'/queue.jpg';
  await db.query("insert into storage.objects(bucket_id,name) values('report-evidence',$1),('report-evidence',$2)",[complaintPath,queuePath]);
  const issue=(await rpc('submit_complaint',['supervisor','Supervisor concern','A detailed issue that needs independent review.',stop.id,null,null,complaintPath])).rows[0].value;
  await rpc('submit_queue_report',[stop.id,3,stop.lat,stop.lng,5,queuePath]);
  await as(driver);const driverView=(await rpc('transport_snapshot')).rows[0].value;
  assert.equal(driverView.stops.find(s=>s.id===stop.id).report_count,1);
  assert.equal('user_id' in driverView.stops.find(s=>s.id===stop.id),false);
  await as(supervisor);
  assert.equal((await rpc('reports_snapshot')).rows[0].value.complaints.length,0);
  assert.equal((await rpc('reports_snapshot')).rows[0].value.photos.length,1);
  await assert.rejects(rpc('review_complaint',[issue,'resolved','Reviewed']),/Only the super admin/);
  await db.exec('set role authenticated');
  assert.equal((await db.query('select name from storage.objects')).rows.length,1);
  await db.exec('reset role');
  await as(other);await db.exec('set role authenticated');
  assert.equal((await db.query('select name from storage.objects')).rows.length,0);
  await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('report-evidence',$1)",[student+'/stolen.jpg']),/row-level security/);
  await db.exec('reset role');
  await as(admin);
  assert.equal((await rpc('reports_snapshot')).rows[0].value.complaints.length,1);
  await assert.rejects(rpc('review_complaint',[issue,'resolved','']),/Explain the outcome/);
  await rpc('review_complaint',[issue,'resolved','Investigated and resolved.']);
  assert.equal((await rpc('admin_snapshot')).rows[0].value.accounts.length,5);
  assert.ok((await rpc('admin_snapshot')).rows[0].value.activity.length>0);
  await rpc('manage_account',[other,'student',false]);
  await as(other);await assert.rejects(rpc('submit_complaint',['other','A new issue','This should fail for a disabled account.',null,null,null,null]),/Sign in/);
  await as(student);const own=(await rpc('reports_snapshot')).rows[0].value;
  assert.equal(own.complaints[0].status,'resolved');
  await assert.rejects(rpc('submit_complaint',['other','Duplicate','Another issue submitted much too quickly.',null,null,null,null]),/one minute/);
 } finally {await db.close();}
});
