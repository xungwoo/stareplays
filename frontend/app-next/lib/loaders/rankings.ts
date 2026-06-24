import { createRankingsPageModel, getRankingsPageModel } from "@/lib/adapters/rankings";
import { resolveCurrentUser, tryFetchApiJson, type LoaderOptions } from "@/lib/api/client";
import { loadAllGamesResponse } from "@/lib/loaders/team-analysis";
import type { ApiRaceMatchupsResponse, ApiRankingsResponse } from "@/types/api";

export async function loadRankingsPageModel(options: LoaderOptions = {}) {
  const currentUser = resolveCurrentUser(options.currentUser, options.currentUserCookie);
  const cachedOptions = { ...options, revalidateSeconds: options.revalidateSeconds ?? 300 };
  const [rankingsResponse, raceMatchupsResponse, gamesResponse] = await Promise.all([
    tryFetchApiJson<ApiRankingsResponse>("/api/v1/rankings/3v3?limit=100", cachedOptions),
    tryFetchApiJson<ApiRaceMatchupsResponse>("/api/v1/analyzer/race-matchups?team_size=3&limit=300", cachedOptions),
    loadAllGamesResponse(cachedOptions)
  ]);

  if (!rankingsResponse && !raceMatchupsResponse && !gamesResponse) {
    return getRankingsPageModel(currentUser);
  }

  return createRankingsPageModel({
    currentUser,
    rankingsResponse,
    raceMatchupsResponse,
    gamesResponse
  });
}
