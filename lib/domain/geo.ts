import type { GeoPoint } from "@/types/domain";

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Urban emergency-response speed model: faster on arterial distance, with a
 * fixed turnout delay. Congestion multiplier (>1 slows travel) lets traffic
 * scenarios degrade ETA without touching the distance calculation.
 */
export function etaMinutes(distanceKm: number, congestionMultiplier = 1): number {
  const turnoutMinutes = 1.1;
  const avgSpeedKmh = 34 / congestionMultiplier;
  const travelMinutes = (distanceKm / avgSpeedKmh) * 60;
  return round1(turnoutMinutes + travelMinutes);
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
