import React from 'react';
import { Search, X } from 'lucide-react';
export default function StopSearch({ value, onChange, label = 'Find a campus stop' }) {
  return <div className="stop-search"><Search size={18}/><input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={label} aria-label={label}/>{value && <button type="button" aria-label="Clear stop search" onClick={() => onChange('')}><X size={16}/></button>}</div>;
}
