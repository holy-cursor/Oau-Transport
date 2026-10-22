import test from 'node:test';
import assert from 'node:assert/strict';
import { travelEstimate, rankVehicles } from '../src/travel.js';

const now = Date.parse('2026-10-22T12:00:00Z');
const vehicle = (id, type, lat, lng) => ({ id, name: id, vehicle_type: type, last_lat: lat, last_lng: lng, last_seen: new Date(now - 10000).toISOString() });

test('travel calculations convert kilometres per hour to seconds and distinguish types', () => {
  const stop = { lat: 0, lng: 0.01 };
  const bus = travelEstimate(vehicle('bus', 'bus', 0, 0), stop, now);
  const tricycle = travelEstimate(vehicle('tri', 'tricycle', 0, 0), stop, now);
  assert.ok(Math.abs(bus.distanceKm - 1.11195) < 0.001);
  assert.ok(Math.abs(bus.maxSeconds - 66.717) < 0.1);
  assert.ok(bus.minSeconds < bus.maxSeconds);
  assert.ok(tricycle.minSeconds > bus.maxSeconds);
});

test('ranking considers both distance and vehicle speed without mutating the fleet', () => {
  const vehicles = [vehicle('far-bus', 'bus', 0, 0), vehicle('near-tricycle', 'tricycle', 0, 0.009)];
  const rows = rankVehicles(vehicles, { lat: 0, lng: 0.01 }, now);
  assert.equal(rows[0].vehicle.id, 'near-tricycle');
  assert.equal(vehicles[0].id, 'far-bus');
});

test('missing, invalid or stale coordinates do not produce travel times', () => {
  const bus = vehicle('bus', 'bus', 0, 0);
  const stop = { lat: 0, lng: 0.01 };
  assert.equal(travelEstimate({ ...bus, last_lat: null }, stop, now), null);
  assert.equal(travelEstimate({ ...bus, last_lng: 190 }, stop, now), null);
  assert.equal(travelEstimate({ ...bus, last_seen: new Date(now - 120000).toISOString() }, stop, now), null);
  assert.equal(travelEstimate(bus, undefined, now), null);
  assert.equal(travelEstimate({ ...bus, vehicle_type: 'unknown' }, stop, now), null);
  assert.equal(travelEstimate(bus, { lat: 0, lng: 0 }, now).maxSeconds, 0);
});

