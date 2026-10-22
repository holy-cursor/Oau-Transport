import React, { useState } from 'react';
import { Clock3, Send } from 'lucide-react';
import { ACTIVE, LEVELS } from '../../domain.js';
import { rankVehicles, formatTravel, speedRanges } from '../../travel.js';

export default function DispatchForm({ data, available, initialStop, busy, onSubmit }) {
  const [stop, setStop] = useState(initialStop || data.stops[0]?.id || '');
  const destination = data.stops.find(s => s.id === stop);
  const ranked = rankVehicles(available, destination);
  const [bus, setBus] = useState(() => rankVehicles(available, data.stops.find(s => s.id === (initialStop || data.stops[0]?.id)))[0]?.vehicle.id || '');
  const [confirmed, setConfirmed] = useState(false);
  const duplicate = data.dispatches.some(d => d.stop_id === stop && ACTIVE.includes(d.status));
  const chosen = ranked.find(row => row.vehicle.id === bus);
  const speed = chosen && speedRanges[chosen.vehicle.vehicle_type || 'bus'];

  function chooseStop(id) {
    setStop(id);
    setConfirmed(false);
    setBus(rankVehicles(available, data.stops.find(s => s.id === id))[0]?.vehicle.id || '');
  }

  return <form onSubmit={e => { e.preventDefault(); onSubmit(bus, stop, confirmed); }}>
    <p className="form-intro">Create the dispatch, phone the driver and confirm acceptance from the dispatch list.</p>
    <label>Destination<select required value={stop} onChange={e => chooseStop(e.target.value)}>
      {data.stops.map(s => <option key={s.id} value={s.id}>{s.name} / {LEVELS[s.level]}</option>)}
    </select></label>
    <label>Available vehicle<select required value={bus} onChange={e => setBus(e.target.value)}>
      {ranked.map(({ vehicle, estimate }) => <option value={vehicle.id} key={vehicle.id}>{vehicle.name} ({vehicle.vehicle_type === 'tricycle' ? 'Tricycle' : 'Bus'}) / {formatTravel(estimate)}</option>)}
    </select></label>
    {chosen?.estimate && <div className="travel-comparison" role="status">
      <strong>Ideal travel time: {formatTravel(chosen.estimate)}</strong>
      <p>Uses direct distance and the supplied {speed.min}-{speed.max} km/h speed range. Road distance, traffic, boarding and phone confirmation are excluded. Actual travel can take longer. This is a comparison, not a confirmed ETA or a recommended driving speed.</p>
    </div>}
    <p className="form-note">Vehicles are sorted by direct-distance travel time using fresh locations. Confirm the route and availability with the driver.</p>
    {duplicate && <label className="checkbox-warning"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>A vehicle is already assigned to this stop. Send an additional vehicle.</label>}
    <div className="form-note"><Clock3 size={16}/>Unconfirmed dispatches expire after 3 minutes.</div>
    <button className="primary full" disabled={busy || !chosen || !destination || (duplicate && !confirmed)}><Send size={16}/>{busy ? 'Saving...' : 'Log dispatch'}</button>
  </form>;
}
