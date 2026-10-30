import React, { useState } from 'react';
import { client } from '../../data/index.js';
export default function ChangePassword({ onDone }) {
 const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <form onSubmit={async e=>{e.preventDefault();if(busy)return;if(password!==confirm){setError('Passwords do not match.');return;}setBusy(true);try{const result=await client.auth.updateUser({password});if(result.error)throw result.error;onDone();}catch(e){setError(e.message);}finally{setBusy(false);}}}><label>New password<input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirm password<input required minLength={8} type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>{error&&<p className="auth-error" role="alert">{error}</p>}<button className="primary full" disabled={busy}>{busy?'Saving...':'Save password'}</button></form>;
}
