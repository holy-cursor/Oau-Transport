import React, { useState } from 'react';
import { Clock3, Send } from 'lucide-react';
import { ACTIVE, LEVELS } from '../../domain.js';

export default function DispatchForm({ data, available, initialStop, busy, onSubmit }) {
  const [bus, setBus] = useState(available[0]?.id || ''), [stop, setStop] = useState(initialStop || ''), [confirmed, setConfirmed] = useState(false);
  const duplicate = data.dispatches.some(d => d.stop_id === stop && ACTIVE.includes(d.status));
  return <form onSubmit={e => { e.preventDefault(); onSubmit(bus, stop, confirmed); }}><p className="form-intro">Create the dispatch first, then phone the driver. Confirm their acceptance from the dispatch list.</p><label>Destination<select required value={stop} onChange={e => { setStop(e.target.value); setConfirmed(false); }}>{data.stops.map(s => <option key={s.id} value={s.id}>{s.name} · {LEVELS[s.level]}</option>)}</select></label><label>Available shuttle<select required value={bus} onChange={e => setBus(e.target.value)}>{available.map(b => <option value={b.id} key={b.id}>{b.name}</option>)}</select></label>{duplicate && <label className="checkbox-warning"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>A bus is already assigned to this stop. Send an additional shuttle.</label>}<div className="form-note"><Clock3 size={16}/>Unconfirmed dispatches expire after 3 minutes.</div><button className="primary full" disabled={busy || !bus || (duplicate && !confirmed)}><Send size={16}/>{busy ? 'Saving…' : 'Log dispatch'}</button></form>;
}
