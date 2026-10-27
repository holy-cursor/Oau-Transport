import { validateEvidence } from '../services/evidence.js';
import { campusStops } from '../stops.js';
import { ACTIVE, dispatchGuard, queueLevel } from '../domain.js';
const KEY = 'oau-transit-demo-v2';
const demoDrivers = [
  { id: 'demo-driver', email: 'driver1@example.com' },
  { id: 'd2', email: 'driver2@example.com' },
  { id: 'd3', email: 'driver3@example.com' },
  { id: 'd4', email: 'driver4@example.com' },
  { id: 'd5', email: 'driver5@example.com' },
];
const ago = seconds => new Date(Date.now() - seconds * 1000).toISOString();
const id = () => crypto.randomUUID();
function initial() {
  const stops = campusStops.map((stop, index) => ({ ...stop, id: `s${index + 1}`, level: [3, 2, 3, 1, 0, 0][index] }));
  return { stops, buses: [
    { id: 'b1', name: 'Shuttle 01', driver_id: 'demo-driver', status: 'available', last_lat: 7.513, last_lng: 4.525, last_seen: ago(10) },
    { id: 'b2', name: 'Shuttle 02', driver_id: 'd2', status: 'on_trip', last_lat: 7.505, last_lng: 4.523, last_seen: ago(15) },
    { id: 'b3', name: 'Shuttle 03', driver_id: 'd3', status: 'available', last_lat: 7.524, last_lng: 4.531, last_seen: ago(20) },
    { id: 'b4', name: 'Shuttle 04', driver_id: 'd4', status: 'off_duty', last_lat: 7.52, last_lng: 4.526, last_seen: ago(500) },
  ], reports: stops.flatMap(s => s.level ? [0, 1, 2, 3].map(n => ({ id: id(), user_id: `student-${s.id}-${n}`, stop_id: s.id, level: s.level, created_at: ago(60 + n * 15) })) : []), dispatches: [] };
}
let state;
try { state = JSON.parse(localStorage.getItem(KEY)); } catch {  }
if (!state) state = initial();
let previewRole = 'student';
const actor = () => previewRole === 'driver' ? 'demo-driver' : previewRole === 'student' ? 'demo-student' : previewRole === 'super_admin' ? 'demo-admin' : 'demo-supervisor';
state.accounts ||= [{ id: 'demo-admin', email: 'admin@example.com', role: 'super_admin', active: true }, { id: 'demo-supervisor', email: 'supervisor@example.com', role: 'supervisor', active: true }, { id: 'demo-student', email: 'student@student.oauife.edu.ng', role: 'student', active: true }, ...demoDrivers.map(d => ({ ...d, role: 'driver', active: true }))];
state.complaints ||= []; state.photos ||= []; state.invitations ||= []; state.activity ||= [];
const audit = (entity, action, details = {}) => { state.activity.unshift({ id: id(), actor_id: actor(), entity, action, details, created_at: ago(0) }); state.activity = state.activity.slice(0, 100); };
async function demoPhoto(file, details) {
  if (!file) return;
  validateEvidence(file);
  const encoded = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
  state.photos.push({ id: id(), user_id: actor(), created_at: ago(0), object_path: encoded, ...details });
}
const save = () => { localStorage.setItem(KEY, JSON.stringify(state)); window.dispatchEvent(new Event('demo-change')); };
export const demo = {
  mode: 'demo',
  setPreviewRole(role) { previewRole = role; },
  evidenceUrl: async path => path,
  async authorizeAccount(email, role) {
    const normalized = email.trim().toLowerCase();
    if (state.accounts.some(a => a.email === normalized)) throw new Error('This account already exists.');
    state.invitations = state.invitations.filter(i => i.email !== normalized);
    state.invitations.push({ email: normalized, role }); audit('invitations', 'authorized', { email: normalized, role }); save();
  },
  async revokeAuthorization(email) { state.invitations = state.invitations.filter(i => i.email !== email); audit('invitations', 'revoked', { email }); save(); },
  async manageAccount(accountId, role, active) {
    if (accountId === actor() && (role !== 'super_admin' || !active)) throw new Error('You cannot disable or demote your own account.');
    const account = state.accounts.find(a => a.id === accountId);
    if (!account) throw new Error('Account not found.');
    const bus = state.buses.find(b => b.driver_id === accountId);
    if (bus && (bus.shift_active || bus.status !== 'off_duty' || state.dispatches.some(d => d.bus_id === bus.id && ACTIVE.includes(d.status)))) throw new Error('End the shift and finish dispatches first.');
    if (bus && (account.role !== role || !active)) Object.assign(bus, { driver_id: null, last_lat: null, last_lng: null, last_seen: null });
    Object.assign(account, { role, active }); audit('profiles', 'updated', { email: account.email, role, active }); save();
  },
  async saveStop(stop) {
    if (stop.id) Object.assign(state.stops.find(s => s.id === stop.id), stop, { lat: Number(stop.lat), lng: Number(stop.lng) });
    else state.stops.push({ ...stop, id: id(), lat: Number(stop.lat), lng: Number(stop.lng), level: 0 });
    audit('stops', 'saved', { name: stop.name }); save();
  },
  async complain(issue, file) {
    const complaint = { ...issue, id: id(), reporter_id: actor(), status: 'open', created_at: ago(0), updated_at: ago(0) };
    await demoPhoto(file, { complaint_id: complaint.id, stop_id: null });
    state.complaints.unshift(complaint); audit('complaints', 'submitted', { category: issue.category }); save();
  },
  async reviewComplaint(issueId, status, response) {
    const issue = state.complaints.find(i => i.id === issueId);
    if (issue.category === 'supervisor' && previewRole !== 'super_admin') throw new Error('Only the super admin can review supervisor complaints.');
    if (['resolved','dismissed'].includes(status) && response.trim().length < 3) throw new Error('Explain the outcome first.');
    Object.assign(issue, { status, response, updated_at: ago(0) }); audit('complaints', status); save();
  },
  async publicMap() {
    const snapshot = await demo.snapshot();
    return {
      stops: snapshot.stops.map(({ id, name, lat, lng, level }) => ({ id, name, lat, lng, level })),
      buses: snapshot.buses.filter(b => b.status !== 'off_duty' && b.last_seen && Date.now() - Date.parse(b.last_seen) < 120000)
        .map(({ id, vehicle_type, status, last_lat, last_lng, last_seen }, index) => ({ id, name: `Demo vehicle ${index + 1}`, vehicle_type, status, last_lat, last_lng, last_seen })),
    };
  },
  async assignDriver(busId, driverId) {
    const vehicle = state.buses.find(b => b.id === busId);
    if (!vehicle) throw new Error('Vehicle not found.');
    const chosen = driverId || null;
    if ((vehicle.driver_id || null) === chosen) return;
    if (vehicle.shift_active || vehicle.status !== 'off_duty') throw new Error('End the vehicle shift before changing its driver.');
    if (state.dispatches.some(d => d.bus_id === busId && ACTIVE.includes(d.status))) throw new Error('Finish or cancel the active dispatch first.');
    if (chosen && !demoDrivers.some(d => d.id === chosen)) throw new Error('Select a registered driver account.');
    if (chosen && state.buses.some(b => b.id !== busId && b.driver_id === chosen)) throw new Error('This driver already has a vehicle. Remove their current assignment first.');
    Object.assign(vehicle, { driver_id: chosen, last_lat: null, last_lng: null, last_accuracy: null, last_speed: null, last_seen: null });
    save();
  },
  async registerVehicle(name, type) {
    const clean = name.trim();
    if (clean.length < 2 || clean.length > 80) throw new Error('Enter a vehicle name between 2 and 80 characters.');
    if (!['bus', 'tricycle'].includes(type)) throw new Error('Choose a valid vehicle type.');
    if (state.buses.some(b => b.name.trim().toLowerCase() === clean.toLowerCase())) throw new Error('This vehicle is already registered.');
    state.buses.push({ id: id(), name: clean, vehicle_type: type, driver_id: null, status: 'off_duty', shift_active: false, last_seen: null }); save();
  },
  async snapshot() {
    state.dispatches.forEach(d => { if (d.status === 'dispatched' && Date.now() - Date.parse(d.created_at) >= 180000) d.status = 'expired'; });
    const canSee = issue => previewRole === 'super_admin' || (previewRole === 'supervisor' && issue.category !== 'supervisor') || issue.reporter_id === actor();
    return structuredClone({ ...state,
      accounts: previewRole === 'super_admin' ? state.accounts : [],
      invitations: previewRole === 'super_admin' ? state.invitations : [],
      activity: previewRole === 'super_admin' ? state.activity : [],
      all_stops: previewRole === 'super_admin' ? state.stops : [],
      complaints: state.complaints.filter(canSee),
      photos: state.photos.filter(p => p.complaint_id ? state.complaints.some(i => i.id === p.complaint_id && canSee(i)) : ['super_admin','supervisor'].includes(previewRole) || p.user_id === actor()),
      drivers: state.accounts.filter(a => a.role === 'driver' && a.active),
      stops: state.stops.filter(s => s.active !== false).map(s => {
      const reports = state.reports.filter(r => r.stop_id === s.id && Date.now() - Date.parse(r.created_at) < 600000);
      return { ...s, level: queueLevel(reports), report_count: reports.length, latest_report: reports.sort((a,b) => b.created_at.localeCompare(a.created_at))[0]?.created_at,
        dispatch_status: state.dispatches.find(d => d.stop_id === s.id && ACTIVE.includes(d.status))?.status || null };
    }) });
  },
  subscribe(callback) { const sync = () => { try { state = JSON.parse(localStorage.getItem(KEY)) || initial(); } catch { state = initial(); } callback(); }; window.addEventListener('demo-change', callback); window.addEventListener('storage', sync); return () => { window.removeEventListener('demo-change', callback); window.removeEventListener('storage', sync); }; },
  async dispatch(busId, stopId, confirmed) {
    dispatchGuard(state.buses.find(b => b.id === busId), state.dispatches);
    if (!confirmed && state.dispatches.some(d => d.stop_id === stopId && ACTIVE.includes(d.status))) throw new Error('Another bus is already assigned. Confirm the extra dispatch.');
    state.dispatches.unshift({ id: id(), bus_id: busId, stop_id: stopId, status: 'dispatched', created_at: ago(0) }); save();
  },
  async transition(dispatchId, action, reason) {
    const d = state.dispatches.find(d => d.id === dispatchId);
    if (action === 'accept' && d.status === 'dispatched' && Date.now() - Date.parse(d.created_at) < 180000) { d.status = 'accepted'; d.accepted_at = ago(0); }
    else if (action === 'cancel' && ['dispatched', 'accepted'].includes(d.status) && reason?.trim()) { d.status = 'cancelled'; d.cancel_reason = reason; }
    else throw new Error('This dispatch cannot be changed. Refresh and try again.');
    save();
  },
  async report(stopId, level, location, file) {
    await demoPhoto(file, { stop_id: stopId, complaint_id: null });
    state.reports = state.reports.filter(r => !(r.stop_id === stopId && r.user_id === 'demo-student'));
    state.reports.push({ id: id(), stop_id: stopId, user_id: 'demo-student', level, created_at: ago(0) }); save();
  },
  async status(busId, status) { const bus = state.buses.find(b => b.id === busId); bus.status = status; if (status === 'off_duty') bus.shift_active = false; save(); },
  async start(busId) { const bus = state.buses.find(b => b.id === busId); bus.status = 'available'; bus.shift_active = true; bus.last_seen = ago(0); save(); },
  async location(busId) { const bus = state.buses.find(b => b.id === busId); bus.last_seen = ago(0); save(); },
  reset() { state = { ...initial(), accounts: state.accounts, complaints: [], photos: [], invitations: [], activity: [] }; save(); },
};
