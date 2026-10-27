import React from 'react';
import { LEVELS, age } from '../../domain.js';
import QueueBadge from '../../components/QueueBadge.jsx';
export default function StopDemand({ stops }) {
  const sorted = [...stops].sort((a,b) => b.level - a.level);
  return <section className="panel stop-demand"><h2>Student requests by stop</h2><p>Anonymous queue reports from the last ten minutes. Your supervisor still assigns dispatches.</p>{sorted.map(stop => <article key={stop.id}><div><strong>{stop.name}</strong><small>{stop.report_count || 0} current reports / {stop.latest_report ? age(stop.latest_report) : 'No recent reports'}</small>{stop.dispatch_status && <small>Dispatch: {stop.dispatch_status}</small>}</div><QueueBadge level={stop.level}/></article>)}{!sorted.length && <p>No stops available yet.</p>}</section>;
}
