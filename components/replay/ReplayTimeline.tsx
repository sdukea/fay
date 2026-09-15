"use client";

import type { EventDTO } from "@/types/domain";

const EVENT_COLOR: Record<string, string> = {
  INCIDENTS_DETECTED: "var(--accent-amber)",
  SCENARIO_TRIGGERED: "var(--accent-red)",
  BOTTLENECK_DETECTED: "var(--accent-red)",
  OPTIMIZATION_TRIGGERED: "var(--accent-cyan)",
  AUTO_DISPATCH: "var(--accent-cyan)",
  RESOURCE_ASSIGNED: "var(--accent-cyan)",
  OPERATOR_OVERRIDE: "var(--accent-amber)",
  INCIDENT_RESOLVED: "var(--accent-green)",
};

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour12: false });
}

export function ReplayTimeline({ events, onSelectIncident }: { events: EventDTO[]; onSelectIncident?: (code: string) => void }) {
  return (
    <div className="flex flex-col">
      {events.length === 0 ? (
        <div className="text-[12px] text-[var(--text-tertiary)]">No events recorded yet this session.</div>
      ) : (
        <ol className="relative pl-4 max-h-[420px] overflow-y-auto">
          <div className="absolute left-[9px] top-1 bottom-1 w-px bg-white/[0.08]" />
          {[...events].reverse().map((event) => (
            <li key={event.id} className="relative pl-3 pb-3.5 last:pb-0">
              <span
                className="absolute -left-[3px] top-1 h-1.5 w-1.5 rounded-full"
                style={{ background: EVENT_COLOR[event.type] ?? "var(--text-tertiary)" }}
              />
              <div className="flex items-baseline gap-2">
                <span className="mono-tabular text-[10.5px] text-[var(--text-tertiary)]">{formatClock(event.timestamp)}</span>
                <span className="label-micro">{event.type.replace(/_/g, " ")}</span>
              </div>
              <div className="text-[12.5px] text-[var(--text-primary)] mt-0.5 leading-snug">{event.message}</div>
              {event.incidentCode && (
                <button
                  onClick={() => onSelectIncident?.(event.incidentCode!)}
                  className="text-[11px] text-[var(--accent-cyan)] hover:underline mt-0.5"
                >
                  {event.incidentCode}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
