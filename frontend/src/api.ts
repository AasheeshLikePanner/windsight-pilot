import type { Accuracy, DateCoverage, Decision, Meta } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
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

export function fetchMeta(): Promise<Meta> {
  return request<Meta>("/api/meta");
}

export async function fetchDates(): Promise<DateCoverage[]> {
  const body = await request<{ dates: DateCoverage[]; default: string | null }>(
    "/api/dates",
  );
  return body.dates;
}

export function fetchDecision(date: string): Promise<Decision> {
  return request<Decision>(`/api/decision?date=${encodeURIComponent(date)}`);
}

export function fetchAccuracy(from: string, to: string): Promise<Accuracy> {
  const params = new URLSearchParams({ from, to });
  return request<Accuracy>(`/api/accuracy?${params.toString()}`);
}
