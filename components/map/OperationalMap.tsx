"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef } from "react";
import {
  RESOURCE_COLOR,
  SEVERITY_COLOR,
  SOURCE_IDS,
  coverageToGeoJSON,
  emptyLineFeatureCollection,
  hospitalsToGeoJSON,
  incidentsToGeoJSON,
  resourcesToGeoJSON,
} from "./mapStyleLayers";
import { fetchRoute } from "./directions";
import { travelProgress } from "@/lib/domain/lifecycle";
import type { HospitalDTO, IncidentDTO, ResourceDTO } from "@/types/domain";

interface RouteCacheEntry {
  incidentId: string;
  coords: [number, number][] | null;
  fetching: boolean;
}

/**
 * A resource's true current position: pinned at the incident once ON_SCENE,
 * interpolated along its cached route while EN_ROUTE (kicking off a route
 * fetch if none is cached yet), or its stored DB position otherwise. Shared
 * by the continuous animation loop and the one-off "fly to this resource"
 * effect so both agree on where a unit actually is right now.
 */
function computeResourcePosition(
  resource: ResourceDTO,
  incidents: IncidentDTO[],
  cache: Map<string, RouteCacheEntry>,
): [number, number] {
  if (resource.status === "ON_SCENE" && resource.currentIncidentCode) {
    const incident = incidents.find((i) => i.code === resource.currentIncidentCode);
    if (incident) return [incident.longitude, incident.latitude];
  }

  if (resource.status === "EN_ROUTE" && resource.currentIncidentCode) {
    const incident = incidents.find((i) => i.code === resource.currentIncidentCode);
    if (incident && incident.assignedAt && incident.assignedEtaMinutes != null) {
      let entry = cache.get(resource.id);
      if (!entry || entry.incidentId !== incident.id) {
        entry = { incidentId: incident.id, coords: null, fetching: false };
        cache.set(resource.id, entry);
      }
      if (!entry.coords && !entry.fetching) {
        entry.fetching = true;
        const incidentId = incident.id;
        fetchRoute(resource, incident).then((coords) => {
          const current = cache.get(resource.id);
          if (current && current.incidentId === incidentId) {
            current.coords = coords;
            current.fetching = false;
          }
        });
      }
      if (entry.coords && entry.coords.length >= 2) {
        const progress = travelProgress(new Date(incident.assignedAt).getTime(), incident.assignedEtaMinutes, Date.now());
        const idx = progress * (entry.coords.length - 1);
        const i0 = Math.floor(idx);
        const i1 = Math.min(entry.coords.length - 1, i0 + 1);
        const t = idx - i0;
        return [
          entry.coords[i0][0] + (entry.coords[i1][0] - entry.coords[i0][0]) * t,
          entry.coords[i0][1] + (entry.coords[i1][1] - entry.coords[i0][1]) * t,
        ];
      }
    }
  }

  return [resource.longitude, resource.latitude];
}

const BENGALURU_CENTER: [number, number] = [77.62, 12.965];

interface OperationalMapProps {
  incidents: IncidentDTO[];
  resources: ResourceDTO[];
  hospitals: HospitalDTO[];
  selectedIncidentId: string | null;
  selectedResourceId: string | null;
  routeResource: ResourceDTO | null;
  focusIncidentIds?: string[] | null;
  onSelectIncident: (id: string) => void;
  onSelectResource: (id: string) => void;
}

export function OperationalMap({
  incidents,
  resources,
  hospitals,
  selectedIncidentId,
  selectedResourceId,
  routeResource,
  focusIncidentIds,
  onSelectIncident,
  onSelectResource,
}: OperationalMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const loadedRef = useRef(false);
  const routeAnimRef = useRef<number | null>(null);
  const callbacksRef = useRef({ onSelectIncident, onSelectResource });
  useEffect(() => {
    callbacksRef.current = { onSelectIncident, onSelectResource };
  }, [onSelectIncident, onSelectResource]);

  // Latest incidents/resources for the position-animation loop below, which
  // runs on its own interval rather than re-subscribing to props each render.
  const dataRef = useRef({ incidents, resources });
  useEffect(() => {
    dataRef.current = { incidents, resources };
  }, [incidents, resources]);
  const resourceRoutesRef = useRef<Map<string, RouteCacheEntry>>(new Map());
  const positionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: BENGALURU_CENTER,
      zoom: 12,
      pitch: 48,
      bearing: -8,
      antialias: true,
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true, showCompass: false }), "bottom-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");

    map.on("load", () => {
      map.setFog({
        color: "rgb(8, 11, 18)",
        "high-color": "rgb(20, 28, 46)",
        "horizon-blend": 0.25,
        "space-color": "rgb(3, 4, 8)",
        "star-intensity": 0.15,
      });

      map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });
      map.setTerrain({ source: "mapbox-dem", exaggeration: 1.1 });

      const labelLayerId = map
        .getStyle()
        ?.layers?.find((l) => l.type === "symbol" && l.layout && (l.layout as { "text-field"?: unknown })["text-field"])?.id;

      map.addLayer(
        {
          id: "fay-3d-buildings",
          source: "composite",
          "source-layer": "building",
          type: "fill-extrusion",
          minzoom: 13,
          paint: {
            "fill-extrusion-color": "#1a2233",
            "fill-extrusion-height": ["coalesce", ["get", "height"], 8],
            "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
            "fill-extrusion-opacity": 0.6,
          },
        },
        labelLayerId,
      );

      map.addSource(SOURCE_IDS.coverage, { type: "geojson", data: coverageToGeoJSON([]) });
      map.addLayer({
        id: "fay-coverage-fill",
        type: "circle",
        source: SOURCE_IDS.coverage,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 18, 14, 80],
          "circle-color": "#35d0d0",
          "circle-opacity": 0.05,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#35d0d0",
          "circle-stroke-opacity": 0.12,
        },
      });

      // Alternate (non-recommended) route — subtle, drawn under the primary route.
      map.addSource(SOURCE_IDS.route + "-alt", { type: "geojson", data: emptyLineFeatureCollection() });
      map.addLayer({
        id: "fay-route-line-alt",
        type: "line",
        source: SOURCE_IDS.route + "-alt",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#9aa7bd", "line-width": 2, "line-opacity": 0.25, "line-dasharray": [0.4, 1.6] },
      });

      map.addSource(SOURCE_IDS.route, { type: "geojson", data: emptyLineFeatureCollection() });
      map.addLayer({
        id: "fay-route-line-glow",
        type: "line",
        source: SOURCE_IDS.route,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#35d0d0", "line-width": 8, "line-opacity": 0.12, "line-blur": 2 },
      });
      map.addLayer({
        id: "fay-route-line",
        type: "line",
        source: SOURCE_IDS.route,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#35d0d0", "line-width": 2.75, "line-opacity": 0.95 },
      });

      map.addSource(SOURCE_IDS.hospitals, { type: "geojson", data: hospitalsToGeoJSON([]) });
      map.addLayer({
        id: "fay-hospitals-layer",
        type: "circle",
        source: SOURCE_IDS.hospitals,
        paint: {
          "circle-radius": 5,
          "circle-color": "#0d1119",
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#5b8def",
        },
      });

      map.addSource(SOURCE_IDS.resources, { type: "geojson", data: resourcesToGeoJSON([]) });
      map.addLayer({
        id: "fay-resources-layer",
        type: "circle",
        source: SOURCE_IDS.resources,
        paint: {
          "circle-radius": 4,
          "circle-color": RESOURCE_COLOR as unknown as mapboxgl.Expression,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#05070b",
        },
      });

      map.addSource(SOURCE_IDS.incidents, { type: "geojson", data: incidentsToGeoJSON([]) });
      map.addLayer({
        id: "fay-incidents-glow",
        type: "circle",
        source: SOURCE_IDS.incidents,
        filter: [">=", ["get", "severity"], 4],
        paint: {
          "circle-radius": 16,
          "circle-color": SEVERITY_COLOR as unknown as mapboxgl.Expression,
          "circle-opacity": 0.12,
        },
      });
      map.addLayer({
        id: "fay-incidents-layer",
        type: "circle",
        source: SOURCE_IDS.incidents,
        paint: {
          "circle-radius": ["step", ["get", "severity"], 5, 4, 7],
          "circle-color": SEVERITY_COLOR as unknown as mapboxgl.Expression,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#05070b",
        },
      });
      map.addLayer({
        id: "fay-incidents-selected-ring",
        type: "circle",
        source: SOURCE_IDS.incidents,
        filter: ["==", ["get", "id"], "__none__"],
        paint: {
          "circle-radius": 13,
          "circle-color": "transparent",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#e8edf5",
          "circle-stroke-opacity": 0.8,
        },
      });
      map.addLayer({
        id: "fay-resources-selected-ring",
        type: "circle",
        source: SOURCE_IDS.resources,
        filter: ["==", ["get", "id"], "__none__"],
        paint: {
          "circle-radius": 9,
          "circle-color": "transparent",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#e8edf5",
          "circle-stroke-opacity": 0.85,
        },
      });

      map.on("click", "fay-incidents-layer", (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) callbacksRef.current.onSelectIncident(id);
      });
      map.on("click", "fay-resources-layer", (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) callbacksRef.current.onSelectResource(id);
      });
      for (const layer of ["fay-incidents-layer", "fay-resources-layer"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }

      loadedRef.current = true;
      applyData();

      // Resource movement: an EN_ROUTE unit's marker interpolates along its real
      // route toward the incident (fetched once per assignment, then cached) in
      // sync with the same travelProgress() formula the server uses to decide
      // when it has actually arrived — so the marker reaches the incident right
      // as the backend flips it to ON_SCENE, not before or after. An ON_SCENE
      // unit is pinned exactly at the incident (its stored lat/lon is still its
      // pickup point, since dispatch never rewrites the DB position).
      positionIntervalRef.current = setInterval(() => {
        const { incidents: liveIncidents, resources: liveResources } = dataRef.current;
        const cache = resourceRoutesRef.current;
        let changed = false;

        for (const resource of liveResources) {
          if (resource.status !== "EN_ROUTE") cache.delete(resource.id);
        }

        const animated = liveResources.map((resource) => {
          const [lng, lat] = computeResourcePosition(resource, liveIncidents, cache);
          if (lng === resource.longitude && lat === resource.latitude) return resource;
          changed = true;
          return { ...resource, longitude: lng, latitude: lat };
        });

        if (changed) {
          (map.getSource(SOURCE_IDS.resources) as mapboxgl.GeoJSONSource | undefined)?.setData(resourcesToGeoJSON(animated));
        }
      }, 150);

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduceMotion) {
        let pulseFrame: number;
        const startedAt = performance.now();
        const pulse = (now: number) => {
          const t = ((now - startedAt) / 1400) % 1;
          const wave = (Math.sin(t * Math.PI * 2) + 1) / 2; // 0..1
          if (map.getLayer("fay-incidents-glow")) {
            map.setPaintProperty("fay-incidents-glow", "circle-radius", 14 + wave * 8);
            map.setPaintProperty("fay-incidents-glow", "circle-opacity", 0.08 + wave * 0.1);
          }
          pulseFrame = requestAnimationFrame(pulse);
        };
        pulseFrame = requestAnimationFrame(pulse);
        map.once("remove", () => cancelAnimationFrame(pulseFrame));
      }
    });

    function applyData() {
      if (!loadedRef.current) return;
      (map.getSource(SOURCE_IDS.incidents) as mapboxgl.GeoJSONSource | undefined)?.setData(incidentsToGeoJSON(incidents));
      (map.getSource(SOURCE_IDS.resources) as mapboxgl.GeoJSONSource | undefined)?.setData(resourcesToGeoJSON(resources));
      (map.getSource(SOURCE_IDS.hospitals) as mapboxgl.GeoJSONSource | undefined)?.setData(hospitalsToGeoJSON(hospitals));
      (map.getSource(SOURCE_IDS.coverage) as mapboxgl.GeoJSONSource | undefined)?.setData(coverageToGeoJSON(resources));
    }

    return () => {
      if (routeAnimRef.current) cancelAnimationFrame(routeAnimRef.current);
      if (positionIntervalRef.current) clearInterval(positionIntervalRef.current);
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    (map.getSource(SOURCE_IDS.incidents) as mapboxgl.GeoJSONSource | undefined)?.setData(incidentsToGeoJSON(incidents));
    (map.getSource(SOURCE_IDS.hospitals) as mapboxgl.GeoJSONSource | undefined)?.setData(hospitalsToGeoJSON(hospitals));
    (map.getSource(SOURCE_IDS.coverage) as mapboxgl.GeoJSONSource | undefined)?.setData(coverageToGeoJSON(resources));
    // Resources are intentionally NOT updated here — the position-animation
    // interval (started once in the map-init effect) owns that source
    // exclusively, reading fresh data via dataRef every ~150ms. Updating it
    // here too would snap EN_ROUTE/ON_SCENE markers back to their raw,
    // un-animated DB position on every ~3s poll.
  }, [incidents, resources, hospitals]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    map.setFilter("fay-incidents-selected-ring", ["==", ["get", "id"], selectedIncidentId ?? "__none__"]);

    if (!selectedIncidentId) return;
    const incident = incidents.find((i) => i.id === selectedIncidentId);
    if (!incident) return;
    map.flyTo({ center: [incident.longitude, incident.latitude], zoom: Math.max(map.getZoom(), 14.5), pitch: 55, duration: 1000, essential: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIncidentId]);

  // Clicking a resource flies to wherever it actually is right now — mid-route
  // if EN_ROUTE, at the incident if ON_SCENE, at base if AVAILABLE/OFFLINE —
  // using the same position function the movement animation uses, not the
  // resource's static home coordinates.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    map.setFilter("fay-resources-selected-ring", ["==", ["get", "id"], selectedResourceId ?? "__none__"]);

    if (!selectedResourceId) return;
    const resource = resources.find((r) => r.id === selectedResourceId);
    if (!resource) return;
    const [lng, lat] = computeResourcePosition(resource, incidents, resourceRoutesRef.current);
    map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15), pitch: 55, duration: 1000, essential: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedResourceId]);

  // Draw the real, road-snapped route from the responding resource to the selected
  // incident (Mapbox Directions API), animated on as a "the system is reasoning"
  // cue rather than snapping the line in instantly.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const routeSource = map.getSource(SOURCE_IDS.route) as mapboxgl.GeoJSONSource | undefined;
    const altSource = map.getSource(SOURCE_IDS.route + "-alt") as mapboxgl.GeoJSONSource | undefined;
    if (!routeSource || !altSource) return;

    if (routeAnimRef.current) {
      cancelAnimationFrame(routeAnimRef.current);
      routeAnimRef.current = null;
    }

    const incident = incidents.find((i) => i.id === selectedIncidentId);
    if (!incident || !routeResource) {
      routeSource.setData(emptyLineFeatureCollection());
      altSource.setData(emptyLineFeatureCollection());
      return;
    }

    let cancelled = false;
    fetchRoute(routeResource, incident).then((coords) => {
      if (cancelled || !coords) return;
      const start = performance.now();
      const duration = 650;

      function tick(now: number) {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const sliceEnd = Math.max(2, Math.round(coords!.length * eased));
        routeSource!.setData({
          type: "FeatureCollection",
          features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords!.slice(0, sliceEnd) } }],
        });
        if (t < 1) {
          routeAnimRef.current = requestAnimationFrame(tick);
        }
      }
      routeAnimRef.current = requestAnimationFrame(tick);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedIncidentId, routeResource, incidents]);

  // OPTIMIZE mode: frame every incident the proposed plan touches, so the
  // operator sees the affected region rather than the last-viewed corner.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !focusIncidentIds || focusIncidentIds.length === 0) return;
    const points = incidents.filter((i) => focusIncidentIds.includes(i.id));
    if (points.length === 0) return;

    const bounds = points.reduce(
      (b, p) => b.extend([p.longitude, p.latitude]),
      new mapboxgl.LngLatBounds([points[0].longitude, points[0].latitude], [points[0].longitude, points[0].latitude]),
    );
    map.fitBounds(bounds, { padding: 140, pitch: 40, duration: 1100, maxZoom: 15 });
  }, [focusIncidentIds, incidents]);

  return <div ref={containerRef} className="h-full w-full" />;
}
