"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/Button";
import { applyOptimizationPlan, fetchOptimizationPreview } from "@/lib/client/api";
import type { OptimizationResultDTO } from "@/types/domain";

export function OptimizePanel({ onApplied, onPreview }: { onApplied: () => void; onPreview?: (incidentIds: string[]) => void }) {
  const [result, setResult] = useState<OptimizationResultDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<{ improvementPct: number; count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runOptimize() {
    setLoading(true);
    setError(null);
    setApplied(null);
    try {
      const preview = await fetchOptimizationPreview();
      setResult(preview);
      onPreview?.(preview.proposals.map((p) => p.incidentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Optimization failed");
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    setApplying(true);
    try {
      const res = await applyOptimizationPlan();
      setApplied({ improvementPct: res.improvementPct, count: res.applied });
      setResult(null);
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply plan");
    } finally {
      setApplying(false);
    }
  }

  const chartData = result
    ? [
        { metric: "Weighted ETA (min)", Current: result.baseline.weightedResponseMinutes, Fay: result.optimized.weightedResponseMinutes },
        { metric: "Coverage (%)", Current: result.baseline.coveragePct, Fay: result.optimized.coveragePct },
        { metric: "Critical at risk", Current: result.baseline.criticalAtRiskCount, Fay: result.optimized.criticalAtRiskCount },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      {!result && !applied && (
        <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
          Fay computes a globally optimal reassignment across every active incident and available resource, then
          compares it against the current allocation before anything changes.
        </p>
      )}

      <Button variant="primary" onClick={runOptimize} disabled={loading}>
        {loading ? "Computing…" : "Optimize Response"}
      </Button>

      {error && <div className="text-[12px] text-[var(--accent-red)]">{error}</div>}

      {applied && (
        <div className="text-[12px] text-[var(--accent-green)] leading-relaxed">
          Applied {applied.count} reassignment{applied.count === 1 ? "" : "s"} — {applied.improvementPct}% weighted response improvement.
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <MetricCompare label="Weighted ETA" unit="min" baseline={result.baseline.weightedResponseMinutes} optimized={result.optimized.weightedResponseMinutes} lowerIsBetter />
            <MetricCompare label="Coverage" unit="%" baseline={result.baseline.coveragePct} optimized={result.optimized.coveragePct} />
            <MetricCompare label="Critical at risk" unit="" baseline={result.baseline.criticalAtRiskCount} optimized={result.optimized.criticalAtRiskCount} lowerIsBetter />
            <MetricCompare label="Utilization" unit="%" baseline={result.baseline.resourceUtilizationPct} optimized={result.optimized.resourceUtilizationPct} />
          </div>

          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.06)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} stroke="rgba(148,163,184,0.1)" />
                <YAxis dataKey="metric" type="category" width={104} tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} stroke="transparent" />
                <Tooltip
                  contentStyle={{ background: "var(--bg-elevated)", border: "none", fontSize: 11, borderRadius: 8 }}
                  labelStyle={{ color: "var(--text-primary)" }}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                />
                <Bar dataKey="Current" fill="#5f6b80" radius={3} barSize={9} />
                <Bar dataKey="Fay" fill="#35d0d0" radius={3} barSize={9} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="text-center py-1">
            <div className="mono-tabular text-[28px] font-semibold text-[var(--accent-green)] leading-none">{result.improvementPct}%</div>
            <div className="label-micro mt-1">Weighted response improvement</div>
          </div>

          {result.proposals.length === 0 ? (
            <div className="text-[12px] text-[var(--text-tertiary)]">Current allocation is already optimal — no changes proposed.</div>
          ) : (
            <>
              <div>
                <div className="label-micro mb-1.5">Proposed reassignments ({result.proposals.length})</div>
                <div className="flex flex-col gap-0.5 max-h-[160px] overflow-y-auto">
                  {result.proposals.map((p) => (
                    <div key={p.incidentId} className="flex items-center justify-between px-2 py-1.5 rounded-[8px] text-[12px]">
                      <span className="text-[var(--text-primary)]">
                        {p.resourceCode} <span className="text-[var(--text-tertiary)]">→</span> {p.incidentCode}
                      </span>
                      <span className="text-[var(--accent-cyan)] mono-tabular">{p.etaMinutes.toFixed(1)}m</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="primary" onClick={apply} disabled={applying} className="flex-1">
                  {applying ? "Applying…" : "Apply plan"}
                </Button>
                <Button variant="ghost" onClick={() => setResult(null)} disabled={applying}>
                  Reject
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function MetricCompare({
  label,
  unit,
  baseline,
  optimized,
  lowerIsBetter,
}: {
  label: string;
  unit: string;
  baseline: number;
  optimized: number;
  lowerIsBetter?: boolean;
}) {
  const improved = lowerIsBetter ? optimized < baseline : optimized > baseline;
  return (
    <div>
      <div className="label-micro mb-1">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="mono-tabular text-[11px] text-[var(--text-tertiary)] line-through decoration-1">
          {baseline.toFixed(1)}
          {unit}
        </span>
        <span className={`mono-tabular text-[16px] font-semibold ${improved ? "text-[var(--accent-green)]" : "text-[var(--text-primary)]"}`}>
          {optimized.toFixed(1)}
          {unit}
        </span>
      </div>
    </div>
  );
}
