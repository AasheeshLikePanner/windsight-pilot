import type { Accuracy, DateCoverage, Decision, Meta } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // Keep the HTTP status message.
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

export function fetchMeta(signal?: AbortSignal): Promise<Meta> {
  return request<Meta>("/api/meta", signal);
}

export async function fetchDates(signal?: AbortSignal): Promise<DateCoverage[]> {
  const body = await request<{ dates: DateCoverage[]; default: string | null }>(
    "/api/dates",
    signal,
  );
  return body.dates;
}

export function fetchDecision(date: string, signal?: AbortSignal): Promise<Decision> {
  return request<Decision>(`/api/decision?date=${encodeURIComponent(date)}`, signal);
}

export function fetchAccuracy(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<Accuracy> {
  const params = new URLSearchParams({ from, to });
  return request<Accuracy>(`/api/accuracy?${params.toString()}`, signal);
}
