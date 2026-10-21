import { client, live } from './supabase.js';
import { demo } from './demo.js';
export const transport = client ? live : demo;
export { client };
