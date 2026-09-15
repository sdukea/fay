/**
 * Shared timing model for an active assignment's physical lifecycle
 * (EN_ROUTE → ON_SCENE → resolved/AVAILABLE). Both the server tick
 * (lib/server/lifecycle.ts) and the client's map animation compute against
 * these same functions, so a resource marker visually arrives at the exact
 * moment the backend actually flips its status — one formula, not two
 * timers that can drift apart.
 *
 * Real dispatch ETAs (minutes) would make a live demo unbearably slow to
 * watch play out, so wall-clock time is compressed by SPEED_MULTIPLIER.
 * This only affects how fast the *simulated* clock ticks — it has no
 * bearing on the ETA numbers shown to the operator, which stay in real
 * minutes.
 */
export const SPEED_MULTIPLIER = 10;
export const ON_SCENE_SECONDS = 15;

export function etaMinutesToRealMs(etaMinutes: number): number {
  return (etaMinutes * 60 * 1000) / SPEED_MULTIPLIER;
}

export function arrivalTimeMs(assignedAtMs: number, etaMinutes: number): number {
  return assignedAtMs + etaMinutesToRealMs(etaMinutes);
}

export function resolveTimeMs(assignedAtMs: number, etaMinutes: number): number {
  return arrivalTimeMs(assignedAtMs, etaMinutes) + ON_SCENE_SECONDS * 1000;
}

/** 0 at dispatch, 1 at arrival. Clamped — never extrapolates past the incident location. */
export function travelProgress(assignedAtMs: number, etaMinutes: number, nowMs: number): number {
  const total = etaMinutesToRealMs(etaMinutes);
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, (nowMs - assignedAtMs) / total));
}
