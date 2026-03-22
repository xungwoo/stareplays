import { createVaultPageModel, getVaultPageModel } from "@/lib/adapters/vault";
import { resolveCurrentUser, tryFetchApiJson, type LoaderOptions } from "@/lib/api/client";
import type { ApiGamesListResponse } from "@/types/api";

export async function loadVaultPageModel(options: LoaderOptions = {}) {
  const currentUser = resolveCurrentUser(options.currentUser, options.currentUserCookie);
  const gamesResponse = await tryFetchApiJson<ApiGamesListResponse>(
    `/api/v1/games?limit=12&offset=0&user_name=${encodeURIComponent(currentUser)}`,
    options
  );

  if (!gamesResponse) {
    return getVaultPageModel();
  }

  return createVaultPageModel({
    currentUser,
    gamesResponse
  });
}
