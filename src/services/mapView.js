export const campusCentre = { lat: 7.518379, lng: 4.520709 };
export const closeMapZoom = 17;
export function validMapPoint(point) {
  return !!point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}
export function initialMapPoint(stops, selected) {
  return stops.find(stop => stop.id === selected && validMapPoint(stop)) || stops.find(stop => stop.name === 'SUB' && validMapPoint(stop)) || campusCentre;
}
