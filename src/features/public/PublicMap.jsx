import React, { useState } from 'react';
import { Bus, MapPin } from 'lucide-react';
import CampusMap from '../../Map.jsx';
import usePublicMap from '../../hooks/usePublicMap.js';
import { age, isOnline, LEVELS } from '../../domain.js';
import { transport } from '../../data/index.js';
import './public-map.css';

export default function PublicMap() {
  const { stops, buses, loading, error, updatedAt } = usePublicMap();
  const [selected, setSelected] = useState(null);
  const currentBuses = buses.filter(b => isOnline(b));
  const stop = stops.find(s => s.id === selected);
  return <section className="public-map-section" id="live-map" aria-labelledby="public-map-title">
    <div className="public-map-heading"><div><span className="landing-kicker">OPEN TO EVERYONE</span><h2 id="public-map-title">See vehicles around campus.</h2><p>No sign-in needed. Select a stop to check its queue level.</p></div><span className="public-vehicle-count"><Bus size={19}/>{loading ? 'Loading...' : `${currentBuses.length} sharing location`}</span></div>
    {transport.mode === 'demo' && <p className="public-map-notice">Demo map with sample vehicles. These are not live campus locations.</p>}
    {error && <p className="public-map-notice" role="status">{error}</p>}
    <div className="public-map-frame"><CampusMap stops={stops} buses={currentBuses} selected={selected} onSelect={setSelected}/></div>
    <div className="public-map-meta"><span>{stop ? `${stop.name}: ${LEVELS[stop.level]}` : 'Select a stop on the map or below.'}</span><span>{updatedAt ? `Map refreshed ${age(new Date(updatedAt).toISOString())}` : 'Waiting for location data'}</span></div>
    {!loading && !error && !currentBuses.length && <p className="public-map-notice">No vehicles are sharing a fresh location right now. Check again shortly.</p>}
    <div className="public-stop-list" aria-label="Campus stops">{stops.map(s => <button key={s.id} className={selected === s.id ? 'selected' : ''} onClick={() => setSelected(s.id)}><MapPin size={15}/><span>{s.name}<small>{LEVELS[s.level]}</small></span></button>)}</div>
    <p className="public-map-footnote">Locations update while drivers keep their tracking page visible. Vehicles disappear from this map after two minutes without an update. To report a queue, <a href="#app">sign in with your student email</a>.</p>
  </section>;
}
