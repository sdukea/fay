"use client";

import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";

/**
 * Smoothly tweens between values instead of snapping — e.g. coverage 57% →
 * 71% visibly counts up rather than replacing the digit instantly, so the
 * operator perceives the system state changing, not just a new label.
 */
export function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const spring = useSpring(value, { stiffness: 140, damping: 24, mass: 0.6 });
  const display = useTransform(spring, (v) => v.toFixed(decimals));
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      spring.jump(value);
      first.current = false;
      return;
    }
    spring.set(value);
  }, [value, spring]);

  return <motion.span>{display}</motion.span>;
}
