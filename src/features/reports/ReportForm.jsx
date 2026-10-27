import React, { useState } from 'react';
import { transport } from '../../data/index.js';
import PhotoInput from '../../components/PhotoInput.jsx';
export default function ReportForm({ data, action, busy }) {
  const [issue, setIssue] = useState({ category: 'no_bus', subject: '', description: '', stop_id: '', vehicle_id: '', attempts: 1 });
  const [file, setFile] = useState(null);
  const field = key => e => setIssue(previous => ({ ...previous, [key]: e.target.value }));
  return <section className="panel issue-form"><h2>Report a problem</h2><p>Report a driver, supervisor or a bus that has not arrived. Supervisor complaints go to the super admin.</p><form onSubmit={async e => {
    e.preventDefault(); if (await action(() => transport.complain(issue, file), 'Your report was submitted. Check its progress below.')) {
      setIssue({ category: 'no_bus', subject: '', description: '', stop_id: '', vehicle_id: '', attempts: 1 }); setFile(null);
    }
  }}><label>Report about<select value={issue.category} onChange={field('category')}><option value="no_bus">No bus after requesting</option><option value="driver">Driver</option><option value="supervisor">Supervisor</option><option value="other">Other transport issue</option></select></label>
  <label>{issue.category === 'driver' || issue.category === 'supervisor' ? 'Name, vehicle or identifying details' : 'Short subject'}<input required minLength={3} maxLength={120} value={issue.subject} onChange={field('subject')}/></label>
  <label>Stop<select required={issue.category === 'no_bus'} value={issue.stop_id} onChange={field('stop_id')}><option value="">Select a stop</option>{data.stops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
  {issue.category === 'no_bus' && <label>How many requests have you made?<input type="number" required min={1} max={100} value={issue.attempts} onChange={field('attempts')}/></label>}
  <label>What happened?<textarea required minLength={20} maxLength={2000} value={issue.description} onChange={field('description')} placeholder="Include when it happened and enough details for the reviewer to follow up."/></label>
  <PhotoInput file={file} onChange={setFile} disabled={busy}/><button className="primary full" disabled={busy}>{busy ? 'Submitting...' : 'Submit issue report'}</button></form></section>;
}
