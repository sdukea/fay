import { cn } from "@/lib/client/cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-[var(--accent-cyan)] text-[#16113a] hover:bg-[#a89dfa] disabled:bg-[var(--accent-cyan-dim)] disabled:text-[var(--text-disabled)]",
  secondary:
    "bg-white/[0.04] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-white/[0.08] disabled:text-[var(--text-disabled)]",
  ghost: "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] disabled:text-[var(--text-disabled)]",
  danger:
    "bg-[var(--accent-red-bg)] text-[var(--accent-red)] border border-[var(--accent-red)]/30 hover:bg-[var(--accent-red)]/20",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "text-[11px] px-2.5 py-1.5 gap-1.5",
  md: "text-[13px] px-3.5 py-2 gap-2",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-[6px] font-medium transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-cyan)] focus-visible:outline-offset-2",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  );
}
