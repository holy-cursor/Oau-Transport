import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('driver assignment enforces roles, one vehicle per driver and safe handover', async () => {
  const db = new PGlite();
  const bus1 = '00000000-0000-0000-0000-000000000001';
  const bus2 = '00000000-0000-0000-0000-000000000002';
  const driver = '00000000-0000-0000-0000-000000000003';
  const student = '00000000-0000-0000-0000-000000000004';
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema private;
      create function private.role() returns text language sql as $$select current_setting('test.role',true)$$;
      create table public.profiles(id uuid primary key, email text, role text);
      create table public.buses(id uuid primary key, driver_id uuid unique references public.profiles(id),
        status text default 'off_duty', shift_active boolean default false,
        last_lat float,last_lng float,last_accuracy float,last_speed float,last_seen timestamptz);
      create table public.dispatches(bus_id uuid,status text);
      insert into public.profiles values ('${driver}','driver@example.com','driver'),('${student}','student@example.com','student');
      insert into public.buses(id) values('${bus1}'),('${bus2}');
      set test.role='student';
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/006_driver_assignment.sql', import.meta.url), 'utf8'));
    const assign = (bus, person) => db.query('select public.assign_driver($1::uuid,$2::uuid)', [bus, person]);
    await assert.rejects(assign(bus1, driver), /Operator access/);
    await db.exec("set test.role='operator'");
    await assert.rejects(assign(bus1, student), /registered driver/);
    await assign(bus1, driver);
    await assert.rejects(assign(bus2, driver), /already has a vehicle/);
    await db.query('update public.buses set shift_active=true where id=$1', [bus1]);
    await assert.rejects(assign(bus1, null), /End the vehicle shift/);
    await db.query('update public.buses set shift_active=false where id=$1', [bus1]);
    await db.query("insert into public.dispatches values ($1,'accepted')", [bus1]);
    await assert.rejects(assign(bus1, null), /active dispatch/);
    await db.exec('delete from public.dispatches');
    await db.query('update public.buses set last_lat=7.5,last_lng=4.5,last_seen=now() where id=$1', [bus1]);
    await assign(bus1, null);
    const { rows } = await db.query('select driver_id,last_lat,last_seen from public.buses where id=$1', [bus1]);
    assert.deepEqual(rows[0], { driver_id: null, last_lat: null, last_seen: null });
    await assign(bus2, driver);
    await assign(bus2, driver);
    const assigned = await db.query('select driver_id from public.buses where id=$1', [bus2]);
    assert.equal(assigned.rows[0].driver_id, driver);
  } finally { await db.close(); }
});
