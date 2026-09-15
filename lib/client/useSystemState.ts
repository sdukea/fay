"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchState, type SystemStateResponse } from "./api";

const POLL_INTERVAL_MS = 3000;

export function useSystemState() {
  const [data, setData] = useState<SystemStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const next = await fetchState();
      setData(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load system state");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch + poll — an intentional effect-driven data sync, not a derived-state anti-pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { data, error, loading, refresh };
}
