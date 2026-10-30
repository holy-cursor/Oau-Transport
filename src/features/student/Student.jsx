import React, { useMemo, useState } from 'react';
import { Bus, MapPin, MessageSquare, Navigation, Radio } from 'lucide-react';
import CampusMap from '../../Map.jsx';
import StopSearch from '../../components/StopSearch.jsx';
import QueueArrival from './QueueArrival.jsx';
import { queueCountLabel } from '../../services/queueStatus.js';
import useMapLocation from '../../hooks/useMapLocation.js';
import QueueReport from './QueueReport.jsx';
import { distanceMeters, isOnline, LEVELS } from '../../domain.js';
import { transport } from '../../data/index.js';
import './student.css';

const dispatchLabel = status => status === 'arrived' ? 'Shuttle at stop' : ['dispatched', 'accepted'].includes(status) ? 'Shuttle dispatched' : 'No dispatch yet';
export default function Student({ data, action, busy, onReportIssue }) {
  const [selected, setSelected] = useState(''), [query, setQuery] = useState('');
  const buses = data.buses, loading = false, error = '';
  const { point, locate, locating, locationError } = useMapLocation({ requestOnOpen: transport.mode !== 'demo' });
  const vehicles = buses.filter(bus => isOnline(bus)), stop = data.stops.find(item => item.id === selected);
  const nearby = useMemo(() => data.stops.filter(item => item.name.toLowerCase().includes(query.toLowerCase().trim())).map(item => ({ ...item, distance: point ? distanceMeters(point, item) : null })).sort((a, b) => point ? a.distance - b.distance : 0), [data.stops, query, point]);
  return <div className="student-dashboard"><header className="student-heading"><div><span className="eyebrow">OAU TRANSIT</span><h1>Your campus. Your next stop.</h1></div><button type="button" className="student-issue-link" onClick={onReportIssue}><MessageSquare size={16}/>Report a problem</button></header><div className="student-map-layout"><section className="student-map-panel" aria-label="Live campus map"><CampusMap stops={data.stops} buses={vehicles} selected={selected} onSelect={setSelected} focus={point} onLocate={locate} locating={locating}><div className="student-map-top"><StopSearch value={query} onChange={setQuery}/><span className="student-location-label"><Navigation size={13}/>{point ? 'Near your location' : 'OAU campus'}</span></div><div className="student-map-live"><Radio size={14}/>{transport.mode === 'demo' ? 'Demo locations' : loading ? 'Connecting...' : `${vehicles.length} vehicles online`}</div>{stop && <div className="student-map-selection"><MapPin size={15}/><strong>{stop.name}</strong><span>{dispatchLabel(stop.dispatch_status)}</span></div>}</CampusMap>{(error || locationError) && <p className="student-map-message" role="status">{error || locationError}</p>}</section><aside className="student-bottom-sheet"><span className="student-sheet-handle" aria-hidden="true"/><div className="student-sheet-heading"><span className="student-sheet-icon"><Bus size={23}/></span><div><h2>{point ? 'Stops near you' : 'Choose your stop'}</h2><small>{data.stops.length} campus stops</small></div></div><div className="student-stop-options" aria-label="Choose a bus stop">{nearby.map(item => <button key={item.id} type="button" className={`student-stop-option ${selected === item.id ? 'selected' : ''}`} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}><span className="student-stop-dot"><MapPin size={16}/></span><span className="student-stop-info"><strong>{item.name}</strong><small>{item.distance === null ? dispatchLabel(item.dispatch_status) : item.distance < 1000 ? `${Math.round(item.distance)} m away` : `${(item.distance / 1000).toFixed(1)} km away`}</small></span><span className={`queue-chip queue-${item.level || 0}`}>{queueCountLabel(item)}</span></button>)}{!nearby.length && <p className="student-no-stops">No matching stops.</p>}</div><QueueArrival stop={stop} data={data}/><QueueReport stop={stop} action={action} busy={busy}/></aside></div></div>;
}
