"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useRef, useState } from "react";

export interface Toast {
  id: string;
  tone: "cyan" | "green" | "amber";
  message: string;
}

const TONE_DOT: Record<Toast["tone"], string> = {
  cyan: "var(--accent-cyan)",
  green: "var(--accent-green)",
  amber: "var(--accent-amber)",
};

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const push = useCallback((message: string, tone: Toast["tone"] = "cyan") => {
    const id = `t${Date.now()}-${counter.current++}`;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  return { toasts, push };
}

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="surface-floating flex items-center gap-2 rounded-full pl-3 pr-4 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
          >
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: TONE_DOT[toast.tone] }} />
            <span className="text-[12.5px] text-[var(--text-primary)] whitespace-nowrap">{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
