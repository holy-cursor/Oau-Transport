import test from 'node:test';
import assert from 'node:assert/strict';
import { queueCountLabel, queueAgeMinutes, stopArrivals, arrivalLabel } from '../src/services/queueStatus.js';
import { createRefreshLoop } from '../src/services/liveRefresh.js';
test('queue estimates distinguish head counts from reports and age from individual waits', () => {
 assert.equal(queueCountLabel({ queue_count: 0, report_count: 4 }), '~0 waiting');
 assert.equal(queueCountLabel({ queue_count: null, report_count: 4 }), '4 reports');
 assert.equal(queueAgeMinutes({ queue_since: '2026-10-30T10:00:00Z' }, Date.parse('2026-10-30T10:03:00Z')), 3);
 assert.equal(queueAgeMinutes({}), null);
});
test('student arrivals use the assigned vehicle, fresh GPS and active dispatches only', () => {
 const now = Date.now(), stop = { id: 's1', lat: 7.52, lng: 4.52 };
 const data = { buses: [{ id: 'b1', vehicle_type: 'bus', last_lat: 7.51, last_lng: 4.52, last_seen: new Date(now).toISOString() }], dispatches: [
 { id: 'a', bus_id: 'b1', stop_id: 's1', status: 'accepted' },
 { id: 'b', bus_id: 'missing', stop_id: 's1', status: 'accepted' },
 { id: 'c', bus_id: 'b1', stop_id: 's1', status: 'cancelled' },
 { id: 'd', bus_id: 'b1', stop_id: 'elsewhere', status: 'accepted' }] };
 const arrivals=stopArrivals(stop,data,now);assert.equal(arrivals.length,2);assert.ok(arrivals[0].seconds>30);assert.equal(arrivals[1].seconds,null);
 assert.equal(arrivalLabel(arrivals[1]),'Waiting for fresh GPS');
 data.buses[0].last_seen=new Date(now-120000).toISOString();assert.equal(stopArrivals(stop,data,now)[0].seconds,null);
 data.dispatches[0].status='arrived';assert.equal(arrivalLabel(stopArrivals(stop,data,now)[0]),'At the stop');
});
test('refresh events coalesce without overlapping requests or running after stop', async () => {
 let active=0, maximum=0, calls=0, release;
 const loop=createRefreshLoop(async()=>{calls++;active++;maximum=Math.max(maximum,active);await new Promise(r=>{release=r;});active--;},{interval:10000});
 const initial=loop.refresh();await loop.refresh();loop.notify();loop.notify();
 assert.equal(calls,1);release();await initial;
 await new Promise(r=>setTimeout(r,250));assert.equal(maximum,1);assert.equal(calls,2);
 loop.stop();release();await new Promise(r=>setTimeout(r,250));assert.equal(calls,2);
});
