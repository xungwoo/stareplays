import { createDashboardPageModel, getDashboardPageModel } from "@/lib/adapters/dashboard";
import { resolveCurrentUser, tryFetchApiJson, type LoaderOptions } from "@/lib/api/client";
import type { ApiGamesListResponse, ApiPlayerStatsResponse, ApiRankingsResponse, ApiUsersSuggestResponse } from "@/types/api";

export async function loadDashboardPageModel(options: LoaderOptions = {}) {
  const currentUser = resolveCurrentUser(options.currentUser);
  const suggestionPrefix = currentUser.slice(0, 4);

  const [rankingsResponse, playerStatsResponse, suggestionsResponse, gamesResponse] = await Promise.all([
    tryFetchApiJson<ApiRankingsResponse>("/api/v1/rankings/3v3?limit=100", options),
    tryFetchApiJson<ApiPlayerStatsResponse>(`/api/v1/players/${encodeURIComponent(currentUser)}/stats`, options),
    tryFetchApiJson<ApiUsersSuggestResponse>(`/api/v1/users/suggest?q=${encodeURIComponent(suggestionPrefix)}&limit=5`, options),
    tryFetchApiJson<ApiGamesListResponse>(`/api/v1/games?limit=12&offset=0&user_name=${encodeURIComponent(currentUser)}`, options)
  ]);

  if (!rankingsResponse && !playerStatsResponse && !suggestionsResponse && !gamesResponse) {
    return getDashboardPageModel();
  }

  return createDashboardPageModel({
    currentUser,
    rankingsResponse,
    playerStatsResponse,
    suggestionsResponse,
    gamesResponse
  });
}
