import type { GeoPoint } from "@/types/domain";

/**
 * Fetches a real, road-snapped route from Mapbox's Directions API so routes
 * follow actual streets instead of a straight line through buildings. Falls
 * back to a two-point straight line if the request fails (offline, rate
 * limited, or no token) — the map must never show a broken route.
 */
export async function fetchRoute(from: GeoPoint, to: GeoPoint): Promise<[number, number][] | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${token}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Directions API ${res.status}`);
    const data = await res.json();
    const geometry = data?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
    if (geometry && geometry.length > 1) return geometry;
  } catch {
    // fall through to the straight-line fallback below
  }
  return [
    [from.longitude, from.latitude],
    [to.longitude, to.latitude],
  ];
}
