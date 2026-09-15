"use client";

import { Bell } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FloatingDropdown } from "./FloatingDropdown";
import { ReplayTimeline } from "@/components/replay/ReplayTimeline";
import type { EventDTO } from "@/types/domain";

/** Events about a resource's own lifecycle — what this bell is scoped to, distinct from Replay's full audit trail (which also includes scenario/optimization events). */
const RESOURCE_EVENT_TYPES = new Set(["RESOURCE_ASSIGNED", "RESOURCE_ARRIVED", "RESOURCE_RETURNED", "OPERATOR_OVERRIDE", "AUTO_DISPATCH", "INCIDENT_RESOLVED"]);

export function NotificationsBell({ events, onSelectIncident }: { events: EventDTO[]; onSelectIncident: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const resourceEvents = useMemo(() => events.filter((e) => RESOURCE_EVENT_TYPES.has(e.type)), [events]);

  const unreadCount = useMemo(() => {
    if (!lastSeen) return resourceEvents.length;
    return resourceEvents.filter((e) => e.timestamp > lastSeen).length;
  }, [resourceEvents, lastSeen]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function toggle() {
    setOpen((wasOpen) => {
      const willOpen = !wasOpen;
      if (willOpen && resourceEvents.length > 0) {
        setLastSeen(resourceEvents[resourceEvents.length - 1].timestamp);
      }
      return willOpen;
    });
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        onClick={toggle}
        title="Resource notifications"
        className="relative h-6 w-6 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] transition-colors"
      >
        <Bell size={14} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-3.5 px-[3px] rounded-full bg-[var(--accent-red)] text-[8.5px] font-semibold text-white flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      <FloatingDropdown open={open} anchorRef={buttonRef} width={320}>
        <div className="flex flex-col max-h-[420px]">
          <div className="px-3.5 pt-3 pb-2 border-b border-white/[0.06] shrink-0">
            <span className="text-[12.5px] font-semibold text-[var(--text-primary)]">Resource notifications</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3.5 py-3">
            {resourceEvents.length === 0 ? (
              <div className="text-[12px] text-[var(--text-tertiary)] text-center py-6">No resource activity yet.</div>
            ) : (
              <ReplayTimeline events={resourceEvents} onSelectIncident={onSelectIncident} />
            )}
          </div>
        </div>
      </FloatingDropdown>
    </div>
  );
}
