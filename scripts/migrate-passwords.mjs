import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in this terminal. Never use a VITE_ variable for the service key.');
const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).auth.admin;
const apply = process.argv.includes('--apply');
let page = 1, eligible = 0, updated = 0;
for (;;) {
  const { data, error } = await auth.listUsers({ page, perPage: 100 });
  if (error) throw error;
  for (const user of data.users) {
    if (!user.last_sign_in_at || !user.email || user.app_metadata?.password_migration_v1) continue;
    eligible++;
    if (!apply) continue;
    const result = await auth.updateUserById(user.id, {
      password: '12345678', email_confirm: true,
      app_metadata: { ...user.app_metadata, password_migration_v1: true },
    });
    if (result.error) throw new Error(`Account ${user.id}: ${result.error.message}`);
    updated++;
  }
  if (data.users.length < 100) break;
  page++;
}
console.log(apply ? `Updated ${updated} previously signed-in accounts. Already migrated accounts were skipped.` : `${eligible} previously signed-in accounts eligible. Run again with --apply to set the requested initial password.`);
