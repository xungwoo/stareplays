import { CURRENT_USER } from "@/lib/fixtures/common";
import { VAULT_GAMES_FIXTURE } from "@/lib/fixtures/vault";
import { formatGameTime, formatStartTime, getRaceLetter } from "@/lib/utils/format";
import type { ApiGamePlayer, ApiGameSummary, ApiGamesListResponse } from "@/types/api";
import type { MatchStatus } from "@/types/common";
import type { VaultPageModel } from "@/types/vault";

export function getVaultPageModel(): VaultPageModel {
  return {
    currentUser: CURRENT_USER,
    games: VAULT_GAMES_FIXTURE
  };
}

function toNumber(value: unknown, fallback = 0): number {
  const candidate = Number(value);

  return Number.isFinite(candidate) ? candidate : fallback;
}

function normalizeAnalyzerStatus(value: string | undefined): MatchStatus {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "succeeded" || normalized === "done") return "DONE";
  if (normalized === "failed" || normalized === "invalid") return "INVALID";

  return "PENDING";
}

function isCurrentUserName(name: string, currentUser: string): boolean {
  return name.trim().toLowerCase() === currentUser.trim().toLowerCase();
}

function buildMatchup(players: ApiGamePlayer[]): string {
  const teamCounts = new Map<number, number>();

  players.forEach((player) => {
    const team = toNumber(player.team, 0);
    if (team <= 0) return;
    teamCounts.set(team, (teamCounts.get(team) ?? 0) + 1);
  });

  const counts = Array.from(teamCounts.values()).sort((left, right) => left - right);
  if (counts.length >= 2) {
    const [first, last] = [counts[0], counts[counts.length - 1]];
    return `${first}v${last}`;
  }

  if (players.length >= 2) {
    const sideSize = Math.max(1, Math.floor(players.length / 2));
    return `${sideSize}v${sideSize}`;
  }

  return "Custom";
}

function mapPlayer(rawPlayer: ApiGamePlayer, currentUser: string) {
  const cmd = toNumber(rawPlayer.cmd_count);
  const ecmd = toNumber(rawPlayer.effective_cmd_count);

  return {
    name: rawPlayer.name?.trim() || "Unknown",
    race: getRaceLetter(rawPlayer.race ?? "P"),
    apm: toNumber(rawPlayer.apm),
    eapm: toNumber(rawPlayer.eapm),
    cmd,
    ecmd,
    effective: cmd > 0 ? Number(((ecmd / cmd) * 100).toFixed(1)) : 0,
    redundancy: toNumber(rawPlayer.redundancy),
    production: Math.round((toNumber(rawPlayer.apm) + toNumber(rawPlayer.eapm)) / 1.5),
    isCurrentUser: isCurrentUserName(rawPlayer.name?.trim() || "", currentUser),
    startLocationX: rawPlayer.start_location_x != null ? toNumber(rawPlayer.start_location_x) : undefined,
    startLocationY: rawPlayer.start_location_y != null ? toNumber(rawPlayer.start_location_y) : undefined
  };
}

function splitTeams(players: ApiGamePlayer[], winnerTeamNumber: number) {
  if (winnerTeamNumber > 0) {
    return {
      winnerTeam: players.filter((player) => toNumber(player.team) === winnerTeamNumber),
      loserTeam: players.filter((player) => toNumber(player.team) > 0 && toNumber(player.team) !== winnerTeamNumber)
    };
  }

  const midpoint = Math.ceil(players.length / 2);
  return {
    winnerTeam: players.slice(0, midpoint),
    loserTeam: players.slice(midpoint)
  };
}

function buildMatchStory(game: ApiGameSummary, status: MatchStatus): string {
  if (status === "INVALID") {
    return "비정상 게임이거나 분석 산출물이 아직 준비되지 않았습니다.";
  }

  const mapName = game.map_name?.trim() || "선택된 맵";
  const playTime = formatGameTime(toNumber(game.game_length));

  return `${mapName} 경기의 API 기반 요약입니다. 플레이 시간은 ${playTime}이며 상세 분석 데이터가 없을 때는 공통 서술을 표시합니다.`;
}

function mapGame(game: ApiGameSummary, analysisStatuses: Record<string, string>, currentUser: string) {
  const players = Array.isArray(game.edges?.players) ? game.edges.players : [];
  const { winnerTeam, loserTeam } = splitTeams(players, toNumber(game.winner_team));
  const analyzerStatus = normalizeAnalyzerStatus(analysisStatuses[String(toNumber(game.id))]);
  const mappedWinnerTeam = winnerTeam.map((player) => mapPlayer(player, currentUser));
  const mappedLoserTeam = loserTeam.map((player) => mapPlayer(player, currentUser));

  return {
    id: toNumber(game.id),
    map: game.map_name?.trim() || "Unknown Map",
    matchup: buildMatchup(players),
    winnerTeam: mappedWinnerTeam,
    loserTeam: mappedLoserTeam,
    analyzerStatus,
    playTime: formatGameTime(toNumber(game.game_length)),
    startTime: formatStartTime(game.start_time ?? ""),
    matchStory: buildMatchStory(game, analyzerStatus),
    keyPlayer: mappedWinnerTeam[0]?.name,
    worstPlayer: mappedLoserTeam[0]?.name
  };
}

export function createVaultPageModel({
  currentUser = CURRENT_USER,
  gamesResponse
}: {
  currentUser?: string;
  gamesResponse?: ApiGamesListResponse | null;
} = {}): VaultPageModel {
  if (!gamesResponse) {
    return getVaultPageModel();
  }

  const analysisStatuses = gamesResponse.analysis_statuses ?? {};

  return {
    currentUser,
    games: (gamesResponse.games ?? []).map((game) => mapGame(game, analysisStatuses, currentUser))
  };
}
