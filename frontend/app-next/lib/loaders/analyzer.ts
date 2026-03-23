import { createAnalyzerPageModel, getAnalyzerPageModel } from "@/lib/adapters/analyzer";
import { resolveCurrentUser, tryFetchApiJson, type LoaderOptions } from "@/lib/api/client";
import type { ApiGameAnalyzerResponse, ApiGameDetailResponse, ApiGamesListResponse } from "@/types/api";

type AnalyzerLoaderOptions = LoaderOptions & {
  selectedGameId?: number;
};

export async function loadAnalyzerPageModel(options: AnalyzerLoaderOptions = {}) {
  const currentUser =
    options.currentUser !== undefined
      ? options.currentUser.trim()
      : options.currentUserCookie !== undefined
        ? resolveCurrentUser(undefined, options.currentUserCookie)
        : "";
  const userQuery = currentUser ? `&user_name=${encodeURIComponent(currentUser)}` : "";
  const gamesResponse = await tryFetchApiJson<ApiGamesListResponse>(
    `/api/v1/games?limit=12&offset=0${userQuery}`,
    options
  );

  if (!gamesResponse) {
    return getAnalyzerPageModel(options.selectedGameId);
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
    analyzersByGameId: Object.fromEntries(analyzerEntries),
    selectedGameId: options.selectedGameId
  });
}
