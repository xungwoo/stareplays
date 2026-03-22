export function normalizeBaseUrl(value?: string): string {
  const fallback = "http://127.0.0.1:3000";
  const base = value?.trim() || process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || fallback;

  return base.endsWith("/") ? base : `${base}/`;
}

export function buildApiUrl(path: string, apiBaseUrl?: string): string {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;

  return new URL(normalizedPath, normalizeBaseUrl(apiBaseUrl)).toString();
}
