import { DASHBOARD_FIXTURE } from "@/lib/fixtures/dashboard";
import { CURRENT_USER } from "@/lib/fixtures/common";
import { getRaceLetter } from "@/lib/utils/format";
import type { ApiGamesListResponse, ApiPlayerRecord, ApiPlayerStatsResponse, ApiRankingsResponse, ApiUsersSuggestResponse } from "@/types/api";
import type { DashboardPageModel } from "@/types/dashboard";

export function getDashboardPageModel(): DashboardPageModel {
  return DASHBOARD_FIXTURE;
}

function toNumber(value: unknown, fallback = 0): number {
  const candidate = Number(value);

  return Number.isFinite(candidate) ? candidate : fallback;
}

function formatMetricNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatPercentValue(value: number): string {
  const normalized = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return `${normalized}%`;
}

function getRaceLabel(race: string) {
  switch (race) {
    case "T":
      return "TERRAN";
    case "Z":
      return "ZERG";
    default:
      return "PROTOSS";
  }
}

function mapRecordEntries(recordMap: Record<string, ApiPlayerRecord> | undefined) {
  return Object.entries(recordMap ?? {})
    .sort((left, right) => toNumber(right[1]?.total) - toNumber(left[1]?.total))
    .slice(0, 3)
    .map(([label, record]) => ({
      label,
      record: `${toNumber(record.wins)}-${toNumber(record.losses)}`,
      winRate: toNumber(record.win_rate)
    }));
}

function computeAnalyzerCoverage(gamesResponse: ApiGamesListResponse | null | undefined): string {
  const statuses = Object.values(gamesResponse?.analysis_statuses ?? {});
  if (statuses.length === 0) {
    return DASHBOARD_FIXTURE.metrics[3]?.value ?? "0%";
  }

  const completed = statuses.filter((status) => status.trim().toLowerCase() === "succeeded").length;
  return formatPercentValue(Number(((completed / statuses.length) * 100).toFixed(1)));
}

export function createDashboardPageModel({
  currentUser = CURRENT_USER,
  rankingsResponse,
  playerStatsResponse,
  suggestionsResponse,
  gamesResponse
}: {
  currentUser?: string;
  rankingsResponse?: ApiRankingsResponse | null;
  playerStatsResponse?: ApiPlayerStatsResponse | null;
  suggestionsResponse?: ApiUsersSuggestResponse | null;
  gamesResponse?: ApiGamesListResponse | null;
} = {}): DashboardPageModel {
  const fallback = getDashboardPageModel();
  const rankingRows = rankingsResponse?.rankings ?? rankingsResponse?.items ?? [];
  const playerStats = playerStatsResponse
      ? {
        name: playerStatsResponse.player_name?.trim() || currentUser,
        favoriteRace: getRaceLetter(playerStatsResponse.favorite_race ?? fallback.playerStats.favoriteRace),
        favoriteRaceLabel: getRaceLabel(getRaceLetter(playerStatsResponse.favorite_race ?? fallback.playerStats.favoriteRace)),
        winRate: toNumber(playerStatsResponse.win_rate),
        games: toNumber(playerStatsResponse.total_games),
        wins: toNumber(playerStatsResponse.wins),
        losses: toNumber(playerStatsResponse.losses),
        draws: toNumber(playerStatsResponse.draws),
        avgApm: toNumber(playerStatsResponse.average_apm),
        avgEapm: toNumber(playerStatsResponse.average_eapm),
        raceStats: mapRecordEntries(playerStatsResponse.race_stats),
        matchupStats: mapRecordEntries(playerStatsResponse.matchup_stats),
        mapStats: mapRecordEntries(playerStatsResponse.map_stats)
      }
    : fallback.playerStats;
  const topApmRow = rankingRows.reduce<{ avg_apm?: number; name?: string } | null>((best, row) => {
    if (!best || toNumber(row.avg_apm) > toNumber(best.avg_apm)) {
      return row;
    }
    return best;
  }, null);
  const trackedGames = rankingRows.length > 0 ? Math.max(...rankingRows.map((row) => toNumber(row.games))) : playerStats.games;
  const uploadCandidates = suggestionsResponse?.users?.length ? suggestionsResponse.users : fallback.uploadCandidates;

  return {
    ...fallback,
    currentUser,
    uploadCandidates,
    playerStats,
    metrics: [
      {
        label: "Tracked Games",
        value: String(trackedGames || fallback.playerStats.games),
        accent: "cyan",
        hint: "Qualified 3v3 snapshots"
      },
      {
        label: "Current User Win Rate",
        value: formatPercentValue(playerStats.winRate),
        accent: "emerald",
        hint: currentUser
      },
      {
        label: "Peak Avg APM",
        value: formatMetricNumber(toNumber(topApmRow?.avg_apm, fallback.playerStats.avgApm)),
        accent: "amber",
        hint: topApmRow?.name || fallback.metrics[2]?.hint
      },
      {
        label: "Analyzer Coverage",
        value: computeAnalyzerCoverage(gamesResponse),
        accent: "violet",
        hint: "DONE / TOTAL"
      }
    ]
  };
}
