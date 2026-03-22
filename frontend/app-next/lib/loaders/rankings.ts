import { createRankingsPageModel, getRankingsPageModel } from "@/lib/adapters/rankings";
import { resolveCurrentUser, tryFetchApiJson, type LoaderOptions } from "@/lib/api/client";
import type { ApiRaceMatchupsResponse, ApiRankingsResponse } from "@/types/api";

export async function loadRankingsPageModel(options: LoaderOptions = {}) {
  const currentUser = resolveCurrentUser(options.currentUser, options.currentUserCookie);
  const [rankingsResponse, raceMatchupsResponse] = await Promise.all([
    tryFetchApiJson<ApiRankingsResponse>("/api/v1/rankings/3v3?limit=100", options),
    tryFetchApiJson<ApiRaceMatchupsResponse>("/api/v1/analyzer/race-matchups?team_size=3&limit=300", options)
  ]);

  if (!rankingsResponse && !raceMatchupsResponse) {
    return getRankingsPageModel(currentUser);
  }

  return createRankingsPageModel({
    currentUser,
    rankingsResponse,
    raceMatchupsResponse
  });
}
