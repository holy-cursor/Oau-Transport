import test from 'node:test';
import assert from 'node:assert/strict';
import { queueLevel, dispatchGuard, distanceMeters, isOnline } from '../src/domain.js';
const now = Date.parse('2026-10-21T12:00:00Z');
const report = (user,level,seconds=0) => ({ user_id:user,level,created_at:new Date(now-seconds*1000).toISOString() });
test('queue requires three distinct people, even when reports are duplicated', () => {
 assert.equal(queueLevel([report('a',3),report('a',3),report('b',3)],now),0);
});
test('highest level supported by three people wins', () => {
 assert.equal(queueLevel([report('a',3),report('b',3),report('c',2),report('d',1)],now),2);
});
test('latest report replaces older opinion and ten-minute reports expire', () => {
 assert.equal(queueLevel([report('a',3,10),report('a',1),report('b',3),report('c',3)],now),1);
 assert.equal(queueLevel([report('a',3,600),report('b',3),report('c',3)],now),0);
});
test('dispatch rejects stale buses, busy buses, and duplicate assignments', () => {
 const bus={id:'bus',status:'available',last_seen:new Date(now-10000).toISOString()};
 assert.doesNotThrow(()=>dispatchGuard(bus,[],now));
 assert.throws(()=>dispatchGuard({...bus,status:'on_trip'},[],now),/not available/);
 assert.throws(()=>dispatchGuard({...bus,last_seen:new Date(now-120000).toISOString()},[],now),/offline/);
 assert.throws(()=>dispatchGuard(bus,[{bus_id:'bus',status:'arrived'}],now),/active dispatch/);
 assert.doesNotThrow(()=>dispatchGuard(bus,[{bus_id:'bus',status:'departed'}],now));
});
test('offline boundary and distance work at campus scale', () => {
 assert.equal(isOnline({last_seen:new Date(now-120000).toISOString()},now),false);
 const a={lat:7.5186,lng:4.528};
 assert.equal(distanceMeters(a,a),0);
 assert.ok(distanceMeters(a,{lat:7.5196,lng:4.528})>100);
 assert.ok(distanceMeters(a,{lat:7.5187,lng:4.528})<50);
});
