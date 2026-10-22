import React, { useEffect, useRef, useState } from 'react';
import { age, isOnline } from './domain.js';
export default function CampusMap({ stops, buses, selected, onSelect }) {
  const container = useRef(null), map = useRef(null), layers = useRef(null);
  const [ready, setReady] = useState(!!window.L);
  useEffect(() => { if (ready) return; const timer = setInterval(() => { if (window.L) setReady(true); }, 500); return () => clearInterval(timer); }, [ready]);
  useEffect(() => {
    if (!ready) return;
    const L = window.L;
    map.current = L.map(container.current, { zoomControl: false }).setView([7.513, 4.526], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 }).addTo(map.current);
    L.control.zoom({ position: 'bottomright' }).addTo(map.current);
    layers.current = L.layerGroup().addTo(map.current);
    const observer = new ResizeObserver(() => map.current?.invalidateSize()); observer.observe(container.current);
    return () => { observer.disconnect(); map.current.remove(); map.current = null; };
  }, [ready]);
  useEffect(() => {
    if (!ready || !layers.current) return;
    const L = window.L;
    layers.current.clearLayers();
    stops.forEach(s => {
      const marker = L.marker([s.lat, s.lng], { icon: L.divIcon({ className: 'stop-marker', html: `<span class="map-stop level-${s.level} ${selected === s.id ? 'selected' : ''}">${s.level === 3 ? '!' : '•'}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] }) });
      const label = document.createElement('span'); label.textContent = s.name;
      marker.bindTooltip(label, { direction: 'top' }).on('click', () => onSelect(s.id)).addTo(layers.current);
    });
    buses.filter(b => b.last_lat != null).forEach(b => {
      const marker = L.marker([b.last_lat, b.last_lng], { icon: L.divIcon({ className: 'bus-marker', html: `<span class="map-bus ${!isOnline(b) ? 'offline' : ''}"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 11h14M8 19v2m8-2v2M8 15h1m6 0h1"/></svg></span>`, iconSize: [32,32], iconAnchor: [16,16] }) });
      const label = document.createElement('span'); label.textContent = `${b.name} · ${isOnline(b) ? b.status.replace('_', ' ') : 'Offline'} | Last location: ${age(b.last_seen)}`;
      marker.bindTooltip(label).addTo(layers.current);
    });
  }, [stops, buses, selected, onSelect, ready]);
  return <div className="map-container"><div className="campus-map" ref={container} aria-label="Map of campus shuttle positions and stops" />{!ready && <div className="map-unavailable">Map loading. If your connection is unavailable, use the stop list to dispatch.</div>}</div>;
}
