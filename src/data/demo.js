import { ACTIVE, dispatchGuard, queueLevel } from '../domain.js';
const KEY = 'oau-transit-demo-v1';
const ago = seconds => new Date(Date.now() - seconds * 1000).toISOString();
const id = () => crypto.randomUUID();
function initial() {
  const stops = [
    { id: 's1', name: 'Campus Gate', area: 'Main entrance', lat: 7.492, lng: 4.521, level: 3 },
    { id: 's2', name: 'SUB Bus Stop', area: 'Student Union Building', lat: 7.5186, lng: 4.528, level: 2 },
    { id: 's3', name: 'Road 7 Gate', area: 'Residential axis', lat: 7.532, lng: 4.536, level: 3 },
    { id: 's4', name: 'Asherifa', area: 'Campus approach', lat: 7.487, lng: 4.515, level: 1 },
    { id: 's5', name: 'Fajuyi Hall', area: 'Halls of residence', lat: 7.524, lng: 4.521, level: 0 },
  ];
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
const save = () => { localStorage.setItem(KEY, JSON.stringify(state)); window.dispatchEvent(new Event('demo-change')); };
export const demo = {
  mode: 'demo',
  async registerVehicle(name, type) {
    const clean = name.trim();
    if (clean.length < 2 || clean.length > 80) throw new Error('Enter a vehicle name between 2 and 80 characters.');
    if (!['bus', 'tricycle'].includes(type)) throw new Error('Choose a valid vehicle type.');
    if (state.buses.some(b => b.name.trim().toLowerCase() === clean.toLowerCase())) throw new Error('This vehicle is already registered.');
    state.buses.push({ id: id(), name: clean, vehicle_type: type, driver_id: null, status: 'off_duty', shift_active: false, last_seen: null }); save();
  },
  async snapshot() {
    state.dispatches.forEach(d => { if (d.status === 'dispatched' && Date.now() - Date.parse(d.created_at) >= 180000) d.status = 'expired'; });
    return structuredClone({ ...state, stops: state.stops.map(s => {
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
  async report(stopId, level) {
    state.reports = state.reports.filter(r => !(r.stop_id === stopId && r.user_id === 'demo-student'));
    state.reports.push({ id: id(), stop_id: stopId, user_id: 'demo-student', level, created_at: ago(0) }); save();
  },
  async status(busId, status) { const bus = state.buses.find(b => b.id === busId); bus.status = status; if (status === 'off_duty') bus.shift_active = false; save(); },
  async start(busId) { const bus = state.buses.find(b => b.id === busId); bus.status = 'available'; bus.shift_active = true; bus.last_seen = ago(0); save(); },
  async location(busId) { const bus = state.buses.find(b => b.id === busId); bus.last_seen = ago(0); save(); },
  reset() { state = initial(); save(); },
};
