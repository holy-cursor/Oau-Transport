import React, { useState, useEffect, useCallback, useRef } from 'react';
import { transport, client } from '../data/index.js';
import { createRefreshLoop } from '../services/liveRefresh.js';
const isDemo = transport.mode === 'demo';

export default function useTransport() {
  const [session, setSession] = useState(undefined), [role, setRole] = useState(isDemo && window.location.hash.includes('/admin') ? 'supervisor' : 'student');
  const [data, setData] = useState({ buses: [], stops: [], dispatches: [] }), [loading, setLoading] = useState(true), [error, setError] = useState(''), [toast, setToast] = useState(''), [busy, setBusy] = useState(false), [connected, setConnected] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState(null);
  const sessionUser = useRef(null), pendingRefresh = useRef(null);
  if (isDemo) transport.setPreviewRole(role);
  const refresh = useCallback(async () => {
    if (pendingRefresh.current) return pendingRefresh.current;
    const work = (async () => {
    const requestedFor = sessionUser.current;
    try { const result = await transport.snapshot(); if (requestedFor !== sessionUser.current) return; setData(result); if (!isDemo && result.role) setRole(result.role); setError(''); setLastSync(Date.now()); }
    catch (e) { if (requestedFor === sessionUser.current) setError(e.message); }
    finally { if (requestedFor === sessionUser.current) setLoading(false); }
    })(); pendingRefresh.current = work;
    try { await work; } finally { if (pendingRefresh.current === work) pendingRefresh.current = null; }
  }, []);
  useEffect(() => {
    if (isDemo) { setSession(null); return; }
    const updateSession = s => {
      const nextUser = s?.user.id || null;
      if (nextUser !== sessionUser.current) {
        sessionUser.current = nextUser;
        setData({ buses: [], stops: [], dispatches: [] }); setRole('student'); setLoading(true); setError(''); setLastSync(null);
      }
      setSession(s);
    };
    client.auth.getSession().then(({ data, error }) => { if (error) setError(error.message); updateSession(data.session); });
    const { data: listener } = client.auth.onAuthStateChange((_event, s) => updateSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!isDemo && !session) return;
    const loop = createRefreshLoop(refresh, { interval: isDemo ? 1000 : 5000 });
    loop.refresh(); const unsubscribe = transport.subscribe(loop.notify);
    const wake = () => loop.refresh();
    document.addEventListener('visibilitychange', wake); window.addEventListener('online', wake);
    return () => { loop.stop(); unsubscribe(); document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake); };
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
