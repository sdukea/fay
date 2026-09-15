"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { DecisionDetail } from "./DecisionDetail";
import { OptimizePanel } from "@/components/analytics/OptimizePanel";
import { ScenarioControls } from "@/components/simulate/ScenarioControls";
import { ReplayTimeline } from "@/components/replay/ReplayTimeline";
import { useExplanation } from "@/lib/client/useExplanation";
import type { AppMode } from "@/components/shell/TopBar";
import type { EventDTO, IncidentDTO } from "@/types/domain";

interface FayPanelProps {
  mode: AppMode;
  incident: IncidentDTO | null;
  events: EventDTO[];
  onDispatched: () => void;
  onSelectIncidentByCode: (code: string) => void;
  onOptimizePreview?: (incidentIds: string[]) => void;
  onBrowseResources?: () => void;
}

/**
 * Thin wrapper that remounts the panel (via `key`) whenever the mode or
 * selected incident changes, so the "expanded by default" state resets
 * naturally on every new context instead of needing an effect to force it —
 * the pattern React's own docs recommend over resetting state in an effect.
 */
export function FayPanel(props: FayPanelProps) {
  return <FayPanelInner key={`${props.mode}:${props.incident?.id ?? ""}`} {...props} />;
}

function FayPanelInner({ mode, incident, events, onDispatched, onSelectIncidentByCode, onOptimizePreview, onBrowseResources }: FayPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const { explanation, loading, error } = useExplanation(mode === "LIVE" ? (incident?.id ?? null) : null);

  if (mode === "LIVE" && !incident) return null;

  const recommended = explanation?.candidates.find((c) => c.isRecommended);
  const title = mode === "LIVE" ? "Fay" : mode === "OPTIMIZE" ? "Optimize" : mode === "SIMULATE" ? "Simulate" : "Replay";

  const collapsedSummary =
    mode === "LIVE"
      ? loading
        ? "Fay is thinking…"
        : recommended
          ? `Recommends ${recommended.resourceCode} → ${incident?.code} · ${recommended.etaMinutes.toFixed(1)} min`
          : "No resource available"
      : mode === "OPTIMIZE"
        ? "Compare and apply the optimal allocation"
        : mode === "SIMULATE"
          ? "Trigger a scenario"
          : `${events.length} events recorded`;

  return (
    <div className="absolute top-24 right-4 z-20 flex flex-col items-end">
      <AnimatePresence initial={false} mode="wait">
        {!expanded ? (
          <motion.button
            key="collapsed"
            layoutId="fay-panel"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            onClick={() => setExpanded(true)}
            className="surface-floating flex items-center gap-2.5 rounded-full pl-3.5 pr-2.5 py-2 shadow-[0_4px_20px_rgba(0,0,0,0.35)] max-w-[360px]"
          >
            <span className="text-[12.5px] font-medium text-[var(--text-primary)] truncate">{collapsedSummary}</span>
            <ChevronRight size={13} className="text-[var(--text-tertiary)] rotate-180 shrink-0" />
          </motion.button>
        ) : (
          <motion.div
            key="expanded"
            layoutId="fay-panel"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            className="surface-floating flex flex-col w-[360px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-112px)] rounded-[14px] shadow-[0_12px_40px_rgba(0,0,0,0.45)] overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
              <span className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</span>
              <button onClick={() => setExpanded(false)} className="text-[11.5px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                Collapse
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {mode === "LIVE" && incident && (
                <DecisionDetail
                  incident={incident}
                  explanation={explanation}
                  loading={loading}
                  error={error}
                  onDispatched={onDispatched}
                  onBrowseResources={
                    onBrowseResources &&
                    (() => {
                      // Collapse this panel first — otherwise it visually overlaps
                      // the resources drawer that's about to open on the same side.
                      setExpanded(false);
                      onBrowseResources();
                    })
                  }
                />
              )}
              {mode === "OPTIMIZE" && <OptimizePanel onApplied={onDispatched} onPreview={onOptimizePreview} />}
              {mode === "SIMULATE" && <ScenarioControls onTriggered={onDispatched} />}
              {mode === "REPLAY" && <ReplayTimeline events={events} onSelectIncident={onSelectIncidentByCode} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
