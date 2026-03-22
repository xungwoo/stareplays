import { CURRENT_USER } from "@/lib/fixtures/common";

export interface LoaderOptions {
  apiBaseUrl?: string;
  currentUser?: string;
  fetchImpl?: typeof fetch;
}

function normalizeBaseUrl(value?: string): string {
  const fallback = "http://127.0.0.1:3000";
  const base = value?.trim() || process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || fallback;

  return base.endsWith("/") ? base : `${base}/`;
}

function buildApiUrl(path: string, apiBaseUrl?: string): string {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;

  return new URL(normalizedPath, normalizeBaseUrl(apiBaseUrl)).toString();
}

export function resolveCurrentUser(currentUser?: string): string {
  return currentUser?.trim() || CURRENT_USER;
}

export async function fetchApiJson<T>(path: string, options: LoaderOptions = {}): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(buildApiUrl(path, options.apiBaseUrl), {
    headers: {
      accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${path}`);
  }

  return (await response.json()) as T;
}

export async function tryFetchApiJson<T>(path: string, options: LoaderOptions = {}): Promise<T | null> {
  try {
    return await fetchApiJson<T>(path, options);
  } catch {
    return null;
  }
}
