import { RACE_COMPOSITIONS_FIXTURE, RANKINGS_FIXTURE } from "@/lib/fixtures/rankings";
import { CURRENT_USER } from "@/lib/fixtures/common";
import { getRaceLetter } from "@/lib/utils/format";
import type { ApiGamePlayer, ApiGamesListResponse, ApiRaceMatchupRow, ApiRaceMatchupsResponse, ApiRankingsResponse } from "@/types/api";
import type { RaceCode } from "@/types/common";
import type { RaceRankingRow, RankingsPageModel } from "@/types/rankings";

export function getRankingsPageModel(currentUser = CURRENT_USER): RankingsPageModel {
  return {
    currentUser,
    tabs: [
      { id: "rankings", label: "Rankings_3v3" },
      { id: "race_rankings", label: "Race_Rankings" },
      { id: "race_comp", label: "Race_Composition_WinRate" }
    ],
    summary: [
      { label: "Total Games", value: "43", accent: "cyan", hint: "Qualified 3v3 games" },
      { label: "Total Players", value: "6", accent: "violet", hint: "Tracked ranking rows" },
      { label: "Highest APM", value: "214.7", accent: "amber", hint: "3x3_smwoo" },
      { label: "Top Win Rate", value: "55.8%", accent: "emerald", hint: "3x3_GG / 3x3_smwoo" }
    ],
    rankings: RANKINGS_FIXTURE,
    raceRankings: [],
    raceCompositions: RACE_COMPOSITIONS_FIXTURE
  };
}

function toNumber(value: unknown, fallback = 0): number {
  const candidate = Number(value);

  return Number.isFinite(candidate) ? candidate : fallback;
}

function formatMetricNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function favoriteRaceFor(name: string) {
  return RANKINGS_FIXTURE.find((row) => row.user === name)?.favoriteRace ?? "P";
}

function isTrackedPlayer(player: ApiGamePlayer) {
  return Boolean(player.name?.trim().startsWith("3x3"));
}

function buildRaceRankings(gamesResponse?: ApiGamesListResponse | null): RaceRankingRow[] {
  const accumulators = new Map<string, { race: RaceCode | "R"; user: string; games: number; wins: number; losses: number; apmTotal: number }>();

  for (const game of gamesResponse?.games ?? []) {
    const winnerTeam = toNumber(game.winner_team);
    if (winnerTeam <= 0) continue;

    for (const player of game.edges?.players ?? []) {
      if (!isTrackedPlayer(player)) continue;

      const race = getRaceLetter(player.race ?? "P");
      const user = player.name?.trim() || "Unknown";
      const won = toNumber(player.team) === winnerTeam || player.is_winner === true;
      const keys: Array<RaceCode | "R"> = player.is_random_selected === true ? [race, "R"] : [race];

      for (const rankingRace of keys) {
        const key = `${rankingRace}:${user}`;
        const accumulator = accumulators.get(key) ?? { race: rankingRace, user, games: 0, wins: 0, losses: 0, apmTotal: 0 };
        accumulator.games += 1;
        accumulator.wins += won ? 1 : 0;
        accumulator.losses += won ? 0 : 1;
        accumulator.apmTotal += toNumber(player.apm);
        accumulators.set(key, accumulator);
      }
    }
  }

  return (["P", "T", "Z", "R"] as Array<RaceCode | "R">).flatMap((race) => {
    const rows = Array.from(accumulators.values())
      .filter((row) => row.race === race)
      .map((row) => ({
        race,
        rank: 0,
        user: row.user,
        games: row.games,
        wins: row.wins,
        losses: row.losses,
        winRate: row.games > 0 ? Number(((row.wins / row.games) * 100).toFixed(1)) : 0,
        avgApm: row.games > 0 ? Number((row.apmTotal / row.games).toFixed(1)) : 0
      }))
      .sort((left, right) => right.winRate - left.winRate || right.wins - left.wins || right.games - left.games || left.user.localeCompare(right.user));

    return rows.map((row, index) => ({ ...row, rank: index + 1 }));
  });
}

function mapRaceComposition(row: ApiRaceMatchupRow) {
  return {
    teamA: String(row.team_a ?? "")
      .split("")
      .filter(Boolean)
      .map((race) => getRaceLetter(race)),
    teamB: String(row.team_b ?? "")
      .split("")
      .filter(Boolean)
      .map((race) => getRaceLetter(race)),
    games: toNumber(row.games),
    teamAWinPct: toNumber(row.team_a_win_rate),
    teamBWinPct: toNumber(row.team_b_win_rate),
    teamAWins: toNumber(row.team_a_wins),
    teamBWins: toNumber(row.team_b_wins)
  };
}

export function createRankingsPageModel({
  currentUser = CURRENT_USER,
  rankingsResponse,
  raceMatchupsResponse,
  gamesResponse
}: {
  currentUser?: string;
  rankingsResponse?: ApiRankingsResponse | null;
  raceMatchupsResponse?: ApiRaceMatchupsResponse | null;
  gamesResponse?: ApiGamesListResponse | null;
} = {}): RankingsPageModel {
  const fallback = getRankingsPageModel(currentUser);
  const rankingRows = rankingsResponse?.rankings ?? rankingsResponse?.items;
  const rankings = rankingRows
    ? rankingRows.map((row) => ({
        rank: toNumber(row.rank),
        user: row.name?.trim() || "Unknown",
        winRate: toNumber(row.win_rate),
        wins: toNumber(row.wins),
        losses: toNumber(row.losses),
        draws: toNumber(row.draws),
        games: toNumber(row.games),
        avgApm: toNumber(row.avg_apm),
        avgEapm: toNumber(row.avg_eapm),
        isCurrentUser: row.name?.trim().toLowerCase() === currentUser.trim().toLowerCase(),
        favoriteRace: favoriteRaceFor(row.name?.trim() || "")
      }))
    : fallback.rankings;
  const raceRows = raceMatchupsResponse?.rows ?? raceMatchupsResponse?.items;
  const raceCompositions = raceRows ? raceRows.map(mapRaceComposition) : fallback.raceCompositions;
  const raceRankings = buildRaceRankings(gamesResponse);
  const maxGames = rankings.length > 0 ? Math.max(...rankings.map((row) => row.games)) : 0;
  const highestApm = rankings.reduce((best, row) => (row.avgApm > best.avgApm ? row : best), rankings[0] ?? fallback.rankings[0]);
  const topWinRate = rankings.length > 0 ? Math.max(...rankings.map((row) => row.winRate)) : 0;
  const topWinRateNames = rankings
    .filter((row) => row.winRate === topWinRate)
    .map((row) => row.user)
    .join(" / ");

  return {
    currentUser,
    tabs: fallback.tabs,
    rankings,
    raceRankings,
    raceCompositions,
    summary: [
      { label: "Total Games", value: String(maxGames || fallback.rankings[0]?.games || 0), accent: "cyan", hint: "Qualified 3v3 games" },
      { label: "Total Players", value: String(rankings.length), accent: "violet", hint: "Tracked ranking rows" },
      { label: "Highest APM", value: formatMetricNumber(highestApm?.avgApm ?? 0), accent: "amber", hint: highestApm?.user || fallback.summary[2]?.hint },
      { label: "Top Win Rate", value: `${formatMetricNumber(topWinRate)}%`, accent: "emerald", hint: topWinRateNames || fallback.summary[3]?.hint }
    ]
  };
}
