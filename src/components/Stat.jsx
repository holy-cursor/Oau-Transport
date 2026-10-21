import React from 'react';

export default function Stat({ label, value, suffix, icon: Icon, note, tone }) { return <article className="stat"><div className="stat-top"><span>{label}</span><Icon size={18}/></div><div className="stat-value">{value}<span>{suffix}</span></div><div className={`stat-note ${tone}`}><span/>{note}</div></article>; }
