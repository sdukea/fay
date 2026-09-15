"use client";

import { priorityScore } from "@/lib/domain/scoring";
import type { HospitalDTO, IncidentDTO, ResourceDTO } from "@/types/domain";

const SEVERITY_HEX: Record<number, string> = {
  5: "var(--accent-red)",
  4: "var(--accent-amber)",
  3: "var(--accent-yellow)",
  2: "var(--text-tertiary)",
  1: "var(--text-tertiary)",
};

/**
 * Honest placeholder shown when NEXT_PUBLIC_MAPBOX_TOKEN is unset. Rather
 * than faking a geographic map with a scatter of dots, this states plainly
 * what's missing while keeping incident selection functional via a plain
 * list — the app must never show a blank panel, but it also must never
 * pretend a placeholder is the finished map.
 */
export function SchematicMap({
  incidents,
  resources,
  selectedIncidentId,
  onSelectIncident,
}: {
  incidents: IncidentDTO[];
  resources: ResourceDTO[];
  hospitals: HospitalDTO[];
  selectedIncidentId: string | null;
  onSelectIncident: (id: string) => void;
}) {
  const available = resources.filter((r) => r.status === "AVAILABLE").length;
  const sorted = [...incidents].sort(
    (a, b) =>
      priorityScore({ severity: b.severity, casualties: b.casualties, waitingMinutes: b.waitingSinceMinutes }) -
      priorityScore({ severity: a.severity, casualties: a.casualties, waitingMinutes: a.waitingSinceMinutes }),
  );

  return (
    <div className="relative h-full w-full bg-[var(--bg-inset)] flex flex-col items-center justify-center px-6 py-24">
      <div className="max-w-[420px] text-center mb-8">
        <div className="text-[14px] font-medium text-[var(--text-primary)] mb-1.5">Map needs a Mapbox token</div>
        <p className="text-[12.5px] text-[var(--text-tertiary)] leading-relaxed">
          Add a free <code className="text-[var(--accent-cyan)]">NEXT_PUBLIC_MAPBOX_TOKEN</code> in{" "}
          <code className="text-[var(--text-secondary)]">.env</code> to see the full geographic operational map. Everything below still works.
        </p>
      </div>

      <div className="flex items-center gap-6 mb-6 text-[12px] text-[var(--text-tertiary)]">
        <span>
          <span className="mono-tabular text-[var(--text-primary)]">{incidents.length}</span> active
        </span>
        <span>
          <span className="mono-tabular text-[var(--text-primary)]">{available}</span> / {resources.length} available
        </span>
      </div>

      <div className="w-full max-w-[420px] max-h-[40vh] overflow-y-auto flex flex-col gap-0.5">
        {sorted.slice(0, 12).map((incident) => (
          <button
            key={incident.id}
            onClick={() => onSelectIncident(incident.id)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-left transition-colors ${
              selectedIncidentId === incident.id ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: SEVERITY_HEX[incident.severity] }} />
            <span className="text-[12.5px] text-[var(--text-primary)] truncate flex-1">{incident.description}</span>
            <span className="text-[11px] text-[var(--text-tertiary)] shrink-0">{incident.zoneName}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
