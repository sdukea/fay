import type {
  DecisionExplanation,
  EventDTO,
  HospitalDTO,
  IncidentDTO,
  OptimizationResultDTO,
  ResourceDTO,
  SystemMetrics,
} from "@/types/domain";

export interface SystemStateResponse {
  incidents: IncidentDTO[];
  resources: ResourceDTO[];
  hospitals: HospitalDTO[];
  events: EventDTO[];
  metrics: SystemMetrics;
  dispatchMode: "HUMAN_APPROVAL" | "AUTO_DISPATCH";
  activeScenarioKey: string;
  trafficMultiplier: number;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export async function fetchState(): Promise<SystemStateResponse> {
  const res = await fetch("/api/state", { cache: "no-store" });
  return jsonOrThrow(res);
}

export async function fetchExplanation(incidentId: string): Promise<DecisionExplanation> {
  const res = await fetch(`/api/incidents/${incidentId}/explain`, { cache: "no-store" });
  return jsonOrThrow(res);
}

export async function postDispatch(params: {
  incidentId: string;
  resourceId: string;
  recommendedResourceId?: string | null;
  reason?: string;
}) {
  const res = await fetch("/api/dispatch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return jsonOrThrow<{ assignment: unknown }>(res);
}

export async function postResolveIncident(incidentId: string) {
  const res = await fetch(`/api/incidents/${incidentId}/resolve`, { method: "POST" });
  return jsonOrThrow<{ ok: true }>(res);
}

export async function fetchOptimizationPreview(): Promise<OptimizationResultDTO> {
  const res = await fetch("/api/optimize", { method: "POST" });
  return jsonOrThrow(res);
}

export interface ApplyOptimizationResponse {
  applied: number;
  optimizationRunId: string | null;
  improvementPct: number;
}

export async function applyOptimizationPlan(): Promise<ApplyOptimizationResponse> {
  const res = await fetch("/api/optimize/apply", { method: "POST" });
  return jsonOrThrow(res);
}

export async function postScenario(key: string) {
  const res = await fetch(`/api/scenarios/${key}`, { method: "POST" });
  return jsonOrThrow<{ ok: true; result: unknown }>(res);
}

export async function postDemoReset() {
  const res = await fetch("/api/demo/reset", { method: "POST" });
  return jsonOrThrow<{ ok: true }>(res);
}

export async function postQuery(question: string): Promise<{ answer: string }> {
  const res = await fetch("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  return jsonOrThrow(res);
}

export async function postDispatchMode(mode: "HUMAN_APPROVAL" | "AUTO_DISPATCH") {
  const res = await fetch("/api/dispatch-mode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  return jsonOrThrow<{ ok: true }>(res);
}

export async function postAutoDispatchTick() {
  const res = await fetch("/api/auto-dispatch/tick", { method: "POST" });
  return jsonOrThrow<{ ran: boolean }>(res);
}

export interface LifecycleTickResponse {
  arrived: string[];
  returnedToService: string[];
}

export async function postLifecycleTick(): Promise<LifecycleTickResponse> {
  const res = await fetch("/api/lifecycle/tick", { method: "POST" });
  return jsonOrThrow(res);
}

export async function postIncidentStreamTick(): Promise<{ created: string[] }> {
  const res = await fetch("/api/incidents/tick", { method: "POST" });
  return jsonOrThrow(res);
}
