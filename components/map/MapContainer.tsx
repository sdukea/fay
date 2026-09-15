"use client";

import dynamic from "next/dynamic";
import { SchematicMap } from "./SchematicMap";
import type { HospitalDTO, IncidentDTO, ResourceDTO } from "@/types/domain";

const OperationalMap = dynamic(() => import("./OperationalMap").then((m) => m.OperationalMap), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-[var(--bg-inset)] text-[11px] text-[var(--text-tertiary)]">
      Loading operational map…
    </div>
  ),
});

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export function MapContainer(props: {
  incidents: IncidentDTO[];
  resources: ResourceDTO[];
  hospitals: HospitalDTO[];
  selectedIncidentId: string | null;
  selectedResourceId: string | null;
  routeResource: ResourceDTO | null;
  focusIncidentIds?: string[] | null;
  onSelectIncident: (id: string) => void;
  onSelectResource: (id: string) => void;
}) {
  if (!MAPBOX_TOKEN) {
    return (
      <SchematicMap
        incidents={props.incidents}
        resources={props.resources}
        hospitals={props.hospitals}
        selectedIncidentId={props.selectedIncidentId}
        onSelectIncident={props.onSelectIncident}
      />
    );
  }

  return <OperationalMap {...props} />;
}
