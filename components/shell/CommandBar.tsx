"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { postQuery } from "@/lib/client/api";

export function CommandBar() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setOpen(true);
    try {
      const res = await postQuery(question.trim());
      setAnswer(res.answer);
    } catch {
      setAnswer("Fay could not process that query.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 w-[min(560px,calc(100vw-32px))]">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="surface-floating mb-2 rounded-[14px] px-4 py-3 shadow-[0_8px_28px_rgba(0,0,0,0.4)] max-h-[260px] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-[12.5px] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                {loading ? <span className="text-[var(--text-tertiary)]">Asking Fay…</span> : answer}
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Collapse answer"
                className="shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-[15px] leading-none transition-colors"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <form onSubmit={submit} className="surface-floating flex items-center gap-2 rounded-full px-4 py-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.4)]">
        <span className="text-[var(--accent-cyan)] text-[13px]">✦</span>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask Fay — which critical incidents are at risk?"
          className="flex-1 bg-transparent outline-none text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
        />
        {open && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="shrink-0 text-[10.5px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Collapse
          </button>
        )}
      </form>
    </div>
  );
}
