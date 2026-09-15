"use client";

import { useMemo, useState } from "react";
import { compatibility } from "@/lib/domain/scoring";
import { postDispatch } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import type { IncidentDTO, ResourceDTO, ResourceType } from "@/types/domain";

type StatusFilter = "ALL" | "AVAILABLE" | "EN_ROUTE" | "ON_SCENE" | "OFFLINE";
type TypeFilter = "ALL" | ResourceType;

const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: "AVAILABLE", label: "Available" },
  { key: "EN_ROUTE", label: "En route" },
  { key: "ON_SCENE", label: "On scene" },
  { key: "OFFLINE", label: "Offline" },
  { key: "ALL", label: "All" },
];

const TYPE_FILTERS: Array<{ key: TypeFilter; label: string }> = [
  { key: "ALL", label: "All types" },
  { key: "AMBULANCE", label: "Ambulance" },
  { key: "FIRE_ENGINE", label: "Fire" },
  { key: "POLICE", label: "Police" },
  { key: "RESCUE", label: "Rescue" },
  { key: "HAZMAT", label: "Hazmat" },
];

const STATUS_HEX: Record<string, string> = {
  AVAILABLE: "var(--accent-cyan)",
  EN_ROUTE: "var(--accent-amber)",
  ON_SCENE: "var(--accent-blue)",
  RETURNING: "var(--text-tertiary)",
  OFFLINE: "var(--text-disabled)",
};

function statusWord(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
}

export function ResourceList({
  resources,
  selectedIncident,
  selectedResourceId,
  onSelectResource,
  onDispatched,
}: {
  resources: ResourceDTO[];
  selectedIncident: IncidentDTO | null;
  selectedResourceId: string | null;
  onSelectResource: (resourceId: string) => void;
  onDispatched: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      AVAILABLE: resources.filter((r) => r.status === "AVAILABLE").length,
      EN_ROUTE: resources.filter((r) => r.status === "EN_ROUTE").length,
      ON_SCENE: resources.filter((r) => r.status === "ON_SCENE").length,
      OFFLINE: resources.filter((r) => r.status === "OFFLINE").length,
      ALL: resources.length,
    }),
    [resources],
  );

  const filtered = useMemo(() => {
    let list = resources;
    if (statusFilter !== "ALL") list = list.filter((r) => r.status === statusFilter);
    if (typeFilter !== "ALL") list = list.filter((r) => r.type === typeFilter);
    return [...list].sort((a, b) => a.code.localeCompare(b.code));
  }, [resources, statusFilter, typeFilter]);

  async function quickDispatch(resourceId: string) {
    if (!selectedIncident) return;
    setBusyId(resourceId);
    try {
      await postDispatch({ incidentId: selectedIncident.id, resourceId });
      setPendingId(null);
      onDispatched();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-2.5 pb-1.5 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={cn(
              "px-2 py-1 rounded-full text-[11px] font-medium transition-colors",
              statusFilter === f.key ? "bg-white/[0.09] text-[var(--text-primary)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
            )}
          >
            {f.label} <span className="mono-tabular opacity-70">{counts[f.key]}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 px-2.5 pb-2 flex-wrap">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setTypeFilter(f.key)}
            className={cn(
              "px-2 py-0.5 rounded-full text-[10.5px] font-medium transition-colors border",
              typeFilter === f.key
                ? "border-[var(--border-strong)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-faint)] hover:text-[var(--text-secondary)]",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {selectedIncident && (
        <div className="mx-2.5 mb-2 px-2.5 py-1.5 rounded-[8px] bg-[var(--accent-cyan-bg)] text-[10.5px] text-[var(--accent-cyan)]">
          Showing dispatch options for <span className="font-medium">{selectedIncident.code}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px] text-[var(--text-tertiary)]">No resources match.</div>
        ) : (
          filtered.map((resource) => {
            const compatible = selectedIncident ? compatibility(selectedIncident.type, resource.type) > 0 : false;
            const canDispatch = selectedIncident && resource.status === "AVAILABLE" && compatible;
            const isPending = pendingId === resource.id;

            const isSelected = selectedResourceId === resource.id;

            return (
              <div
                key={resource.id}
                className={cn("rounded-[10px] mb-0.5 transition-colors", isSelected ? "bg-white/[0.08]" : "hover:bg-white/[0.04]")}
              >
                <button onClick={() => onSelectResource(resource.id)} className="w-full text-left px-2.5 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: STATUS_HEX[resource.status] }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] text-[var(--text-primary)] font-medium">{resource.code}</span>
                        <span className="text-[10.5px] text-[var(--text-tertiary)] uppercase tracking-wide">{resource.type.replace(/_/g, " ")}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[11px]" style={{ color: STATUS_HEX[resource.status] }}>
                          {statusWord(resource.status)}
                        </span>
                        {resource.currentIncidentCode ? (
                          <span className="text-[11px] text-[var(--text-tertiary)] shrink-0 ml-2">→ {resource.currentIncidentCode}</span>
                        ) : resource.status === "AVAILABLE" ? (
                          <span className="text-[11px] text-[var(--text-faint)] shrink-0 ml-2">Ready</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </button>

                {canDispatch && (
                  <div className="px-2.5 pb-2.5 -mt-1">
                    {isPending ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => quickDispatch(resource.id)}
                          disabled={busyId !== null}
                          className="flex-1 text-[11px] font-medium rounded-[7px] bg-[var(--accent-cyan)] text-[#04191c] py-1.5 disabled:opacity-60"
                        >
                          {busyId === resource.id ? "Dispatching…" : `Confirm dispatch to ${selectedIncident!.code}`}
                        </button>
                        <button onClick={() => setPendingId(null)} className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setPendingId(resource.id)}
                        className="text-[11px] font-medium text-[var(--accent-cyan)] hover:underline"
                      >
                        Dispatch to {selectedIncident!.code}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
