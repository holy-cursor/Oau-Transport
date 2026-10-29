import React from 'react';
import './auth.css';
import { client } from '../../data/index.js';

export default function AccessPending({ status, refresh, error, onSignOut }) {
  const pending = status === 'pending';
  return <div className="login-page"><section className="panel login-card"><div className="eyebrow">ACCOUNT ACCESS</div><h1>{pending ? 'Awaiting super admin approval' : 'Account access restricted'}</h1><p className="auth-error" role="alert">{pending ? 'Your account is awaiting approval from the super admin.' : status === 'disabled' ? 'Your account is disabled. Contact the super admin.' : 'Your account cannot access transport features. Verify your email or contact the super admin.'}</p>{error && <p className="auth-error" role="alert">{error}</p>}<button className="primary full" onClick={refresh}>Check access</button><button className="text-button" onClick={onSignOut || (() => client.auth.signOut())}>{onSignOut ? 'Return to demo control centre' : 'Sign out'}</button></section></div>;
}
