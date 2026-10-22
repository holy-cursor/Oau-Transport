import React, { useState } from 'react';
import { ArrowRight, Bus, Check, Send } from 'lucide-react';
import { transport, client } from '../../data/index.js';
import Student from '../student/Student.jsx';

export default function Login({ error }) {
  const [email, setEmail] = useState(() => {
    try { return localStorage.getItem('oau-student-email') || ''; }
    catch { return ''; }
  }), [message, setMessage] = useState(error), [busy, setBusy] = useState(false), [staff, setStaff] = useState(window.location.hash === '#app/admin');
  async function signIn(e) {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!staff && !/^[^@\s]+@student\.oauife\.edu\.ng$/.test(normalized)) {
      setMessage('Use your student email to sign in (@student.oauife.edu.ng).');
      return;
    }
    setBusy(true);
    try {
      const { error } = await client.auth.signInWithOtp({ email: normalized, options: { emailRedirectTo: window.location.origin } });
      if (!error && !staff) {
        try { localStorage.setItem('oau-student-email', normalized); } catch {}
      }
      setMessage(error ? (/database error saving new user/i.test(error.message) ? 'We could not create your account. If your email is correct, contact the transport administrator.' : error.message) : 'Check your email for your sign-in link.');
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }
  return <div className="login-page"><div className="panel login-card"><span className="brand-icon"><Bus size={28}/></span><div className="eyebrow">OAU TRANSIT</div><h1>{staff ? 'Admin sign in' : 'Student sign in'}</h1><p>{staff ? 'For authorized transport operators and drivers. Use your assigned email.' : 'Use your student email to sign in. Your email must end with @student.oauife.edu.ng.'}</p><form onSubmit={signIn}><label>Email address<input required type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder={staff ? 'Your authorized transport email' : 'you@student.oauife.edu.ng'}/></label><button className="primary full" disabled={busy}>{busy ? 'Sending...' : 'Send sign-in link'}<ArrowRight size={16}/></button></form>{message && <p role="status">{message}</p>}<button className="text-button" disabled={busy} onClick={() => { setStaff(!staff); setEmail(''); setMessage(''); }}>{staff ? 'Student sign in' : 'Admin sign in'}</button></div></div>;
}
