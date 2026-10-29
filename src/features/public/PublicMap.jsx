import React, { useState } from 'react';
import { Bus, MapPin, Radio } from 'lucide-react';
import CampusMap from '../../Map.jsx';
import StopSearch from '../../components/StopSearch.jsx';
import usePublicMap from '../../hooks/usePublicMap.js';
import useMapLocation from '../../hooks/useMapLocation.js';
import { age, isOnline, LEVELS } from '../../domain.js';
import { transport } from '../../data/index.js';
import './public-map.css';

export default function PublicMap() {
  const { stops, buses, loading, error, updatedAt } = usePublicMap();
  const { point, locate, locating, locationError } = useMapLocation();
  const [selected, setSelected] = useState(null), [query, setQuery] = useState('');
  const currentBuses = buses.filter(bus => isOnline(bus)), stop = stops.find(item => item.id === selected);
  const filtered = stops.filter(item => item.name.toLowerCase().includes(query.toLowerCase().trim()));
  return <section className="public-map-section" id="live-map" aria-labelledby="public-map-title"><div className="public-map-heading"><div><span className="landing-kicker">AROUND CAMPUS</span><h2 id="public-map-title">Find your next stop.</h2></div><span className="public-vehicle-count"><span/>{loading ? 'Connecting...' : `${currentBuses.length} vehicles online`}</span></div>{transport.mode === 'demo' && <p className="map-demo-label">Demo · Sample vehicles</p>}{error && <p className="public-map-notice" role="alert">{error}</p>}<div className="public-map-frame"><div className="public-map-canvas"><CampusMap stops={stops} buses={currentBuses} selected={selected} onSelect={setSelected} focus={point} onLocate={locate} locating={locating}><div className="public-map-search"><StopSearch value={query} onChange={setQuery}/></div>{stop && <div className="public-selected-stop"><span className="selected-stop-icon"><MapPin size={21}/></span><div><small>SELECTED STOP</small><strong>{stop.name}</strong></div><span className={`queue-chip queue-${stop.level || 0}`}>{LEVELS[stop.level] || LEVELS[0]}</span></div>}</CampusMap></div><div className="public-map-bottom"><div className="public-stop-list" aria-label="Campus stops">{filtered.map(item => <button type="button" key={item.id} className={selected === item.id ? 'selected' : ''} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}><MapPin size={15}/>{item.name}</button>)}{!filtered.length && <span className="stop-search-empty">No matching stops.</span>}</div><div className="public-map-meta"><span><Radio size={13}/>{updatedAt ? `Updated ${age(new Date(updatedAt).toISOString())}` : 'Waiting for updates'}</span><span><Bus size={14}/>{currentBuses.length ? 'Fresh vehicle locations' : 'No vehicles sharing location'}</span></div></div></div>{locationError && <p className="public-map-notice" role="status">{locationError}</p>}<p className="public-map-footnote">Locations disappear after 2 minutes without an update. <a href="#app">Sign in to report a queue.</a></p></section>;
}
