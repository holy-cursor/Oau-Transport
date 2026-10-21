export const ACTIVE = ['dispatched', 'accepted', 'arrived'];
export const LEVELS = ['No recent reports', 'Few', 'Many', 'Packed'];
export const isOnline = (bus, now = Date.now()) => !!bus.last_seen && now - Date.parse(bus.last_seen) < 120000;
export function distanceMeters(a, b) {
  const rad = v => v * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function queueLevel(reports, now = Date.now()) {
  const latest = new Map();
  for (const r of reports) {
    if (now - Date.parse(r.created_at) >= 600000 || Date.parse(r.created_at) > now) continue;
    if (!latest.has(r.user_id) || r.created_at > latest.get(r.user_id).created_at) latest.set(r.user_id, r);
  }
  const rows = [...latest.values()];
  for (let l = 3; l >= 1; l--) if (rows.filter(r => r.level >= l).length >= 3) return l;
  return 0;
}
export function dispatchGuard(bus, dispatches, now = Date.now()) {
  if (!bus || bus.status !== 'available') throw new Error('This bus is not available.');
  if (!isOnline(bus, now)) throw new Error('This bus is offline. Choose an online bus.');
  if (dispatches.some(d => d.bus_id === bus.id && ACTIVE.includes(d.status))) throw new Error('This bus already has an active dispatch.');
}
export const age = time => !time ? 'No signal' : Date.now() - Date.parse(time) < 60000 ? 'Just now' : `${Math.floor((Date.now() - Date.parse(time)) / 60000)}m ago`;
