import React, { useState } from 'react';

export default function CancelForm({ busy, onSubmit }) { const [reason, setReason] = useState(''); return <form onSubmit={e => { e.preventDefault(); onSubmit(reason); }}><label>Reason for cancellation<textarea required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="For example: driver unreachable"/></label><button className="primary full" disabled={busy || !reason.trim()}>Cancel dispatch</button></form>; }
