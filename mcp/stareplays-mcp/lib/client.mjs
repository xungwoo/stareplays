export const DEFAULT_API_BASE_URL = "https://stareplays-next-production.up.railway.app";

export function normalizeBaseUrl(value = DEFAULT_API_BASE_URL) {
  return value.replace(/\/+$/, "");
}

export async function fetchTeamAnalysisRaw({ apiBaseUrl = DEFAULT_API_BASE_URL, seasonLabel, fetchImpl = fetch } = {}) {
  const url = new URL("/api/team-analysis/raw", normalizeBaseUrl(apiBaseUrl));
  if (seasonLabel) url.searchParams.set("season_label", seasonLabel);

  const response = await fetchImpl(url.toString(), {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch stareplays raw data: HTTP ${response.status}`);
  }

  return response.json();
}
