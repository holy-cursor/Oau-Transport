export function readAuthRedirect(href) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const isCallback = hash.has('access_token') || hash.has('refresh_token')
    || hash.has('error') || hash.has('error_code') || url.searchParams.has('code');
  const code = hash.get('error_code');
  const error = !hash.has('error') && !code ? '' : code === 'otp_expired'
    ? 'This email link has expired or was already used. Request a new sign-in link and open the latest email.'
    : 'We could not complete sign-in from this email link. Request a new sign-in link and try again.';
  return { isCallback, error };
}

export async function restoreAuthSession(auth, redirect) {
  try {
    const { data, error } = await auth.getSession();
    if (error) throw error;
    if (data.session) return { session: data.session, error: '' };
    return { session: null, error: redirect.error || (redirect.isCallback
      ? 'Your sign-in session could not be saved. Open a new sign-in email in your regular browser and allow site storage.' : '') };
  } catch {
    return { session: null, error: redirect.error || 'We could not restore your sign-in. Please try signing in again.' };
  }
}
