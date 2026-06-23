import { formatStartTime } from "@/lib/utils/format";
import { displayLineupName, displayPlayerName, displayPlayerNames } from "@/lib/utils/player-display";
import type { ApiGamePlayer, ApiGameSummary, ApiSeasonsResponse } from "@/types/api";

export interface SeasonGameRecord {
  id: number;
  seasonLabel: string;
  seasonNo: number | null;
  startTime: string;
  mapName: string;
  durationMinutes: number;
  winner: string[];
  loser: string[];
  winnerLabel: string;
  loserLabel: string;
}

export interface SeasonTrendPoint {
  gameIndex: number;
  gameId: number;
  seasonLabel: string;
  startTime: string;
  wins: number;
  losses: number;
  winRate: number;
}

export interface SeasonPlayerStanding {
  name: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  averageApm: number;
  averageEapm: number;
  trend: SeasonTrendPoint[];
}

export interface SeasonSummaryRow {
  label: string;
  seasonNo: number | null;
  games: number;
  playerCount: number;
  teamOneWinRate: number;
  teamTwoWinRate: number;
  topWinner: string;
  bestWinRatePlayer: string;
}

export interface SeasonAnalysisPageModel {
  selectedSeasonLabel: string | null;
  availableSeasons: Array<{ label: string; seasonNo: number | null; games: number }>;
  summary: {
    totalGames: number;
    totalSeasons: number;
    totalPlayers: number;
    topWinner: string;
    bestWinRatePlayer: string;
    latestSeason: string;
  };
  seasonSummaries: SeasonSummaryRow[];
  playerStandings: SeasonPlayerStanding[];
  gameRecords: SeasonGameRecord[];
  trendSeries: Array<{ name: string; color: string }>;
  trendPoints: Array<Record<string, number | string>>;
}

type NormalizedGame = {
  id: number;
  seasonLabel: string;
  seasonNo: number | null;
  startTimeRaw: string;
  startTime: string;
  mapName: string;
  durationMinutes: number;
  winner: string[];
  loser: string[];
  players: Array<{
    name: string;
    displayName: string;
    apm: number;
    eapm: number;
    won: boolean;
  }>;
};

const trendColors = ["#67becf", "#65be96", "#9d8bcb", "#daa555", "#da7070", "#7da4d6"];

function toNumber(value: unknown, fallback = 0) {
  const candidate = Number(value);

  return Number.isFinite(candidate) ? candidate : fallback;
}

function round(value: number, digits = 1) {
  const multiplier = 10 ** digits;

  return Math.round(value * multiplier) / multiplier;
}

function winRate(wins: number, games: number) {
  return games > 0 ? round((wins / games) * 100, 1) : 0;
}

function isTrackedPlayer(player: ApiGamePlayer) {
  return Boolean(player.name?.startsWith("3x3"));
}

function playersForTeam(game: ApiGameSummary, team: number) {
  return (game.edges?.players ?? []).filter((player) => isTrackedPlayer(player) && toNumber(player.team) === team);
}

function normalizeGame(game: ApiGameSummary, fallbackSeasonLabel: string, fallbackSeasonNo: number | null): NormalizedGame | null {
	const winnerTeam = toNumber(game.winner_team);
	if (winnerTeam <= 0) return null;

  const teams = Array.from(new Set((game.edges?.players ?? []).map((player) => toNumber(player.team)).filter((team) => team > 0)));
  const loserTeam = teams.find((team) => team !== winnerTeam) ?? 0;
	const winnerPlayers = playersForTeam(game, winnerTeam);
	const loserPlayers = playersForTeam(game, loserTeam);

	if (winnerPlayers.length !== 3 || loserPlayers.length !== 3) return null;

  const startTimeRaw = game.start_time ?? "";
  const seasonLabel = game.season_label ?? fallbackSeasonLabel;
  const seasonNo = game.season_no ?? fallbackSeasonNo;
  const allTrackedPlayers = [...winnerPlayers, ...loserPlayers];

  return {
    id: toNumber(game.id),
    seasonLabel,
    seasonNo,
    startTimeRaw,
    startTime: formatStartTime(startTimeRaw),
    mapName: game.map_name?.trim() || "Unknown Map",
    durationMinutes: round(toNumber(game.game_length) / 60, 1),
    winner: displayPlayerNames(winnerPlayers.map((player) => player.name ?? "")),
    loser: displayPlayerNames(loserPlayers.map((player) => player.name ?? "")),
    players: allTrackedPlayers.map((player) => ({
      name: player.name ?? "Unknown",
      displayName: displayPlayerName(player.name ?? "Unknown"),
      apm: toNumber(player.apm),
      eapm: toNumber(player.eapm),
      won: toNumber(player.team) === winnerTeam
    }))
  };
}

function getAllGames(seasonsResponse?: ApiSeasonsResponse | null, selectedSeasonLabel?: string | null) {
  return (seasonsResponse?.seasons ?? [])
    .filter((season) => !selectedSeasonLabel || season.season_label === selectedSeasonLabel)
    .flatMap((season) =>
      (season.games_data ?? [])
        .map((game) => normalizeGame(game, season.season_label ?? "시즌 미지정", season.season_no ?? null))
        .filter((game): game is NormalizedGame => game != null)
    )
    .sort((left, right) => {
      const timeSort = left.startTimeRaw.localeCompare(right.startTimeRaw);
      return timeSort || left.id - right.id;
    });
}

function buildPlayerStandings(games: NormalizedGame[]): SeasonPlayerStanding[] {
  const players = new Map<string, SeasonPlayerStanding & { apmTotal: number; eapmTotal: number }>();

  games.forEach((game, gameIndex) => {
    game.players.forEach((player) => {
      const existing = players.get(player.name) ?? {
        name: player.displayName,
        games: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        averageApm: 0,
        averageEapm: 0,
        trend: [],
        apmTotal: 0,
        eapmTotal: 0
      };

      existing.games += 1;
      existing.wins += player.won ? 1 : 0;
      existing.losses += player.won ? 0 : 1;
      existing.apmTotal += player.apm;
      existing.eapmTotal += player.eapm;
      existing.winRate = winRate(existing.wins, existing.games);
      existing.averageApm = round(existing.apmTotal / Math.max(existing.games, 1), 1);
      existing.averageEapm = round(existing.eapmTotal / Math.max(existing.games, 1), 1);
      existing.trend.push({
        gameIndex: gameIndex + 1,
        gameId: game.id,
        seasonLabel: game.seasonLabel,
        startTime: game.startTime,
        wins: existing.wins,
        losses: existing.losses,
        winRate: existing.winRate
      });
      players.set(player.name, existing);
    });
  });

  return Array.from(players.values())
    .map(({ apmTotal: _apmTotal, eapmTotal: _eapmTotal, ...player }) => player)
    .sort((left, right) => right.wins - left.wins || right.winRate - left.winRate || right.games - left.games || left.name.localeCompare(right.name, "ko"));
}

function buildGameRecords(games: NormalizedGame[]): SeasonGameRecord[] {
  return games.map((game) => ({
    id: game.id,
    seasonLabel: game.seasonLabel,
    seasonNo: game.seasonNo,
    startTime: game.startTime,
    mapName: game.mapName,
    durationMinutes: game.durationMinutes,
    winner: game.winner,
    loser: game.loser,
    winnerLabel: displayLineupName(game.winner),
    loserLabel: displayLineupName(game.loser)
  }));
}

function buildSeasonSummaries(seasonsResponse?: ApiSeasonsResponse | null): SeasonSummaryRow[] {
  return (seasonsResponse?.seasons ?? []).map((season) => {
    const games = getAllGames({ seasons: [season] });
    const standings = buildPlayerStandings(games);
    const teamOneWins = toNumber(season.wins_by_team?.["1"]);
    const teamTwoWins = toNumber(season.wins_by_team?.["2"]);
    const playerNames = new Set(games.flatMap((game) => game.players.map((player) => player.displayName)));
    const bestWinRatePlayer = [...standings]
      .filter((player) => player.games >= 1)
      .sort((left, right) => right.winRate - left.winRate || right.games - left.games)[0]?.name ?? "-";

    return {
      label: season.season_label ?? "시즌 미지정",
      seasonNo: season.season_no ?? null,
      games: games.length,
      playerCount: playerNames.size,
      teamOneWinRate: winRate(teamOneWins, games.length),
      teamTwoWinRate: winRate(teamTwoWins, games.length),
      topWinner: standings[0]?.name ?? "-",
      bestWinRatePlayer
    };
  }).sort((left, right) => toNumber(left.seasonNo) - toNumber(right.seasonNo));
}

function buildTrendData(players: SeasonPlayerStanding[], games: NormalizedGame[]) {
  const topPlayers = players.slice(0, 6);
  const trendSeries = topPlayers.map((player, index) => ({
    name: player.name,
    color: trendColors[index % trendColors.length]
  }));
  const trendPoints = games.map((game, index) => {
    const point: Record<string, number | string> = {
      gameIndex: index + 1,
      label: `${index + 1}G`,
      season: game.seasonLabel
    };

    trendSeries.forEach((series) => {
      const player = topPlayers.find((candidate) => candidate.name === series.name);
      const latest = player?.trend.filter((trend) => trend.gameIndex <= index + 1).at(-1);
      if (latest) point[series.name] = latest.winRate;
    });

    return point;
  });

  return { trendSeries, trendPoints };
}

export function createSeasonAnalysisPageModel({
  seasonsResponse,
  selectedSeasonLabel = null
}: {
  seasonsResponse?: ApiSeasonsResponse | null;
  selectedSeasonLabel?: string | null;
} = {}): SeasonAnalysisPageModel {
  const games = getAllGames(seasonsResponse, selectedSeasonLabel);
  const playerStandings = buildPlayerStandings(games);
  const seasonSummaries = buildSeasonSummaries(seasonsResponse);
  const { trendSeries, trendPoints } = buildTrendData(playerStandings, games);
	const availableSeasons = (seasonsResponse?.seasons ?? []).map((season) => ({
		label: season.season_label ?? "시즌 미지정",
		seasonNo: season.season_no ?? null,
		games: getAllGames({ seasons: [season] }).length
	}));

  return {
    selectedSeasonLabel,
    availableSeasons,
    summary: {
      totalGames: games.length,
      totalSeasons: selectedSeasonLabel ? 1 : availableSeasons.length,
      totalPlayers: playerStandings.length,
      topWinner: playerStandings[0]?.name ?? "-",
      bestWinRatePlayer: [...playerStandings].sort((left, right) => right.winRate - left.winRate || right.games - left.games)[0]?.name ?? "-",
      latestSeason: availableSeasons.at(-1)?.label ?? "-"
    },
    seasonSummaries,
    playerStandings,
    gameRecords: buildGameRecords(games),
    trendSeries,
    trendPoints
  };
}
