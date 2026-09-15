"use client";

import { useMemo, useState } from "react";
import { priorityScore } from "@/lib/domain/scoring";
import { cn } from "@/lib/client/cn";
import type { IncidentDTO } from "@/types/domain";

type Filter = "CRITICAL" | "AT_RISK" | "UNASSIGNED" | "ALL";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "CRITICAL", label: "Critical" },
  { key: "AT_RISK", label: "At risk" },
  { key: "UNASSIGNED", label: "Unassigned" },
  { key: "ALL", label: "All" },
];

function formatWait(minutes: number): string {
  const mins = Math.floor(minutes);
  const secs = Math.round((minutes - mins) * 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

const SEVERITY_HEX: Record<number, string> = {
  5: "var(--accent-red)",
  4: "var(--accent-amber)",
  3: "var(--accent-yellow)",
  2: "var(--text-tertiary)",
  1: "var(--text-tertiary)",
};

function severityWord(severity: number): string {
  if (severity >= 5) return "Critical";
  if (severity >= 4) return "Severe";
  if (severity >= 3) return "Elevated";
  return "Minor";
}

export function IncidentList({
  incidents,
  selectedId,
  onSelect,
}: {
  incidents: IncidentDTO[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("ALL");

  const criticalCount = incidents.filter((i) => i.severity >= 4).length;
  const atRiskCount = incidents.filter((i) => i.severity >= 4 && (!i.assignedEtaMinutes || i.assignedEtaMinutes > 10)).length;
  const unassignedCount = incidents.filter((i) => !i.assignedResourceCode).length;

  const filtered = useMemo(() => {
    let list = incidents;
    if (filter === "CRITICAL") list = incidents.filter((i) => i.severity >= 4);
    else if (filter === "AT_RISK") list = incidents.filter((i) => i.severity >= 4 && (!i.assignedEtaMinutes || i.assignedEtaMinutes > 10));
    else if (filter === "UNASSIGNED") list = incidents.filter((i) => !i.assignedResourceCode);

    return [...list].sort(
      (a, b) =>
        priorityScore({ severity: b.severity, casualties: b.casualties, waitingMinutes: b.waitingSinceMinutes }) -
        priorityScore({ severity: a.severity, casualties: a.casualties, waitingMinutes: a.waitingSinceMinutes }),
    );
  }, [incidents, filter]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-2.5 pb-2">
        {FILTERS.map((f) => {
          const count =
            f.key === "CRITICAL" ? criticalCount : f.key === "AT_RISK" ? atRiskCount : f.key === "UNASSIGNED" ? unassignedCount : incidents.length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-2 py-1 rounded-full text-[11px] font-medium transition-colors",
                filter === f.key ? "bg-white/[0.09] text-[var(--text-primary)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
              )}
            >
              {f.label} <span className="mono-tabular opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px] text-[var(--text-tertiary)]">Nothing here.</div>
        ) : (
          filtered.map((incident) => (
            <button
              key={incident.id}
              onClick={() => onSelect(incident.id)}
              className={cn(
                "w-full text-left px-2.5 py-2.5 rounded-[10px] transition-colors mb-0.5",
                selectedId === incident.id ? "bg-white/[0.08]" : "hover:bg-white/[0.04]",
              )}
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: SEVERITY_HEX[incident.severity] }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10.5px] font-medium uppercase tracking-wide" style={{ color: SEVERITY_HEX[incident.severity] }}>
                      {severityWord(incident.severity)}
                    </span>
                    <span className="mono-tabular text-[10.5px] text-[var(--text-tertiary)]">{formatWait(incident.waitingSinceMinutes)}</span>
                  </div>
                  <div className="text-[13px] text-[var(--text-primary)] font-medium truncate mt-0.5">{incident.description}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px] text-[var(--text-tertiary)] truncate">{incident.zoneName ?? incident.type.replace(/_/g, " ")}</span>
                    {incident.assignedResourceCode ? (
                      <span className="text-[11px] text-[var(--accent-cyan)] shrink-0 ml-2">
                        {incident.assignedResourceCode} · {incident.assignedEtaMinutes?.toFixed(1)}m
                      </span>
                    ) : (
                      <span className="text-[11px] text-[var(--accent-red)] shrink-0 ml-2">Unassigned</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
