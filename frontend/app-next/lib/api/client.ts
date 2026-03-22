import { CURRENT_USER } from "@/lib/fixtures/common";
import { buildApiUrl } from "@/lib/api/url";
import { parseCurrentUserSessionCookie } from "@/lib/utils/current-user-session";

export interface LoaderOptions {
  apiBaseUrl?: string;
  currentUser?: string;
  currentUserCookie?: string;
  fetchImpl?: typeof fetch;
}

export function resolveCurrentUser(currentUser?: string, currentUserCookie?: string): string {
  return currentUser?.trim() || parseCurrentUserSessionCookie(currentUserCookie) || CURRENT_USER;
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
