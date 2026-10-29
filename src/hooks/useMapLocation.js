import { useCallback, useEffect, useRef, useState } from 'react';
import { validMapPoint } from '../services/mapView.js';

export default function useMapLocation({ requestOnOpen = false } = {}) {
  const [point, setPoint] = useState(null), [locating, setLocating] = useState(false), [locationError, setLocationError] = useState('');
  const active = useRef(true), pending = useRef(false);
  const locate = useCallback(() => {
    if (pending.current) return;
    if (!navigator.geolocation) { setLocationError('Location is not supported in this browser.'); return; }
    pending.current = true; setLocating(true); setLocationError('');
    navigator.geolocation.getCurrentPosition(result => {
      pending.current = false; if (!active.current) return;
      const next = { lat: result.coords.latitude, lng: result.coords.longitude, accuracy: result.coords.accuracy, receivedAt: Date.now() };
      if (validMapPoint(next)) setPoint(next); else setLocationError('Could not get your location.');
      setLocating(false);
    }, error => {
      pending.current = false; if (!active.current) return;
      setLocating(false); setLocationError(error.code === 1 ? 'Location is off. Choose a stop or enable location in your browser.' : 'Could not get your location. You can still choose a stop.');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  }, []);
  useEffect(() => {
    active.current = true;
    if (requestOnOpen) locate();
    else navigator.permissions?.query({ name: 'geolocation' }).then(result => { if (active.current && result.state === 'granted') locate(); }).catch(() => {});
    return () => { active.current = false; };
  }, [locate, requestOnOpen]);
  return { point, locate, locating, locationError };
}
