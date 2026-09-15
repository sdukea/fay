"use client";

import { useEffect, useState } from "react";
import { fetchExplanation } from "./api";
import type { DecisionExplanation } from "@/types/domain";

export function useExplanation(incidentId: string | null) {
  const [explanation, setExplanation] = useState<DecisionExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!incidentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExplanation(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchExplanation(incidentId)
      .then((data) => {
        if (!cancelled) setExplanation(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load decision data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [incidentId]);

  return { explanation, loading, error };
}
