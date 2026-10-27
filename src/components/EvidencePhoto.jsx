import React, { useEffect, useState } from 'react';
import { transport } from '../data/index.js';
export default function EvidencePhoto({ path }) {
  const [url, setUrl] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { setUrl(''); setError(''); }, [path]);
  if (!path) return null;
  return <div className="evidence-photo">{url && <img src={url} alt="Report photo evidence" onError={() => { setUrl(''); setError('Photo link expired. Open it again.'); }}/>}<button className="text-button" type="button" disabled={busy} onClick={async () => {
    setBusy(true); try { setUrl(await transport.evidenceUrl(path)); setError(''); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }}>{busy ? 'Loading photo...' : url ? 'Refresh photo' : 'View photo'}</button>{error && <p role="status">{error}</p>}</div>;
}
