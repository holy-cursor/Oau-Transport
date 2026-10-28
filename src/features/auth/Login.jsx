import React, { useEffect, useState } from 'react';
import { ArrowRight, Bus } from 'lucide-react';
import { client } from '../../data/index.js';

const signInModes = {
  student: { title: 'Student sign in', description: 'Use your student email to sign in. Your email must end with @student.oauife.edu.ng.', placeholder: 'you@student.oauife.edu.ng', href: '#app' },
  admin: { title: 'Admin sign in', description: 'For authorized supervisors and super admins. Use your assigned email.', placeholder: 'Your authorized admin email', href: '#app/admin' },
  driver: { title: 'Driver sign in', description: 'For authorized drivers. Use the email registered by your transport administrator.', placeholder: 'Your authorized driver email', href: '#app/driver' },
};
const currentMode = () => window.location.hash === '#app/driver' ? 'driver' : window.location.hash === '#app/admin' ? 'admin' : 'student';
function rememberedStudentEmail() {
  try { return localStorage.getItem('oau-student-email') || ''; } catch { return ''; }
}

export default function Login({ error }) {
  const [mode, setMode] = useState(currentMode);
  const [email, setEmail] = useState(() => currentMode() === 'student' ? rememberedStudentEmail() : '');
  const [message, setMessage] = useState(error), [busy, setBusy] = useState(false);
  const config = signInModes[mode];
  useEffect(() => {
    const navigate = () => { const next = currentMode(); setMode(next); setEmail(next === 'student' ? rememberedStudentEmail() : ''); setMessage(''); };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  async function signIn(e) {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (mode === 'student' && !/^[^@\s]+@student\.oauife\.edu\.ng$/.test(normalized)) {
      setMessage('Use your student email to sign in (@student.oauife.edu.ng).');
      return;
    }
    setBusy(true);
    try {
      const { error } = await client.auth.signInWithOtp({ email: normalized, options: { emailRedirectTo: window.location.origin } });
      if (!error && mode === 'student') {
        try { localStorage.setItem('oau-student-email', normalized); } catch {}
      }
      setMessage(error ? (/database error saving new user/i.test(error.message) ? 'We could not create your account. If your email is correct, contact the transport administrator.' : error.message) : 'Check your email for your sign-in link.');
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }
  return <div className="login-page"><div className="panel login-card"><span className="brand-icon"><Bus size={28}/></span><div className="eyebrow">OAU TRANSIT</div><h1>{config.title}</h1><p>{config.description}</p><form onSubmit={signIn}><label>Email address<input required type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder={config.placeholder}/></label><button className="primary full" disabled={busy}>{busy ? 'Sending...' : 'Send sign-in link'}<ArrowRight size={16}/></button></form>{message && <p role="status">{message}</p>}<nav className="login-options" aria-label="Other sign-in options">{Object.entries(signInModes).filter(([key]) => key !== mode).map(([key, option]) => <a key={key} className="text-button" href={option.href}>{option.title}</a>)}</nav></div></div>;
}
