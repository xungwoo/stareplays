import { createTeamAnalysisPageModel } from "@/lib/adapters/team-analysis";
import { createSeasonAnalysisPageModel } from "@/lib/adapters/season-analysis";
import { tryFetchApiJson, type LoaderOptions } from "@/lib/api/client";
import type { ApiGamesListResponse, ApiSeasonsResponse } from "@/types/api";

async function loadGamesPage(path: string, options: LoaderOptions): Promise<ApiGamesListResponse | null> {
  return tryFetchApiJson<ApiGamesListResponse>(path, {
    ...options,
    revalidateSeconds: options.revalidateSeconds ?? 300
  });
}

function filterGamesResponseBySeason(gamesResponse: ApiGamesListResponse | null, seasonLabel?: string): ApiGamesListResponse | null {
  const targetSeason = seasonLabel?.trim();
  if (!gamesResponse || !targetSeason) return gamesResponse;

  const games = (gamesResponse.games ?? []).filter((game) => game.season_label?.trim() === targetSeason);
  const includedIds = new Set(games.filter((game) => game.id != null).map((game) => String(game.id)));

  return {
    ...gamesResponse,
    games,
    total: games.length,
    has_more: false,
    analysis_statuses: Object.fromEntries(
      Object.entries(gamesResponse.analysis_statuses ?? {}).filter(([gameId]) => includedIds.has(gameId))
    )
  };
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

  const response = {
    ...first,
    games,
    total
  };

  return filterGamesResponseBySeason(response, seasonLabel);
}

export async function loadSeasonsResponse(options: LoaderOptions = {}) {
  return tryFetchApiJson<ApiSeasonsResponse>("/api/v1/seasons", {
    ...options,
    revalidateSeconds: options.revalidateSeconds ?? 300
  });
}

function seasonsResponseFromGames(gamesResponse: ApiGamesListResponse | null, seasonsResponse?: ApiSeasonsResponse | null): ApiSeasonsResponse {
  const games = gamesResponse?.games ?? [];
  const summaries = new Map<string, NonNullable<ApiSeasonsResponse["seasons"]>[number]>();

  for (const season of seasonsResponse?.seasons ?? []) {
    const label = season.season_label?.trim();
    if (!label) continue;
    summaries.set(label, {
      ...season,
      games: 0,
      wins_by_team: {},
      game_ids: [],
      games_data: []
    });
  }

  for (const game of games) {
    const label = game.season_label?.trim();
    if (!label) continue;

    const summary = summaries.get(label) ?? {
      season_label: label,
      season_no: game.season_no ?? null,
      games: 0,
      wins_by_team: {},
      game_ids: [],
      games_data: []
    };

    summary.season_no = summary.season_no ?? game.season_no ?? null;
    summary.games = (summary.games_data?.length ?? 0) + 1;
    summary.game_ids = [...(summary.game_ids ?? []), ...(game.id == null ? [] : [game.id])];
    summary.games_data = [...(summary.games_data ?? []), game];
    if (game.winner_team) {
      const key = String(game.winner_team);
      summary.wins_by_team = {
        ...(summary.wins_by_team ?? {}),
        [key]: (summary.wins_by_team?.[key] ?? 0) + 1
      };
    }
    summaries.set(label, summary);
  }

  const seasons = Array.from(summaries.values())
    .filter((season) => (season.games_data?.length ?? 0) > 0)
    .sort((a, b) => (a.season_no ?? Number.MAX_SAFE_INTEGER) - (b.season_no ?? Number.MAX_SAFE_INTEGER));

  return {
    current: seasonsResponse?.current,
    total: seasons.length,
    seasons
  };
}

export async function loadTeamAnalysisPageModel(options: LoaderOptions = {}) {
  const gamesResponse = await loadAllGamesResponse(options);

  return createTeamAnalysisPageModel({ gamesResponse });
}

export async function loadSeasonTeamAnalysisPageModel(seasonLabel: string, options: LoaderOptions = {}) {
  const gamesResponse = await loadAllGamesResponse(options, seasonLabel);

  return createTeamAnalysisPageModel({ gamesResponse });
}

export async function loadSeasonAnalysisPageModel(options: LoaderOptions = {}, selectedSeasonLabel?: string) {
  const [seasonsResponse, gamesResponse] = await Promise.all([
    loadSeasonsResponse(options),
    loadAllGamesResponse(options, selectedSeasonLabel)
  ]);
  const analysisSeasonsResponse = seasonsResponseFromGames(gamesResponse, seasonsResponse);

  return createSeasonAnalysisPageModel({
    seasonsResponse: analysisSeasonsResponse,
    selectedSeasonLabel
  });
}
