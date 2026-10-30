import React, { useEffect, useRef, useState } from 'react';
import { Bus, ShieldCheck, Navigation, Mail, LockKeyhole, AlertCircle } from 'lucide-react';
import { client } from '../../data/index.js';
import { signInError } from '../../services/signInMessages.js';

import './auth.css';

const modes = {
  student: { title: 'Student sign in', note: 'Use your @student.oauife.edu.ng email.', placeholder: 'you@student.oauife.edu.ng', href: '#app', icon: Bus },
  admin: { title: 'Admin sign in', note: 'Use your registered admin email.', placeholder: 'Your admin email', href: '#app/admin', icon: ShieldCheck },
  driver: { title: 'Driver sign in', note: 'Use your registered driver email.', placeholder: 'Your driver email', href: '#app/driver', icon: Navigation },
};
const currentMode = () => window.location.hash === '#app/driver' ? 'driver' : window.location.hash === '#app/admin' ? 'admin' : 'student';
function rememberedEmail(mode) {
  try { return localStorage.getItem(mode === 'student' ? 'oau-student-email' : `oau-${mode}-email`) || ''; } catch { return ''; }
}
export default function Login({ error }) {
  const [mode, setMode] = useState(currentMode);
  const [email, setEmail] = useState(() => rememberedEmail(currentMode()));
  const [message, setMessage] = useState(error || ''), [busy, setBusy] = useState(false), [password, setPassword] = useState(''), [creating, setCreating] = useState(false);
  const request = useRef(0), config = modes[mode], Icon = config.icon;
  useEffect(() => { if (error) setMessage(error); }, [error]);
  useEffect(() => {
    const navigate = () => { request.current++; const next = currentMode(); setMode(next); setEmail(rememberedEmail(next)); setMessage(''); setPassword(''); setCreating(false); setBusy(false); };
    window.addEventListener('hashchange', navigate);
    return () => { request.current++; window.removeEventListener('hashchange', navigate); };
  }, []);
  useEffect(() => () => { request.current++; }, []);
  async function signIn(event) {
    event.preventDefault(); if (busy) return;
    const normalized = email.trim().toLowerCase();
    if (mode === 'student' && !/^[^@\s]+@student\.oauife\.edu\.ng$/.test(normalized)) { setMessage('Use your student email (@student.oauife.edu.ng).'); return; }
    if (password.length < 8) { setMessage('Use a password with at least 8 characters.'); return; }
    const attempt = ++request.current;
    setBusy(true); setMessage('');
    try {
      const result = creating
        ? await client.auth.signUp({ email: normalized, password, options: { data: mode === 'admin' ? { access_request: 'supervisor' } : {} } })
        : await client.auth.signInWithPassword({ email: normalized, password });
      if (attempt !== request.current) return;
      if (result.error) { setMessage(signInError(result.error, mode)); return; }
      try { localStorage.setItem(mode === 'student' ? 'oau-student-email' : `oau-${mode}-email`, normalized); } catch {}
      if (!result.data.session) setMessage('Email confirmation is still enabled. Contact the administrator to finish the password-login setup.');
    } catch (err) { if (attempt === request.current) setMessage(signInError(err, mode)); }
    finally { if (attempt === request.current) setBusy(false); }
  }
  return <div className="auth-shell"><a className="auth-brand" href="#"><span><Bus size={23}/></span>oau transit<span className="auth-brand-dot">.</span></a><div className="auth-layout"><section className="auth-intro"><span className="auth-eyebrow">CAMPUS, CONNECTED</span><h2>A better way<br/>around OAU.</h2><p>Your stop. Your shuttle. One place.</p><div className="auth-campus-tag"><span/> Obafemi Awolowo University</div></section><section className="auth-card"><div className="auth-tabs" aria-label="Sign-in type">{Object.entries(modes).map(([key, item]) => <a key={key} href={item.href} aria-current={mode === key ? 'page' : undefined}>{key === 'student' ? 'Student' : key === 'driver' ? 'Driver' : 'Admin'}</a>)}</div><span className="auth-role-icon"><Icon size={25}/></span><h1>{config.title}</h1><p className="auth-note">{config.note}</p><form onSubmit={signIn}><label htmlFor="sign-in-email">Email address</label><div className={`auth-email ${message ? 'has-error' : ''}`}><Mail size={18}/><input id="sign-in-email" required type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={e => { setEmail(e.target.value); setMessage(''); }} placeholder={config.placeholder} disabled={busy} aria-invalid={!!message} aria-describedby={message ? 'sign-in-error' : undefined}/></div><label htmlFor="sign-in-password" style={{ marginTop: 18 }}>Password</label><div className="auth-email"><LockKeyhole size={18}/><input id="sign-in-password" type="password" required minLength={8} autoComplete={creating ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} placeholder="At least 8 characters"/></div>{message && <p className="auth-error" id="sign-in-error" role="alert"><AlertCircle size={17}/><span>{message}</span></p>}<button className="primary full auth-submit" disabled={busy}>{busy ? 'Please wait...' : creating ? 'Create account' : 'Sign in'}</button></form><button className="text-button full" style={{ marginTop: 18 }} onClick={() => { setCreating(!creating); setMessage(''); }}>{creating ? 'Already registered? Sign in' : 'New here? Create account'}</button></section></div><span className="auth-footer">OAU Transit · Ile-Ife</span></div>;
}
