import { client, live } from './supabase.js';
import { demo } from './demo.js';
export const demoRoute = window.location.hash.startsWith('#demo');
export const transport = demoRoute || !client ? demo : live;
export { client };
