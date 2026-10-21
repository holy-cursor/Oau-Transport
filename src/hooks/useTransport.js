import React, { useState, useEffect, useCallback } from 'react';
import { transport, client } from '../data/index.js';
const isDemo = transport.mode === 'demo';

export default function useTransport() {
  const [session, setSession] = useState(undefined), [role, setRole] = useState('operator');
  const [data, setData] = useState({ buses: [], stops: [], dispatches: [] }), [loading, setLoading] = useState(true), [error, setError] = useState(''), [toast, setToast] = useState(''), [busy, setBusy] = useState(false), [connected, setConnected] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState(null);
  const refresh = useCallback(async () => {
    try { const result = await transport.snapshot(); setData(result); if (!isDemo && result.role) setRole(result.role === 'admin' ? 'operator' : result.role); setError(''); setLastSync(Date.now()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    if (isDemo) { setSession(null); return; }
    client.auth.getSession().then(({ data, error }) => { if (error) setError(error.message); setSession(data.session); });
    const { data: listener } = client.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!isDemo && !session) return;
    refresh(); const unsubscribe = transport.subscribe(refresh); const timer = setInterval(refresh, 5000);
    return () => { unsubscribe(); clearInterval(timer); };
  }, [session, refresh]);
  useEffect(() => { const update = () => setConnected(navigator.onLine); window.addEventListener('online', update); window.addEventListener('offline', update); return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); }; }, []);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 5000); return () => clearTimeout(timer); } }, [toast]);
  async function action(fn, message) {
    setBusy(true);
    try { await fn(); await refresh(); setToast(message); return true; }
    catch (e) { setToast(e.message); return false; }
    finally { setBusy(false); }
  }
  return { session, role, setRole, data, loading, error, toast, setToast, busy, connected, lastSync, refresh, action };
}
