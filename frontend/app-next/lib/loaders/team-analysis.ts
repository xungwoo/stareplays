import { createTeamAnalysisPageModel } from "@/lib/adapters/team-analysis";
import { tryFetchApiJson, type LoaderOptions } from "@/lib/api/client";
import type { ApiGamesListResponse, ApiSeasonsResponse } from "@/types/api";

function gamesResponseFromSeasons(seasonsResponse: ApiSeasonsResponse | null, seasonLabel?: string): ApiGamesListResponse | null {
  const seasons = (seasonsResponse?.seasons ?? []).filter((season) => !seasonLabel || season.season_label === seasonLabel);
  if (seasons.length === 0) return null;

  const games = seasons.flatMap((season) => season.games_data ?? []);

  return {
    total: games.length,
    games
  };
}

async function loadGamesPage(path: string, options: LoaderOptions): Promise<ApiGamesListResponse | null> {
  return tryFetchApiJson<ApiGamesListResponse>(path, {
    ...options,
    revalidateSeconds: options.revalidateSeconds ?? 300
  });
}

export async function loadAllGamesResponse(options: LoaderOptions = {}, seasonLabel?: string): Promise<ApiGamesListResponse | null> {
  const pageSize = 100;
  const seasonQuery = seasonLabel ? `&season_label=${encodeURIComponent(seasonLabel)}` : "";
  const first = await loadGamesPage(`/api/v1/games?limit=${pageSize}&offset=0${seasonQuery}`, options);
  if (!first) return null;

  const games = [...(first.games ?? [])];
  const total = first.total ?? games.length;

  for (let offset = pageSize; offset < total; offset += pageSize) {
    const page = await loadGamesPage(`/api/v1/games?limit=${pageSize}&offset=${offset}${seasonQuery}`, options);
    games.push(...(page?.games ?? []));
  }

  return {
    ...first,
    games,
    total
  };
}

export async function loadSeasonsResponse(options: LoaderOptions = {}) {
  return tryFetchApiJson<ApiSeasonsResponse>("/api/v1/seasons", {
    ...options,
    revalidateSeconds: options.revalidateSeconds ?? 300
  });
}

export async function loadTeamAnalysisPageModel(options: LoaderOptions = {}) {
  const seasonsResponse = await loadSeasonsResponse(options);
  const gamesResponse = gamesResponseFromSeasons(seasonsResponse) ?? await loadAllGamesResponse(options);

  return createTeamAnalysisPageModel({ gamesResponse });
}

export async function loadSeasonTeamAnalysisPageModel(seasonLabel: string, options: LoaderOptions = {}) {
  const seasonsResponse = await loadSeasonsResponse(options);
  const gamesResponse = gamesResponseFromSeasons(seasonsResponse, seasonLabel) ?? await loadAllGamesResponse(options, seasonLabel);

  return createTeamAnalysisPageModel({ gamesResponse });
}
