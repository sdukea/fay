"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { postDispatch, postResolveIncident } from "@/lib/client/api";
import type { CandidateResource, DecisionExplanation, IncidentDTO } from "@/types/domain";

const SEVERITY_HEX: Record<number, string> = {
  5: "var(--accent-red)",
  4: "var(--accent-amber)",
  3: "var(--accent-yellow)",
  2: "var(--text-tertiary)",
  1: "var(--text-tertiary)",
};

interface PendingDispatch {
  candidate: CandidateResource;
  isOverride: boolean;
  impactMinutes: number;
}

export function DecisionDetail({
  incident,
  explanation,
  loading,
  error,
  onDispatched,
  onBrowseResources,
}: {
  incident: IncidentDTO;
  explanation: DecisionExplanation | null;
  loading: boolean;
  error: string | null;
  onDispatched: () => void;
  onBrowseResources?: () => void;
}) {
  const [pending, setPending] = useState<PendingDispatch | null>(null);
  const [busy, setBusy] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  const recommended = explanation?.candidates.find((c) => c.isRecommended);

  function selectCandidate(candidate: CandidateResource) {
    setDispatchError(null);
    const isOverride = !candidate.isRecommended;
    const impactMinutes = recommended ? candidate.etaMinutes - recommended.etaMinutes : 0;
    setPending({ candidate, isOverride, impactMinutes });
  }

  async function confirmDispatch() {
    if (!pending) return;
    setBusy(true);
    setDispatchError(null);
    try {
      await postDispatch({
        incidentId: incident.id,
        resourceId: pending.candidate.resourceId,
        recommendedResourceId: recommended?.resourceId ?? null,
      });
      setPending(null);
      onDispatched();
    } catch (err) {
      setDispatchError(err instanceof Error ? err.message : "Dispatch failed");
    } finally {
      setBusy(false);
    }
  }

  async function resolve() {
    setBusy(true);
    try {
      await postResolveIncident(incident.id);
      onDispatched();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10.5px] font-medium uppercase tracking-wide" style={{ color: SEVERITY_HEX[incident.severity] }}>
            {incident.severity >= 5 ? "Critical" : incident.severity >= 4 ? "Severe" : incident.severity >= 3 ? "Elevated" : "Minor"}
          </span>
          <span className="text-[10.5px] text-[var(--text-tertiary)]">{incident.code}</span>
        </div>
        <h3 className="text-[15px] font-semibold text-[var(--text-primary)] leading-snug">{incident.description}</h3>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--text-secondary)]">
          {incident.casualties > 0 && <span>{incident.casualties} casualties</span>}
          <span>{incident.waitingSinceMinutes.toFixed(1)} min waiting</span>
          {incident.zoneName && <span>{incident.zoneName}</span>}
        </div>
      </div>

      {incident.assignedResourceCode && (
        <div className="flex items-center justify-between py-2 border-t border-white/[0.06]">
          <div>
            <div className="label-micro mb-0.5">Current response</div>
            <div className="text-[13px] text-[var(--accent-cyan)] font-medium">{incident.assignedResourceCode}</div>
          </div>
          <div className="text-right">
            <div className="label-micro mb-0.5">ETA</div>
            <div className="mono-tabular text-[13px] text-[var(--text-primary)]">{incident.assignedEtaMinutes?.toFixed(1)}m</div>
          </div>
        </div>
      )}

      {loading && <div className="text-[12px] text-[var(--text-tertiary)]">Fay is thinking…</div>}
      {error && <div className="text-[12px] text-[var(--accent-red)]">{error}</div>}

      <AnimatePresence mode="wait">
        {pending ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="flex flex-col gap-3 pt-1 border-t border-white/[0.06]"
          >
            <div className="label-micro">{pending.isOverride ? "Operator override" : "Confirm dispatch"}</div>
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-[var(--text-primary)]">{pending.candidate.resourceCode}</span>
              <span className="mono-tabular text-[13px] text-[var(--text-secondary)]">ETA {pending.candidate.etaMinutes.toFixed(1)}m</span>
            </div>
            {pending.isOverride && recommended && (
              <div className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                Fay recommended <span className="text-[var(--text-primary)]">{recommended.resourceCode}</span>. Projected impact:{" "}
                <span className={pending.impactMinutes > 0 ? "text-[var(--accent-amber)]" : "text-[var(--accent-green)]"}>
                  {pending.impactMinutes > 0 ? "+" : ""}
                  {pending.impactMinutes.toFixed(1)} min response time
                </span>
              </div>
            )}
            {dispatchError && <div className="text-[12px] text-[var(--accent-red)]">{dispatchError}</div>}
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={confirmDispatch} disabled={busy} className="flex-1">
                {busy ? "Dispatching…" : `Dispatch ${pending.candidate.resourceCode}`}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPending(null)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </motion.div>
        ) : (
          explanation &&
          !loading && (
            <motion.div key="detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
              <div>
                <div className="label-micro mb-1.5">Fay recommends</div>
                {recommended ? (
                  <button
                    onClick={() => selectCandidate(recommended)}
                    className="w-full flex items-center justify-between rounded-[10px] bg-[var(--accent-cyan-bg)] px-3 py-2.5 text-left hover:brightness-110 transition"
                  >
                    <span className="text-[16px] font-semibold text-[var(--accent-cyan)]">{recommended.resourceCode}</span>
                    <span className="mono-tabular text-[13px] text-[var(--text-primary)]">{recommended.etaMinutes.toFixed(1)} min</span>
                  </button>
                ) : (
                  <div className="text-[12px] text-[var(--accent-red)]">No compatible resource is currently available.</div>
                )}
              </div>

              {explanation.drivers && (
                <div>
                  <div className="label-micro mb-1.5">Why</div>
                  <div className="grid grid-cols-2 gap-y-1.5 text-[12px]">
                    <Row label="Severity" value={`${explanation.drivers.severity}/5`} />
                    <Row label="Casualties" value={String(explanation.drivers.casualties)} />
                    <Row label="Wait time" value={`${explanation.drivers.waitMinutes.toFixed(1)} min`} />
                    <Row label="Distance" value={`${explanation.drivers.distanceKm.toFixed(1)} km`} />
                    <Row label="Compatibility" value={`${explanation.drivers.compatibilityPct}%`} />
                    <Row label="Hospital" value={explanation.drivers.hospitalAvailable ? "Available" : "Constrained"} />
                  </div>
                </div>
              )}

              <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">{explanation.narrative}</p>

              {explanation.candidates.length > 1 && (
                <div>
                  <div className="label-micro mb-1.5">Alternatives</div>
                  <div className="flex flex-col gap-0.5">
                    {explanation.candidates.slice(1, 6).map((candidate) => (
                      <button
                        key={candidate.resourceId}
                        onClick={() => selectCandidate(candidate)}
                        className="flex items-center justify-between px-2 py-1.5 rounded-[8px] hover:bg-white/[0.04] transition-colors text-left"
                      >
                        <span className="text-[12.5px] text-[var(--text-primary)]">{candidate.resourceCode}</span>
                        <span className="text-[11px] text-[var(--text-tertiary)]">
                          {candidate.etaMinutes.toFixed(1)}m
                          {recommended ? ` (+${(candidate.etaMinutes - recommended.etaMinutes).toFixed(1)})` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                  {onBrowseResources && (
                    <button onClick={onBrowseResources} className="mt-2 text-[11.5px] text-[var(--accent-cyan)] hover:underline">
                      Browse full resource list →
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )
        )}
      </AnimatePresence>

      {incident.status !== "RESOLVED" && !pending && (
        <button onClick={resolve} disabled={busy} className="text-[11.5px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors self-start">
          Mark resolved
        </button>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between pr-2">
      <span className="text-[var(--text-tertiary)]">{label}</span>
      <span className="text-[var(--text-primary)] mono-tabular">{value}</span>
    </div>
  );
}
