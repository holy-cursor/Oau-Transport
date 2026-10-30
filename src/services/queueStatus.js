import { travelEstimate } from '../travel.js';
export const queueCountLabel = stop => Number.isFinite(stop?.queue_count) ? `~${stop.queue_count} waiting` : `${stop?.report_count || 0} reports`;
export function queueAgeMinutes(stop, now = Date.now()) {
  const start = Date.parse(stop?.queue_since);
  return Number.isFinite(start) ? Math.max(0, Math.floor((now - start) / 60000)) : null;
}
export function stopArrivals(stop, data, now = Date.now()) {
  if (!stop) return [];
  return data.dispatches.filter(d => d.stop_id === stop.id && ['dispatched', 'accepted', 'arrived'].includes(d.status)).map(dispatch => {
    const vehicle = data.buses.find(b => b.id === dispatch.bus_id);
    const estimate = vehicle ? travelEstimate(vehicle, stop, now) : null;
    return { dispatch, vehicle, estimate, seconds: dispatch.status === 'arrived' ? 0 : estimate ? Math.ceil(estimate.maxSeconds * 1.3 + 30) : null };
  }).sort((a, b) => (a.seconds ?? Infinity) - (b.seconds ?? Infinity));
}
export function arrivalLabel(arrival) {
  if (arrival.dispatch.status === 'arrived') return 'At the stop';
  if (arrival.seconds === null) return 'Waiting for fresh GPS';
  return arrival.seconds < 60 ? 'Less than 1 min' : `About ${Math.ceil(arrival.seconds / 60)} min`;
}
