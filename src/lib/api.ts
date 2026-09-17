import type { ApiEnvelope } from "@/lib/api-types";

export class AivahApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export function unwrapResults<T>(payload: ApiEnvelope<T> | T): T {
  if (payload && typeof payload === "object" && "results" in payload) {
    return (payload as ApiEnvelope<T>).results;
  }
  return payload as T;
}

export async function aivahFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api/aivah/${path.replace(/^\/+/, "")}`, {
    ...init,
    headers:
      init?.body instanceof FormData
        ? init.headers
        : { "content-type": "application/json", ...init?.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload?.error;
    throw new AivahApiError(
      error?.message || payload?.message || "Aivah API request failed",
      response.status,
      error?.code,
    );
  }
  return unwrapResults<T>(payload);
}

export function asArray<T>(
  value: unknown,
  keys: string[] = ["data", "items", "rows"],
): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    for (const key of keys) {
      const nested = (value as Record<string, unknown>)[key];
      if (Array.isArray(nested)) return nested as T[];
    }
    return Object.values(value as Record<string, unknown>).flatMap((entry) =>
      Array.isArray(entry) ? entry : [],
    ) as T[];
  }
  return [];
}
