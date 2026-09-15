"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/client/cn";
import { NotificationsBell } from "./NotificationsBell";
import { ProfileMenu } from "./ProfileMenu";
import type { Operator } from "@/lib/client/useSession";
import type { DispatchMode, EventDTO } from "@/types/domain";

export type AppMode = "LIVE" | "OPTIMIZE" | "SIMULATE" | "REPLAY";

const MODES: AppMode[] = ["LIVE", "OPTIMIZE", "SIMULATE", "REPLAY"];

export function TopBar({
  mode,
  onModeChange,
  connected,
  dispatchMode,
  onToggleDispatchMode,
  operator,
  onSignOut,
  events,
  onSelectIncidentByCode,
}: {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  connected: boolean;
  dispatchMode: DispatchMode;
  onToggleDispatchMode: () => void;
  operator: Operator;
  onSignOut: () => void;
  events: EventDTO[];
  onSelectIncidentByCode: (code: string) => void;
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // Wall-clock tick — an intentional effect-driven external sync (Date.now()), not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex items-center h-12 px-4 shrink-0 gap-6 z-30 relative overflow-x-auto no-scrollbar">
      <span className="text-[19px] font-semibold tracking-[-0.01em] text-[var(--text-primary)] shrink-0">Fay</span>

      <nav className="flex items-center gap-0.5 shrink-0">
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={cn(
              "px-3 py-1.5 text-[12.5px] font-medium rounded-full transition-colors whitespace-nowrap",
              mode === m ? "text-[var(--text-primary)] bg-white/[0.07]" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
            )}
          >
            {m === "LIVE" ? "Live" : m === "OPTIMIZE" ? "Optimize" : m === "SIMULATE" ? "Simulate" : "Replay"}
          </button>
        ))}
      </nav>

      <div className="flex-1 min-w-4" />

      <button
        onClick={onToggleDispatchMode}
        title="Toggle dispatch mode"
        className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors shrink-0 whitespace-nowrap"
      >
        <span
          className={cn(
            "relative inline-flex h-4 w-7 items-center rounded-full transition-colors shrink-0",
            dispatchMode === "AUTO_DISPATCH" ? "bg-[var(--accent-amber)]/70" : "bg-white/10",
          )}
        >
          <span
            className={cn(
              "inline-block h-3 w-3 rounded-full bg-white transition-transform",
              dispatchMode === "AUTO_DISPATCH" ? "translate-x-3.5" : "translate-x-0.5",
            )}
          />
        </span>
        {dispatchMode === "AUTO_DISPATCH" ? "Auto Dispatch" : "Human Approval"}
      </button>

      <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-tertiary)] shrink-0 whitespace-nowrap">
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", connected ? "bg-[var(--accent-green)]" : "bg-[var(--accent-red)]")} />
        {connected ? "Live" : "Reconnecting"}
      </div>

      <div className="mono-tabular text-[12px] text-[var(--text-tertiary)] w-[68px] text-right shrink-0 hidden sm:block">
        {now ? now.toLocaleTimeString("en-US", { hour12: false }) : "--:--:--"}
      </div>

      <NotificationsBell events={events} onSelectIncident={onSelectIncidentByCode} />

      <ProfileMenu operator={operator} onSignOut={onSignOut} />
    </header>
  );
}
