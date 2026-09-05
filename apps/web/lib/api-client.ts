// The only module in this app allowed to talk to the network - every page
// and component goes through here, and this in turn only ever calls the
// NestJS API (never PostgreSQL directly).

import type {
  AnalyticsResponse,
  Asset,
  AuditEvent,
  AuthUser,
  BlockWindow,
  Corridor,
  MaintenanceRequest,
  Plan,
  PlanningRun,
  PlanningScenario,
  TrainMovement,
  WhatIfResult,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const TOKEN_STORAGE_KEY = "railopt.token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore storage failures (private browsing, etc.)
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(options.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    let message = `Request to ${path} failed with ${res.status}`;
    try {
      const body = await res.json();
      message = body.message ?? message;
    } catch {
      // response wasn't JSON - keep the default message
    }
    throw new ApiError(res.status, Array.isArray(message) ? message.join(", ") : message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── Auth ─────────────────────────────────────────────────────────────

export function login(email: string, password: string): Promise<{ accessToken: string; user: AuthUser }> {
  return apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

// ── Reference data ───────────────────────────────────────────────────

export function getScenarios(): Promise<PlanningScenario[]> {
  return apiFetch("/scenarios");
}

export function getCorridors(): Promise<Corridor[]> {
  return apiFetch("/corridors");
}

export function getCorridor(id: string): Promise<Corridor> {
  return apiFetch(`/corridors/${id}`);
}

export function getAssets(params: { corridorId?: string; criticality?: string } = {}): Promise<Asset[]> {
  return apiFetch(`/assets?${new URLSearchParams(params as Record<string, string>)}`);
}

export function getAsset(id: string): Promise<Asset> {
  return apiFetch(`/assets/${id}`);
}

// ── Maintenance ──────────────────────────────────────────────────────

export interface MaintenanceFilters {
  scenarioId?: string;
  department?: string;
  corridorId?: string;
  criticality?: string;
  status?: string;
  overdue?: boolean;
}

export function getMaintenanceRequests(filters: MaintenanceFilters = {}): Promise<MaintenanceRequest[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== "") params.set(k, String(v));
  });
  return apiFetch(`/maintenance?${params}`);
}

export function getMaintenanceRequest(id: string): Promise<MaintenanceRequest> {
  return apiFetch(`/maintenance/${id}`);
}

export function createMaintenanceRequest(dto: Record<string, unknown>): Promise<MaintenanceRequest> {
  return apiFetch("/maintenance", { method: "POST", body: JSON.stringify(dto) });
}

// ── Operations ───────────────────────────────────────────────────────

export function getBlockWindows(scenarioId?: string): Promise<BlockWindow[]> {
  const params = scenarioId ? `?scenarioId=${scenarioId}` : "";
  return apiFetch(`/block-windows${params}`);
}

export function getTrainMovements(scenarioId?: string): Promise<TrainMovement[]> {
  const params = scenarioId ? `?scenarioId=${scenarioId}` : "";
  return apiFetch(`/train-movements${params}`);
}

// ── Optimization ─────────────────────────────────────────────────────

export function createPlanningRun(scenarioId: string, strategy: string): Promise<PlanningRun> {
  return apiFetch("/planning-runs", { method: "POST", body: JSON.stringify({ scenarioId, strategy }) });
}

export function getPlanningRun(id: string): Promise<PlanningRun> {
  return apiFetch(`/planning-runs/${id}`);
}

export async function pollPlanningRun(id: string, { intervalMs = 500, timeoutMs = 30_000 } = {}): Promise<PlanningRun> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const run = await getPlanningRun(id);
    if (run.status === "SUCCEEDED" || run.status === "FAILED") return run;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new ApiError(408, `Planning run ${id} did not finish in time`);
}

// ── Plans ────────────────────────────────────────────────────────────

export function getPlans(filters: { scenarioId?: string; status?: string } = {}): Promise<Plan[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  return apiFetch(`/plans?${params}`);
}

export function getPlan(id: string): Promise<Plan> {
  return apiFetch(`/plans/${id}`);
}

export function approvePlan(id: string, comment?: string): Promise<Plan> {
  return apiFetch(`/plans/${id}/approve`, { method: "POST", body: JSON.stringify({ comment }) });
}

export function rejectPlan(id: string, comment?: string): Promise<Plan> {
  return apiFetch(`/plans/${id}/reject`, { method: "POST", body: JSON.stringify({ comment }) });
}

// ── What-if ──────────────────────────────────────────────────────────

export function postWhatIf(dto: {
  scenarioId: string;
  eventType: string;
  strategy?: string;
  payload: Record<string, unknown>;
}): Promise<WhatIfResult> {
  return apiFetch("/what-if", { method: "POST", body: JSON.stringify(dto) });
}

// ── Analytics ────────────────────────────────────────────────────────

export function getAnalytics(scenarioId: string): Promise<AnalyticsResponse> {
  return apiFetch(`/analytics?scenarioId=${scenarioId}`);
}

// ── Audit ────────────────────────────────────────────────────────────

export function getAuditEvents(params: { scenarioId?: string; entityType?: string } = {}): Promise<AuditEvent[]> {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) search.set(k, v);
  });
  return apiFetch(`/audit-events?${search}`);
}
