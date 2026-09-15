"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/client/cn";

export function LoginScreen({ onSignIn }: { onSignIn: (name: string, role: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<"OPERATOR" | "SUPERVISOR">("OPERATOR");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onSignIn(name, role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-screen w-screen bg-[var(--bg-void)] flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-[380px] flex flex-col gap-6">
        <div className="text-center">
          <div className="text-[34px] font-semibold tracking-[-0.01em] text-[var(--text-primary)] mb-2">Fay</div>
          <p className="text-[13px] text-[var(--text-tertiary)] leading-relaxed">Sign in to the operations console</p>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="operator-name" className="label-micro block mb-1.5">
              Your name
            </label>
            <input
              id="operator-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Steve Jobs"
              autoFocus
              maxLength={40}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] px-3 py-2.5 text-[13.5px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus-visible:border-[var(--accent-cyan)] transition-colors"
            />
          </div>

          <div>
            <label className="label-micro block mb-1.5">Role</label>
            <div className="flex gap-1.5">
              {(["OPERATOR", "SUPERVISOR"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    "flex-1 py-2 rounded-[8px] text-[12.5px] font-medium border transition-colors",
                    role === r
                      ? "border-[var(--accent-cyan-dim)]/50 bg-[var(--accent-cyan-bg)] text-[var(--accent-cyan)]"
                      : "border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
                  )}
                >
                  {r === "OPERATOR" ? "Operator" : "Supervisor"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <div className="text-[12px] text-[var(--accent-red)] text-center">{error}</div>}

        <Button type="submit" variant="primary" disabled={busy || !name.trim()} className="w-full">
          {busy ? "Signing in…" : "Enter console"}
        </Button>

        <p className="text-[11px] text-[var(--text-faint)] text-center leading-relaxed">
          This identifies you in the dispatch log to other operators — it&apos;s not a password.
        </p>
      </form>
    </div>
  );
}
