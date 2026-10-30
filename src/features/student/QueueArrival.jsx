import React from 'react';
import { queueAgeMinutes, queueCountLabel, stopArrivals, arrivalLabel } from '../../services/queueStatus.js';
export default function QueueArrival({ stop, data }) {
  if (!stop) return null;
  const age = queueAgeMinutes(stop), arrivals = stopArrivals(stop, data);
  return <section className="queue-arrivals" aria-live="polite"><h3>{queueCountLabel(stop)}</h3><p>{age === null ? 'No current queue timing' : `Queue reported ${age} min ago`}</p>{arrivals.length ? arrivals.map(a => <article key={a.dispatch.id}><strong>{a.vehicle?.name || 'Shuttle'}: {arrivalLabel(a)}</strong><small>{a.dispatch.status === 'dispatched' ? 'Awaiting driver confirmation' : a.dispatch.status === 'arrived' ? 'Ready for boarding' : 'Driver en route'}</small></article>) : <p>No shuttle dispatched yet.</p>}<small>Approximate count and arrival time. Queue age is not your personal waiting time.</small></section>;
}
