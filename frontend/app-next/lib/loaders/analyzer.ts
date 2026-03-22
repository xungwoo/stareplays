import { createAnalyzerPageModel, getAnalyzerPageModel } from "@/lib/adapters/analyzer";
import { resolveCurrentUser, tryFetchApiJson, type LoaderOptions } from "@/lib/api/client";
import type { ApiGameAnalyzerResponse, ApiGameDetailResponse, ApiGamesListResponse } from "@/types/api";

export async function loadAnalyzerPageModel(options: LoaderOptions = {}) {
  const currentUser = resolveCurrentUser(options.currentUser);
  const gamesResponse = await tryFetchApiJson<ApiGamesListResponse>(
    `/api/v1/games?limit=10&offset=0&user_name=${encodeURIComponent(currentUser)}`,
    options
  );

  if (!gamesResponse) {
    return getAnalyzerPageModel();
  }

  const games = gamesResponse.games ?? [];
  const detailEntries = await Promise.all(
    games.map(async (game) => [
      Number(game.id ?? 0),
      await tryFetchApiJson<ApiGameDetailResponse>(`/api/v1/games/${game.id}/detail`, options)
    ] as const)
  );
  const analyzerEntries = await Promise.all(
    games.map(async (game) => [
      Number(game.id ?? 0),
      await tryFetchApiJson<ApiGameAnalyzerResponse>(`/api/v1/games/${game.id}/analyzer`, options)
    ] as const)
  );

  return createAnalyzerPageModel({
    currentUser,
    gamesResponse,
    detailsByGameId: Object.fromEntries(detailEntries),
    analyzersByGameId: Object.fromEntries(analyzerEntries)
  });
}
