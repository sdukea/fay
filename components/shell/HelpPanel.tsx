"use client";

import { X } from "lucide-react";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "Top bar modes",
    body: "Live is the real-time operations view. Optimize suggests dispatch improvements, Simulate runs hypothetical scenarios, and Replay steps back through past incidents.",
  },
  {
    title: "Dispatch mode toggle",
    body: "Human Approval means Fay proposes a dispatch and an operator confirms it. Auto Dispatch lets Fay assign resources on its own without waiting for approval.",
  },
  {
    title: "Map",
    body: "Shows live incidents and resource positions on the map. Click an incident or resource to select it and see details elsewhere in the console.",
  },
  {
    title: "Incidents & resources drawer",
    body: "The panel that lists active incidents and available resources (units), so operators can see workload and availability at a glance.",
  },
  {
    title: "Fay panel",
    body: "Fay's decision assistant — explains its reasoning for a suggested dispatch, and (depending on mode) surfaces optimization, simulation, or replay controls.",
  },
  {
    title: "Notifications & status bar",
    body: "The bell surfaces recent events (new incidents, arrivals). The status bar along the bottom shows live system metrics.",
  },
];

export function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-[380px] bg-[var(--bg-elevated)] border-l border-[var(--border-default)] overflow-y-auto p-5"
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">What is Fay?</h2>
          <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
            <X size={16} />
          </button>
        </div>
        <p className="text-[12.5px] text-[var(--text-tertiary)] leading-relaxed mb-5">
          Fay is an emergency response operations console — it tracks incidents, recommends dispatches, and lets operators
          simulate and review decisions. Here's what each part does:
        </p>

        <div className="flex flex-col gap-4">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <div className="text-[12.5px] font-medium text-[var(--text-primary)] mb-1">{s.title}</div>
              <div className="text-[12px] text-[var(--text-secondary)] leading-relaxed">{s.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
