import { distanceMeters, isOnline } from './domain.js';

export const speedRanges = {
  bus: { min: 60, max: 70 },
  tricycle: { min: 28, max: 30 },
};

const validPoint = point => point && Number.isFinite(point.lat) && Number.isFinite(point.lng)
  && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;

export function travelEstimate(vehicle, stop, now = Date.now()) {
  const origin = { lat: vehicle.last_lat, lng: vehicle.last_lng };
  const speed = speedRanges[vehicle.vehicle_type || 'bus'];
  if (!speed || !isOnline(vehicle, now) || !validPoint(origin) || !validPoint(stop)) return null;
  const distanceKm = distanceMeters(origin, stop) / 1000;
  return {
    distanceKm,
    minSeconds: distanceKm / speed.max * 3600,
    maxSeconds: distanceKm / speed.min * 3600,
    comparisonSeconds: distanceKm / ((speed.min + speed.max) / 2) * 3600,
  };
}

export function rankVehicles(vehicles, stop, now = Date.now()) {
  return vehicles.map(vehicle => ({ vehicle, estimate: travelEstimate(vehicle, stop, now) }))
    .sort((a, b) => (a.estimate?.comparisonSeconds ?? Infinity) - (b.estimate?.comparisonSeconds ?? Infinity)
      || a.vehicle.name.localeCompare(b.vehicle.name));
}

export function formatTravel(estimate) {
  if (!estimate) return 'No fresh location';
  const min = Math.round(estimate.minSeconds), max = Math.round(estimate.maxSeconds);
  const time = max < 60 ? `${min}-${max} sec` : `${(min / 60).toFixed(1)}-${(max / 60).toFixed(1)} min`;
  return `${estimate.distanceKm.toFixed(2)} km direct / ${time}`;
}
