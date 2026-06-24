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
  const listOptions = { ...options, revalidateSeconds: options.revalidateSeconds ?? 60 };
  const detailOptions = { ...options, revalidateSeconds: options.revalidateSeconds ?? 180 };
  const gamesResponse = await tryFetchApiJson<ApiGamesListResponse>(
    `/api/v1/games?limit=12&offset=0${userQuery}`,
    listOptions
  );

  if (!gamesResponse) {
    return getAnalyzerPageModel(options.selectedGameId);
  }

  const games = gamesResponse.games ?? [];
  const selectedGame =
    games.find((game) => Number(game.id ?? 0) === options.selectedGameId) ??
    games[0];
  const selectedGameId = Number(selectedGame?.id ?? 0);
  const gamesForInitialInsight = selectedGameId > 0 ? [selectedGame] : [];
  const detailEntries = await Promise.all(
    gamesForInitialInsight.map(async (game) => [
      Number(game.id ?? 0),
      await tryFetchApiJson<ApiGameDetailResponse>(`/api/v1/games/${game.id}/detail`, detailOptions)
    ] as const)
  );
  const analyzerEntries = await Promise.all(
    gamesForInitialInsight.map(async (game) => [
      Number(game.id ?? 0),
      await tryFetchApiJson<ApiGameAnalyzerResponse>(`/api/v1/games/${game.id}/analyzer`, detailOptions)
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
