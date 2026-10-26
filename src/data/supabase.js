import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const client = url && key ? createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
}) : null;
async function rpc(name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
export const live = {
  mode: 'live',
  publicMap: () => rpc('public_transport_map'),
  assignDriver: (busId, driverId) => rpc('assign_driver', { p_bus: busId, p_driver: driverId || null }),
  registerVehicle: (name, type) => rpc('register_vehicle', { p_name: name, p_type: type }),
  snapshot: () => rpc('transport_snapshot'),
  dispatch: (busId, stopId, confirmed) => rpc('create_dispatch', { p_bus: busId, p_stop: stopId, p_confirm_duplicate: confirmed }),
  transition: (id, action, reason) => rpc('change_dispatch', { p_id: id, p_action: action, p_reason: reason || null }),
  report: (stopId, level, position) => rpc('submit_report', { p_stop: stopId, p_level: level, p_lat: position.coords.latitude, p_lng: position.coords.longitude, p_accuracy: position.coords.accuracy }),
  status: (busId, status) => rpc('set_bus_status', { p_bus: busId, p_status: status }),
  start: (busId, position) => rpc('start_shift', { p_bus: busId, p_lat: position.coords.latitude, p_lng: position.coords.longitude, p_accuracy: position.coords.accuracy }),
  location: (busId, position) => rpc('send_location', { p_bus: busId, p_lat: position.coords.latitude, p_lng: position.coords.longitude, p_accuracy: position.coords.accuracy, p_speed: position.coords.speed }),
  subscribe(callback) {
    const channel = client.channel('transport-updates').on('postgres_changes', { event: '*', schema: 'public', table: 'buses' }, callback).on('postgres_changes', { event: '*', schema: 'public', table: 'dispatches' }, callback).subscribe();
    return () => client.removeChannel(channel);
  },
};
