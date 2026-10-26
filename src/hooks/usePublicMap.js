import { useEffect, useState } from 'react';
import { transport } from '../data/index.js';

export default function usePublicMap() {
  const [state, setState] = useState({ stops: [], buses: [], loading: true, error: '', updatedAt: null });
  useEffect(() => {
    let disposed = false, pending = false;
    async function refresh() {
      if (disposed || pending || document.visibilityState !== 'visible') return;
      pending = true;
      try {
        if (!navigator.onLine) throw new Error('Offline');
        const data = await transport.publicMap();
        if (!disposed) setState({ ...data, loading: false, error: '', updatedAt: Date.now() });
      } catch {
        if (!disposed) setState(previous => ({ ...previous, loading: false, error: 'Live locations are unavailable. Check your connection or try again shortly.' }));
      } finally { pending = false; }
    }
    refresh();
    const timer = setInterval(refresh, 15000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    return () => {
      disposed = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
    };
  }, []);
  return state;
}
