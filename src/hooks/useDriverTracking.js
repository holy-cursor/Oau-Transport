import { useEffect, useState } from 'react';
import { transport } from '../data/index.js';
import { position } from '../services/location.js';

export default function useDriverTracking(bus, refresh) {
  const active = !!bus?.shift_active;
  const [signal, setSignal] = useState('Not sharing');
  const [wakeWarning, setWakeWarning] = useState('');

  useEffect(() => {
    if (!active || !bus?.id) {
      setSignal('Not sharing');
      setWakeWarning('');
      return;
    }
    if (transport.mode === 'demo') { setSignal('Simulated GPS active'); return; }
    let disposed = false, running = false, wake = null, acquiringWake = false;
    const visible = () => document.visibilityState === 'visible';

    async function holdScreen() {
      if (disposed || !visible() || wake || acquiringWake) return;
      if (!navigator.wakeLock) {
        setWakeWarning('Automatic screen wake is unavailable. Keep your screen awake while tracking.');
        return;
      }
      acquiringWake = true;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (disposed || !visible()) { await lock.release(); return; }
        wake = lock;
        setWakeWarning('');
        lock.addEventListener('release', () => {
          if (wake === lock) wake = null;
          if (!disposed && visible()) setWakeWarning('Screen wake was released. Keep your screen awake while tracking.');
        });
      } catch {
        if (!disposed && visible()) setWakeWarning('Keep your screen awake. The browser could not prevent screen locking.');
      } finally { acquiringWake = false; }
    }

    async function ping() {
      if (disposed || running || !visible() || !navigator.onLine) return;
      running = true;
      try {
        const location = transport.mode === 'demo' ? null : await position();
        if (disposed || !visible() || !navigator.onLine) return;
        await transport.location(bus.id, location);
        if (!disposed && visible()) { setSignal('Live'); await refresh(); }
      } catch (error) {
        if (!disposed && visible()) setSignal(navigator.onLine ? `Reconnecting: ${error.message}` : 'Offline. Waiting for internet.');
      } finally { running = false; }
    }

    function resume() {
      if (disposed) return;
      if (!visible()) {
        setSignal('Tracking paused while this page is in the background.');
        wake?.release().catch(() => {});
        return;
      }
      holdScreen();
      refresh();
      if (!navigator.onLine) { setSignal('Offline. Waiting for internet.'); return; }
      setSignal('Resuming location sharing...');
      ping();
    }

    resume();
    const timer = setInterval(ping, 10000);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('pageshow', resume);
    window.addEventListener('online', resume);
    window.addEventListener('offline', resume);
    return () => {
      disposed = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('pageshow', resume);
      window.removeEventListener('online', resume);
      window.removeEventListener('offline', resume);
      wake?.release().catch(() => {});
    };
  }, [active, bus?.id, refresh]);

  return { sharing: active, signal, wakeWarning };
}
