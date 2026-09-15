"use client";

import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { cn } from "@/lib/client/cn";
import type { SystemMetrics } from "@/types/domain";

function toneClass(tone: "neutral" | "cyan" | "red" | "amber" | "green"): string {
  switch (tone) {
    case "cyan":
      return "text-[var(--accent-cyan)]";
    case "red":
      return "text-[var(--accent-red)]";
    case "amber":
      return "text-[var(--accent-amber)]";
    case "green":
      return "text-[var(--accent-green)]";
    default:
      return "text-[var(--text-primary)]";
  }
}

export function StatusBar({ metrics }: { metrics: SystemMetrics }) {
  const coverageTone = metrics.coveragePct >= 90 ? "green" : metrics.coveragePct >= 75 ? "amber" : "red";
  const criticalTone = metrics.criticalIncidents === 0 ? "green" : metrics.criticalIncidents <= 2 ? "amber" : "red";

  return (
    <div className="flex items-center gap-5 px-4 py-1.5 text-[13px] overflow-x-auto no-scrollbar">
      <Stat label="Active">
        <AnimatedNumber value={metrics.activeIncidents} />
      </Stat>
      <Dot />
      <Stat label="Critical" tone={criticalTone}>
        <AnimatedNumber value={metrics.criticalIncidents} />
      </Stat>
      <Dot />
      <Stat label="Avg ETA" tone="cyan">
        <AnimatedNumber value={metrics.avgEtaMinutes} decimals={1} />
        <span className="text-[var(--text-tertiary)] text-[11px] ml-0.5">min</span>
      </Stat>
      <Dot />
      <Stat label="Coverage" tone={coverageTone}>
        <AnimatedNumber value={metrics.coveragePct} decimals={0} />
        <span className="text-[11px] ml-0.5">%</span>
      </Stat>
      <Dot />
      <Stat label="Available">
        <AnimatedNumber value={metrics.availableResources} />
        <span className="text-[var(--text-tertiary)] text-[11px]"> / {metrics.totalResources}</span>
      </Stat>
    </div>
  );
}

function Stat({
  label,
  tone = "neutral",
  children,
}: {
  label: string;
  tone?: "neutral" | "cyan" | "red" | "amber" | "green";
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-1.5 shrink-0 whitespace-nowrap">
      <span className={cn("mono-tabular font-semibold text-[14px]", toneClass(tone))}>{children}</span>
      <span className="text-[10.5px] text-[var(--text-tertiary)]">{label}</span>
    </div>
  );
}

function Dot() {
  return <span className="h-[3px] w-[3px] rounded-full bg-[var(--text-disabled)] shrink-0" />;
}
