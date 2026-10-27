import type { Accuracy, DateCoverage, Decision, Meta } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const REQUEST_TIMEOUT_MS = 15_000;

function detailFrom(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("detail" in body)) {
    return null;
  }
  const detail = (body as { detail: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const first = detail[0];
    if (typeof first === "object" && first !== null && "msg" in first) {
      const message = (first as { msg: unknown }).msg;
      if (typeof message === "string") return message;
    }
  }
  return null;
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) {
    throw new DOMException("Request aborted", "AbortError");
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });

  try {
    let response: Response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } catch (reason) {
      if (signal?.aborted) throw reason;
      if (timedOut) {
        throw new Error("The request timed out. Check the connection and try again.");
      }
      throw new Error("Could not reach the server. Check the connection and try again.");
    }

    if (!response.ok) {
      let detail: string | null = null;
      try {
        detail = detailFrom(await response.json());
      } catch {
        // Keep the HTTP status message.
      }
      throw new Error(detail ?? `Request failed (${response.status})`);
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new Error("The server returned an invalid response.");
    }
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
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
