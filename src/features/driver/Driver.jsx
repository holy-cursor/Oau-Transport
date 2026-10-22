import useDriverTracking from '../../hooks/useDriverTracking.js';
import React, { useState, useEffect, useRef } from 'react';
import { Bus, Navigation, Wifi } from 'lucide-react';
import { transport } from '../../data/index.js';
import { ACTIVE } from '../../domain.js';
import { position } from '../../services/location.js';
import Badge from '../../components/Badge.jsx';
const isDemo = transport.mode === 'demo';

export default function Driver({ data, action, refresh, userId }) {
  const bus = data.buses.find(b => b.driver_id === userId);
  const [starting, setStarting] = useState(false), [soundWarning, setSoundWarning] = useState('');
  const audio = useRef(null);
  const { sharing, signal, wakeWarning } = useDriverTracking(bus, refresh);
  const dispatch = data.dispatches.find(d => d.bus_id === bus?.id && ACTIVE.includes(d.status));
  useEffect(() => {
    if (dispatch?.status !== 'dispatched' || !audio.current) return;
    const ctx = audio.current; const osc = ctx.createOscillator(); const gain = ctx.createGain(); gain.gain.value = 0.1; osc.connect(gain); gain.connect(ctx.destination); osc.frequency.value = 700; osc.start(); osc.stop(ctx.currentTime + 0.35); navigator.vibrate?.([150, 80, 150]);
  }, [dispatch?.id, dispatch?.status]);
  if (!bus) return <div className="empty-state"><Bus size={30}/><h2>No shuttle assigned</h2><p>Ask your transport administrator to link your account to a shuttle.</p></div>;
  async function start() {
    setStarting(true);
    try { const AudioContext = window.AudioContext || window.webkitAudioContext; if (AudioContext) { audio.current ||= new AudioContext(); await audio.current.resume(); } } catch { setSoundWarning('Sound is unavailable. Watch for dispatch alerts on screen.'); }
    await action(async () => { const p = isDemo ? null : await position(); await transport.start(bus.id, p); }, 'Shift started. Keep this page visible and your screen awake.');
    setStarting(false);
  }
  async function end() { await action(() => transport.status(bus.id, 'off_duty'), 'Shift ended. Location sharing stopped.'); }
  return <><div className="page-heading"><div><div className="eyebrow">DRIVER WORKSPACE</div><h1>You keep campus moving.</h1><p>Start your shift when you’re ready. Keep this page open while sharing location.</p></div></div><section className="panel driver-panel"><div className="driver-top"><span className="feature-icon"><Bus size={28}/></span><div><h2>{bus.name}</h2><p>Your assigned shuttle</p></div><Badge status={bus.status}/></div><div className="driver-signal"><Wifi size={22}/><div><strong>{signal}</strong><p>{sharing ? 'Updates about every 10 seconds while this page is visible. After switching apps or locking your phone, reopen this page to resume. Operators see your last update until tracking returns.' : 'Location is only shared during an active shift.'}</p></div></div>{wakeWarning && sharing && <div className="alert">{wakeWarning}</div>}{soundWarning && <div className="alert">{soundWarning}</div>}{sharing ? <><label>My status<select value={bus.status} onChange={e => action(() => transport.status(bus.id, e.target.value), 'Availability updated.')}><option value="available">Available</option><option value="on_trip">On trip</option></select></label><button className="secondary full" onClick={end}>End shift</button></> : <><p className="consent">By starting your shift, you agree to share your location with the transport office for shuttle coordination. End shift stops sharing. Switching apps or locking the phone pauses updates; returning to this page resumes your active shift.</p><button className="primary full" disabled={starting} onClick={start}><Navigation size={17}/>{starting ? 'Getting location…' : 'Start shift'}</button></>}{dispatch && <div className="driver-dispatch" role="status"><span className="eyebrow">{dispatch.status === 'dispatched' ? 'NEW DISPATCH' : 'CURRENT ASSIGNMENT'}</span><h2>{data.stops.find(s => s.id === dispatch.stop_id)?.name}</h2><Badge status={dispatch.status}/><p>{dispatch.status === 'dispatched' ? 'The operator will call you. You do not need to tap to accept.' : 'Your operator has recorded this assignment.'}</p></div>}</section></>;
}
