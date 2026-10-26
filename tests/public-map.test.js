import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('public map works anonymously and excludes inactive vehicles and private fields', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema private;
      create function private.setting(text) returns double precision language sql as $$select 120::double precision$$;
      create table public.stops(id integer,name text,lat float,lng float,level integer,active boolean);
      create table public.buses(id uuid,name text,driver_id text,vehicle_type text,status text,shift_active boolean,last_lat float,last_lng float,last_seen timestamptz);
      insert into public.stops values(1,'SUB',7.518379,4.520709,2,true),(2,'Hidden',7.5,4.5,0,false);
      insert into public.buses values
       ('00000001-0000-0000-0000-000000000001','PRIVATE PLATE','driver-secret','bus','available',true,7.5,4.5,now()),
       ('00000002-0000-0000-0000-000000000002','STALE','driver-secret','bus','available',true,7.5,4.5,now()-interval '121 seconds'),
       ('00000003-0000-0000-0000-000000000003','OFF SHIFT','driver-secret','bus','available',false,7.5,4.5,now()),
       ('00000004-0000-0000-0000-000000000004','OFF DUTY','driver-secret','bus','off_duty',true,7.5,4.5,now()),
       ('00000005-0000-0000-0000-000000000005','NO FIX','driver-secret','bus','available',true,null,null,now());
      revoke all on all tables in schema public from public,anon,authenticated;
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/007_public_map.sql', import.meta.url), 'utf8'));
    await db.exec('set role anon');
    const { rows } = await db.query('select public.public_transport_map() as data');
    const data = rows[0].data;
    assert.equal(data.stops.length, 1);
    assert.equal(data.stops[0].name, 'SUB');
    assert.equal(data.buses.length, 1);
    assert.equal(data.buses[0].last_lat, 7.5);
    assert.equal(data.buses[0].name, 'Bus 00000001');
    assert.equal('driver_id' in data.buses[0], false);
    assert.equal('dispatches' in data, false);
    assert.equal(JSON.stringify(data).includes('PRIVATE PLATE'), false);
    await assert.rejects(db.query('select * from public.buses'), /permission denied/);
    await db.exec('reset role');
    await db.exec('delete from public.buses');
    const empty = await db.query('select public.public_transport_map() as data');
    assert.deepEqual(empty.rows[0].data.buses, []);
  } finally { await db.close(); }
});
