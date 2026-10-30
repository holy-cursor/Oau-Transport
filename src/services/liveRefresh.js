export function createRefreshLoop(load, { interval = 5000, onError = () => {} } = {}) {
  let stopped = false, running = false, queued = false, debounce, timer;
  const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';
  async function refresh() {
    if (stopped || !visible() || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    if (running) { queued = true; return; }
    clearTimeout(timer); running = true;
    try { await load(); } catch (error) { onError(error); }
    finally {
      running = false;
      if (!stopped) {
        if (queued) { queued = false; debounce = setTimeout(refresh, 200); }
        else timer = setTimeout(refresh, interval + Math.random() * interval * .15);
      }
    }
  }
  const notify = () => { clearTimeout(debounce); debounce = setTimeout(refresh, 200); };
  const stop = () => { stopped = true; clearTimeout(timer); clearTimeout(debounce); };
  return { refresh, notify, stop };
}
