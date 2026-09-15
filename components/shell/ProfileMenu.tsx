"use client";

import { useEffect, useRef, useState } from "react";
import { FloatingDropdown } from "./FloatingDropdown";
import type { Operator } from "@/lib/client/useSession";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProfileMenu({ operator, onSignOut }: { operator: Operator; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="h-6 w-6 rounded-full bg-[var(--accent-cyan-bg)] flex items-center justify-center text-[10px] font-semibold text-[var(--accent-cyan)] hover:brightness-110 transition"
        title={operator.name}
      >
        {initials(operator.name)}
      </button>
      <FloatingDropdown open={open} anchorRef={buttonRef} width={190}>
        <div className="px-3 py-2.5 border-b border-white/[0.06]">
          <div className="text-[12.5px] font-medium text-[var(--text-primary)] truncate">{operator.name}</div>
          <div className="text-[10.5px] text-[var(--text-tertiary)] uppercase tracking-wide">{operator.role}</div>
        </div>
        <button
          onClick={() => {
            setOpen(false);
            onSignOut();
          }}
          className="w-full text-left px-3 py-2 text-[12px] text-[var(--text-secondary)] hover:bg-white/[0.05] hover:text-[var(--text-primary)] transition-colors"
        >
          Sign out
        </button>
      </FloatingDropdown>
    </div>
  );
}
