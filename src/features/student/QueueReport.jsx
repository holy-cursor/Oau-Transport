import React, { useState } from 'react';
import { MapPin, Users } from 'lucide-react';
import PhotoInput from '../../components/PhotoInput.jsx';
import { transport } from '../../data/index.js';
import { position } from '../../services/location.js';
import { LEVELS } from '../../domain.js';

export default function QueueReport({ stop, action, busy }) {
  const [level, setLevel] = useState(2), [photo, setPhoto] = useState(null), [count, setCount] = useState('');
  return <section className="student-queue-report"><div className="student-section-title"><Users size={18}/><h2>How's the queue?</h2></div><form onSubmit={async event => {
    event.preventDefault(); if (!stop || busy) return;
    const sent = await action(async () => { const location = transport.mode === 'demo' ? null : await position(); await transport.report(stop.id, level, location, photo, count === '' ? null : Number(count)); }, 'Queue report submitted.');
    if (sent) setPhoto(null);
  }}><div className="student-chosen-stop"><MapPin size={17}/><span>{stop ? stop.name : 'Choose a stop above'}</span></div><div className="student-queue-levels" role="group" aria-label="Queue level">{[1, 2, 3].map(value => <button key={value} type="button" aria-pressed={level === value} disabled={busy} className={`queue-choice ${level === value ? 'selected' : ''}`} onClick={() => setLevel(value)}><span className={`queue-density density-${value}`} aria-hidden="true">{[0,1,2].map(i => <i key={i}/>)}</span>{LEVELS[value]}</button>)}</div><label htmlFor="queue-count">People waiting (optional estimate)</label><input id="queue-count" type="number" min="0" max="500" value={count} onChange={e => setCount(e.target.value)} placeholder="e.g. 25" disabled={busy}/><PhotoInput file={photo} onChange={setPhoto} disabled={busy}/><button className="primary full student-report-submit" disabled={busy || !stop}>{busy ? 'Sending report...' : 'Report queue'}</button><p className="student-report-note">{transport.mode === 'demo' ? 'Demo reporting' : 'Be within 50 m of the stop to report.'} · 3 students confirm a queue.</p></form></section>;
}
