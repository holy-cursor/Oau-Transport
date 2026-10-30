import React, { useEffect, useRef, useState } from 'react';
import { LocateFixed, Minus, Plus, MapPin, RotateCcw } from 'lucide-react';
import { age, isOnline } from './domain.js';
import { closeMapZoom, initialMapPoint, validMapPoint } from './services/mapView.js';
import './map.css';

const shuttleIcon = '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="16" rx="4"/><path d="M5 10h14M8 19v2m8-2v2M8 14h1m6 0h1M9 6h6"/></svg>';
export default function CampusMap({ stops, buses, selected, onSelect, focus, onLocate, locating = false, children }) {
  const container = useRef(null), map = useRef(null), layers = useRef(null), person = useRef(null);
  const initial = useRef(initialMapPoint(stops, selected));
  const [ready, setReady] = useState(!!window.L), [failed, setFailed] = useState(false), [tileError, setTileError] = useState(false), [close, setClose] = useState(true), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (ready) return;
    setFailed(false);
    if (attempt) {
      const script = document.createElement('script'); script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; script.async = true; document.head.appendChild(script);
    }
    const timer = setInterval(() => { if (window.L) setReady(true); }, 300);
    const timeout = setTimeout(() => setFailed(true), 10000);
    return () => { clearInterval(timer); clearTimeout(timeout); };
  }, [ready, attempt]);
  useEffect(() => {
    if (!ready) return;
    const L = window.L, point = initial.current;
    const instance = L.map(container.current, { zoomControl: false, scrollWheelZoom: false }).setView([point.lat, point.lng], closeMapZoom);
    map.current = instance;
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 });
    tiles.on('tileerror', () => setTileError(true)).on('tileload', () => setTileError(false)).addTo(instance);
    layers.current = L.layerGroup().addTo(instance); person.current = L.layerGroup().addTo(instance);
    instance.on('zoomend', () => setClose(instance.getZoom() >= 16));
    const observer = new ResizeObserver(() => instance.invalidateSize()); observer.observe(container.current);
    return () => { observer.disconnect(); instance.remove(); map.current = null; layers.current = null; person.current = null; };
  }, [ready]);
  useEffect(() => {
    if (!ready || !layers.current) return;
    const L = window.L; layers.current.clearLayers();
    stops.filter(validMapPoint).forEach(stop => {
      const level = [0, 1, 2, 3].includes(stop.level) ? stop.level : 0;
      const marker = L.marker([stop.lat, stop.lng], { keyboard: true, title: stop.name, alt: stop.name, icon: L.divIcon({ className: 'transit-stop-icon', html: `<span class="transit-stop-pin queue-${level} ${selected === stop.id ? 'is-selected' : ''}"><span></span></span>`, iconSize: [28, 28], iconAnchor: [14, 14] }) });
      const label = document.createElement('span'); label.textContent = stop.name + (Number.isFinite(stop.queue_count) ? ` (~${stop.queue_count})` : '');
      marker.bindTooltip(label, { permanent: close || selected === stop.id, direction: 'bottom', offset: [0, 12], className: 'transit-stop-label' }).on('click', () => onSelect?.(stop.id)).addTo(layers.current);
    });
    buses.filter(bus => validMapPoint({ lat: bus.last_lat, lng: bus.last_lng })).forEach(bus => {
      const online = isOnline(bus);
      const marker = L.marker([bus.last_lat, bus.last_lng], { zIndexOffset: 300, title: bus.name, icon: L.divIcon({ className: 'transit-vehicle-icon', html: `<span class="transit-vehicle ${online ? '' : 'is-offline'}">${shuttleIcon}</span>`, iconSize: [42, 42], iconAnchor: [21, 21] }) });
      const tooltip = document.createElement('span'); tooltip.textContent = `${bus.name} · ${online ? (bus.status || 'Active').replaceAll('_', ' ') : 'Offline'} · ${age(bus.last_seen)}`;
      marker.bindTooltip(tooltip, { direction: 'top', className: 'transit-vehicle-label' }).addTo(layers.current);
    });
  }, [stops, buses, selected, onSelect, ready, close]);
  useEffect(() => {
    const stop = stops.find(item => item.id === selected);
    if (map.current && validMapPoint(stop)) map.current.flyTo([stop.lat, stop.lng], closeMapZoom, { duration: .45 });
  }, [selected, ready]);
  useEffect(() => {
    if (!map.current || !person.current || !validMapPoint(focus)) return;
    const L = window.L; person.current.clearLayers();
    if (Number.isFinite(focus.accuracy) && focus.accuracy > 0) L.circle([focus.lat, focus.lng], { radius: Math.min(focus.accuracy, 150), stroke: false, fillColor: '#6481ed', fillOpacity: .12, interactive: false }).addTo(person.current);
    L.marker([focus.lat, focus.lng], { zIndexOffset: 500, title: 'Your location', icon: L.divIcon({ className: 'transit-person-icon', html: '<span class="transit-person"><span></span></span>', iconSize: [26, 26], iconAnchor: [13, 13] }) }).bindTooltip('Your location', { direction: 'top' }).addTo(person.current);
    map.current.flyTo([focus.lat, focus.lng], closeMapZoom, { duration: .5 });
  }, [focus, ready]);
  return <div className="map-container campus-map-shell"><div className="campus-map" ref={container} aria-label="Campus stops and shuttle locations"/>{!ready && <div className="map-placeholder" role="status"><span className="map-placeholder-icon"><MapPin size={26}/></span><strong>{failed ? 'Map unavailable' : 'Opening the campus map'}</strong><p>{failed ? 'You can still choose a stop from the list.' : 'Your nearby stops, in one place.'}</p>{failed && <button type="button" onClick={() => setAttempt(previous => previous + 1)}><RotateCcw size={15}/>Retry map</button>}</div>}{tileError && ready && <span className="map-tile-warning" role="status">Some map tiles could not load.</span>}{children}<div className="transit-map-controls">{onLocate && <button type="button" title="My location" aria-label="Centre map on my location" disabled={locating} onClick={onLocate}><LocateFixed size={21}/></button>}<div><button type="button" title="Zoom in" aria-label="Zoom in" disabled={!ready} onClick={() => map.current?.zoomIn()}><Plus size={20}/></button><button type="button" title="Zoom out" aria-label="Zoom out" disabled={!ready} onClick={() => map.current?.zoomOut()}><Minus size={20}/></button></div></div><div className="transit-map-key"><span><i className="key-stop"/>Stop</span><span><i className="key-vehicle"/>Shuttle</span></div></div>;
}
