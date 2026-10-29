import { submitWithEvidence } from '../services/evidence.js';
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
  approveSupervisor: (id, approved) => rpc('approve_supervisor', { p_id: id, p_approved: approved }),
  async snapshot() {
    const access = await rpc('account_access');
    if (access.access_status !== 'approved') return { ...access, buses: [], stops: [], dispatches: [], complaints: [], photos: [] };
    const data = await rpc('transport_snapshot');
    const [reports, management] = await Promise.all([
      rpc('reports_snapshot'),
      data.role === 'super_admin' ? rpc('admin_snapshot') : Promise.resolve({}),
    ]);
    return { ...data, ...reports, ...management, ...access };
  },
  manageAccount: (id, role, active) => rpc('manage_account', { p_id: id, p_role: role, p_active: active }),
  authorizeAccount: (email, role) => rpc('authorize_account', { p_email: email, p_role: role }),
  revokeAuthorization: email => rpc('revoke_authorization', { p_email: email }),
  saveStop: stop => rpc('save_stop', { p_id: stop.id || null, p_name: stop.name, p_lat: Number(stop.lat), p_lng: Number(stop.lng), p_active: stop.active }),
  complain: (issue, file) => submitWithEvidence(client, file, path => rpc('submit_complaint', {
    p_category: issue.category, p_subject: issue.subject, p_description: issue.description,
    p_stop: issue.stop_id || null, p_vehicle: issue.vehicle_id || null,
    p_attempts: issue.category === 'no_bus' ? Number(issue.attempts) : null, p_photo: path,
  })),
  reviewComplaint: (id, status, response) => rpc('review_complaint', { p_id: id, p_status: status, p_response: response }),
  async evidenceUrl(path) {
    const { data, error } = await client.storage.from('report-evidence').createSignedUrl(path, 60);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  },
  dispatch: (busId, stopId, confirmed) => rpc('create_dispatch', { p_bus: busId, p_stop: stopId, p_confirm_duplicate: confirmed }),
  transition: (id, action, reason) => rpc('change_dispatch', { p_id: id, p_action: action, p_reason: reason || null }),
  report: (stopId, level, position, file) => submitWithEvidence(client, file, path => rpc('submit_queue_report', { p_stop: stopId, p_level: level, p_lat: position.coords.latitude, p_lng: position.coords.longitude, p_accuracy: position.coords.accuracy, p_photo: path })),
  status: (busId, status) => rpc('set_bus_status', { p_bus: busId, p_status: status }),
  start: (busId, position) => rpc('start_shift', { p_bus: busId, p_lat: position.coords.latitude, p_lng: position.coords.longitude, p_accuracy: position.coords.accuracy }),
  location: (busId, position) => rpc('send_location', { p_bus: busId, p_lat: position.coords.latitude, p_lng: position.coords.longitude, p_accuracy: position.coords.accuracy, p_speed: position.coords.speed }),
  subscribe(callback) {
    const channel = client.channel('transport-updates').on('postgres_changes', { event: '*', schema: 'public', table: 'buses' }, callback).on('postgres_changes', { event: '*', schema: 'public', table: 'dispatches' }, callback).subscribe();
    return () => client.removeChannel(channel);
  },
};
