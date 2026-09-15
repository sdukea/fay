"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { IncidentList } from "./IncidentList";
import { ResourceList } from "./ResourceList";
import { cn } from "@/lib/client/cn";
import type { IncidentDTO, ResourceDTO } from "@/types/domain";

type Tab = "INCIDENTS" | "RESOURCES";

export interface OperationsDrawerControl {
  expanded: boolean;
  tab: Tab;
  setExpanded: (expanded: boolean) => void;
  setTab: (tab: Tab) => void;
}

export function useOperationsDrawerControl(): OperationsDrawerControl {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<Tab>("INCIDENTS");
  return { expanded, tab, setExpanded, setTab };
}

export function OperationsDrawer({
  incidents,
  resources,
  selectedIncidentId,
  selectedIncident,
  selectedResourceId,
  onSelectIncident,
  onSelectResource,
  onDispatched,
  control,
}: {
  incidents: IncidentDTO[];
  resources: ResourceDTO[];
  selectedIncidentId: string | null;
  selectedIncident: IncidentDTO | null;
  selectedResourceId: string | null;
  onSelectIncident: (id: string) => void;
  onSelectResource: (id: string) => void;
  onDispatched: () => void;
  control: OperationsDrawerControl;
}) {
  const { expanded, tab, setExpanded, setTab } = control;

  const criticalCount = incidents.filter((i) => i.severity >= 4).length;
  const availableCount = resources.filter((r) => r.status === "AVAILABLE").length;

  return (
    <div className="absolute top-24 left-4 z-20 flex flex-col items-start">
      <AnimatePresence initial={false} mode="wait">
        {!expanded ? (
          <motion.button
            key="collapsed"
            layoutId="operations-drawer"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            onClick={() => setExpanded(true)}
            className="surface-floating flex items-center gap-3 rounded-full pl-3.5 pr-2.5 py-2 shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
          >
            <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--text-primary)]">
              <span className="mono-tabular">{incidents.length}</span> active
            </span>
            {criticalCount > 0 && (
              <span className="flex items-center gap-1 text-[12.5px] font-medium text-[var(--accent-red)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-red)]" />
                <span className="mono-tabular">{criticalCount}</span> critical
              </span>
            )}
            <span className="w-px h-3.5 bg-white/10" />
            <span className="flex items-center gap-1 text-[12.5px] font-medium text-[var(--accent-cyan)]">
              <span className="mono-tabular">{availableCount}</span> available
            </span>
            <ChevronRight size={13} className="text-[var(--text-tertiary)]" />
          </motion.button>
        ) : (
          <motion.div
            key="expanded"
            layoutId="operations-drawer"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            className="surface-floating flex flex-col w-[336px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-112px)] rounded-[14px] shadow-[0_12px_40px_rgba(0,0,0,0.45)] overflow-hidden"
          >
            <div className="flex items-center justify-between px-3.5 pt-3 pb-2.5">
              <div className="flex items-center gap-1 bg-black/20 rounded-full p-0.5">
                <button
                  onClick={() => setTab("INCIDENTS")}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11.5px] font-medium transition-colors",
                    tab === "INCIDENTS" ? "bg-white/[0.09] text-[var(--text-primary)]" : "text-[var(--text-tertiary)]",
                  )}
                >
                  Incidents
                </button>
                <button
                  onClick={() => setTab("RESOURCES")}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11.5px] font-medium transition-colors",
                    tab === "RESOURCES" ? "bg-white/[0.09] text-[var(--text-primary)]" : "text-[var(--text-tertiary)]",
                  )}
                >
                  Resources
                </button>
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="text-[11.5px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Collapse
              </button>
            </div>

            <div className="flex-1 min-h-0">
              {tab === "INCIDENTS" ? (
                <IncidentList incidents={incidents} selectedId={selectedIncidentId} onSelect={onSelectIncident} />
              ) : (
                <ResourceList
                  resources={resources}
                  selectedIncident={selectedIncident}
                  selectedResourceId={selectedResourceId}
                  onSelectResource={onSelectResource}
                  onDispatched={onDispatched}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
