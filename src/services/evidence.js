export const EVIDENCE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export function validateEvidence(file) {
  if (!file) return;
  if (!EVIDENCE_TYPES.includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP image.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Choose an image smaller than 5 MB.');
}
export async function uploadEvidence(client, file) {
  if (!file) return null;
  validateEvidence(file);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('Sign in before uploading a photo.');
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
  const path = `${data.user.id}/${crypto.randomUUID()}.${ext}`;
  const uploaded = await client.storage.from('report-evidence').upload(path, file, { contentType: file.type, upsert: false });
  if (uploaded.error) throw new Error(uploaded.error.message);
  return path;
}
export async function submitWithEvidence(client, file, submit) {
  const path = await uploadEvidence(client, file);
  try { return await submit(path); }
  catch (error) {
    if (path) await client.storage.from('report-evidence').remove([path]).catch(() => {});
    throw error;
  }
}
