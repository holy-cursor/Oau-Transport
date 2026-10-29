import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationMessage, signInError } from '../src/services/signInMessages.js';
import { initialMapPoint, validMapPoint, closeMapZoom } from '../src/services/mapView.js';

test('both transport sign-in modes show the registration message while real delivery errors stay specific', () => {
  for (const mode of ['driver', 'admin']) {
    assert.equal(signInError({ message: 'Database error saving new user' }, mode), registrationMessage);
    assert.equal(signInError({ code: 'user_not_found', message: 'User not found' }, mode), registrationMessage);
    assert.equal(signInError({ message: 'Email rate limit exceeded' }, mode), 'Email rate limit exceeded');
    assert.equal(signInError({ message: 'Failed to fetch' }, mode), 'Failed to fetch');
  }
  assert.notEqual(signInError({ message: 'Database error saving new user' }, 'student'), registrationMessage);
});
test('map starts at a close campus or selected-stop view and rejects invalid coordinates', () => {
  const stops = [{ id: 'gate', name: 'Campus Gate', lat: 7.497281, lng: 4.522773 }, { id: 'sub', name: 'SUB', lat: 7.518379, lng: 4.520709 }];
  assert.equal(initialMapPoint(stops, 'gate'), stops[0]);
  assert.equal(initialMapPoint(stops, null), stops[1]);
  assert.ok(closeMapZoom >= 17);
  assert.ok(validMapPoint(initialMapPoint([], 'missing')));
  for (const point of [null, {lat:null,lng:4.5}, {lat:NaN,lng:4.5}, {lat:7.5,lng:181}]) assert.equal(validMapPoint(point), false);
});
