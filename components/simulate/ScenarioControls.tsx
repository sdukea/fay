"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { postDemoReset, postScenario } from "@/lib/client/api";
import type { ScenarioKey } from "@/types/domain";

const SCENARIOS: Array<{ key: ScenarioKey; title: string; description: string }> = [
  { key: "MASS_CASUALTY", title: "Mass casualty event", description: "10–12 simultaneous casualties near a random district." },
  { key: "RESOURCE_FAILURE", title: "Resource failure", description: "Three active resources go offline, dropping their assignments." },
  { key: "TRAFFIC_DISRUPTION", title: "Traffic disruption", description: "City-wide congestion nearly doubles travel-time estimates." },
  { key: "HOSPITAL_OVERLOAD", title: "Hospital overload", description: "Three hospitals reach full capacity." },
  { key: "MULTI_INCIDENT", title: "Multiple simultaneous incidents", description: "Five to six unrelated incidents reported in succession." },
];

export function ScenarioControls({ onTriggered }: { onTriggered: () => void }) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function trigger(key: ScenarioKey) {
    setBusyKey(key);
    setLastResult(null);
    try {
      const res = await postScenario(key);
      setLastResult(summarize(key, res.result));
      onTriggered();
    } finally {
      setBusyKey(null);
    }
  }

  async function resetWorld() {
    setBusyKey("__reset__");
    setLastResult(null);
    try {
      await postDemoReset();
      setLastResult("World reset to normal operations.");
      onTriggered();
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
        Each scenario actually mutates simulation state — the map, metrics, and event log update immediately.
      </p>

      {lastResult && <div className="text-[12px] text-[var(--accent-cyan)] leading-relaxed">{lastResult}</div>}

      <div className="flex flex-col gap-1">
        {SCENARIOS.map((s) => (
          <button
            key={s.key}
            onClick={() => trigger(s.key)}
            disabled={busyKey !== null}
            className="w-full text-left px-2.5 py-2.5 rounded-[10px] hover:bg-white/[0.04] transition-colors disabled:opacity-50"
          >
            <div className="text-[13px] font-medium text-[var(--text-primary)]">{busyKey === s.key ? "Running…" : s.title}</div>
            <div className="text-[11.5px] text-[var(--text-tertiary)] leading-relaxed mt-0.5">{s.description}</div>
          </button>
        ))}
      </div>

      <Button variant="ghost" size="sm" onClick={resetWorld} disabled={busyKey !== null} className="self-start">
        {busyKey === "__reset__" ? "Resetting…" : "Reset to normal operations"}
      </Button>
    </div>
  );
}

function summarize(key: ScenarioKey, result: unknown): string {
  const r = result as Record<string, unknown>;
  switch (key) {
    case "MASS_CASUALTY":
      return `${r.newIncidentCount} new incidents near ${r.epicenter}. ${r.criticalAtRisk} critical incidents now at risk.`;
    case "RESOURCE_FAILURE":
      return `${(r.offlineResources as string[])?.join(", ")} went offline. ${r.criticalAtRisk} critical incidents now at risk.`;
    case "TRAFFIC_DISRUPTION":
      return `Travel time multiplier raised to ${r.trafficMultiplier}x.`;
    case "HOSPITAL_OVERLOAD":
      return `${(r.overloadedHospitals as string[])?.join(", ")} at full capacity.`;
    case "MULTI_INCIDENT":
      return `${(r.createdCodes as string[])?.length} new incidents reported.`;
    default:
      return "Scenario applied.";
  }
}
