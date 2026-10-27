import React, { useEffect, useId, useRef, useState } from 'react';
import { validateEvidence } from '../services/evidence.js';
export default function PhotoInput({ file, onChange, disabled }) {
  const [preview, setPreview] = useState(''), [error, setError] = useState('');
  const input = useRef(null), id = useId();
  useEffect(() => {
    if (!file) { setPreview(''); if (input.current) input.current.value = ''; return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <div className="photo-input"><label htmlFor={id}>Photo evidence (optional)</label><input ref={input} id={id} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={e => {
    const chosen = e.target.files?.[0] || null;
    try { validateEvidence(chosen); setError(''); onChange(chosen); }
    catch (err) { setError(err.message); onChange(null); e.target.value = ''; }
  }}/><small>One JPEG, PNG or WebP photo, up to 5 MB. Photos are private to your report and authorized reviewers.</small>{error && <p role="alert">{error}</p>}{preview && <><img src={preview} alt="Selected report evidence"/><button type="button" className="text-button" disabled={disabled} onClick={() => onChange(null)}>Remove photo</button></>}</div>;
}
