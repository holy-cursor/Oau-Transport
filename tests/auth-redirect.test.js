import test from 'node:test';
import assert from 'node:assert/strict';
import { readAuthRedirect, restoreAuthSession } from '../src/services/authRedirect.js';

const origin = 'https://oau-transport.vercel.app/';
test('email callback waits for session persistence before completing', async () => {
  const redirect = readAuthRedirect(origin + '#access_token=example&refresh_token=example&type=signup');
  assert.equal(redirect.isCallback, true);
  let finish;
  let completed = false;
  const saved = { user: { id: 'student' } };
  const promise = restoreAuthSession({ getSession: () => new Promise(resolve => { finish = resolve; }) }, redirect)
    .then(result => { completed = true; return result; });
  await Promise.resolve();
  assert.equal(completed, false);
  finish({ data: { session: saved }, error: null });
  assert.deepEqual(await promise, { session: saved, error: '' });
});
test('ordinary app navigation restores saved sessions without being a callback', async () => {
  const redirect = readAuthRedirect(origin + '#app/admin');
  assert.equal(redirect.isCallback, false);
  const saved = { user: { id: 'driver' } };
  assert.equal((await restoreAuthSession({ getSession: async () => ({ data: { session: saved } }) }, redirect)).session, saved);
});
test('expired callbacks explain how to recover and successful sessions remain usable', async () => {
  const redirect = readAuthRedirect(origin + '#error=access_denied&error_code=otp_expired');
  const missing = await restoreAuthSession({ getSession: async () => ({ data: { session: null } }) }, redirect);
  assert.match(missing.error, /expired or was already used/);
  const valid = await restoreAuthSession({ getSession: async () => ({ data: { session: { user: { id: 'student' } } } }) }, redirect);
  assert.equal(valid.error, '');
});
test('missing sessions and storage failures do not silently return to sign-in', async () => {
  const redirect = readAuthRedirect(origin + '#access_token=example');
  assert.match((await restoreAuthSession({ getSession: async () => ({ data: { session: null } }) }, redirect)).error, /could not be saved/);
  assert.match((await restoreAuthSession({ getSession: async () => { throw new Error('storage'); } }, redirect)).error, /could not restore/);
  assert.deepEqual(await restoreAuthSession({ getSession: async () => ({ data: { session: null } }) }, readAuthRedirect(origin)), { session: null, error: '' });
});
