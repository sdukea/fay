"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * Renders its children into a portal on document.body, positioned below and
 * right-aligned to `anchorRef`. Needed because the top bar has
 * `overflow-x-auto` (so it stays usable on narrow screens) — per the CSS
 * overflow spec, setting only one axis to `auto` forces the other to
 * compute as `auto` too, so anything absolutely positioned *inside* the
 * header gets silently clipped instead of hanging below it. Portaling out
 * of that subtree sidesteps the clip entirely.
 */
export function FloatingDropdown({
  open,
  anchorRef,
  children,
  width = 240,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  children: React.ReactNode;
  width?: number;
}) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // document.body doesn't exist during SSR — this is the standard
    // client-only-portal pattern, not a derived-state anti-pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const update = () => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [open, anchorRef]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && pos && (
        <motion.div
          initial={{ opacity: 0, y: -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.97 }}
          transition={{ duration: 0.14 }}
          style={{ position: "fixed", top: pos.top, right: pos.right, width }}
          className="surface-floating rounded-[10px] shadow-[0_12px_32px_rgba(0,0,0,0.45)] z-[100] overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
