import {
  ANALYZER_COMPARISON_FIXTURE,
  ANALYZER_CURRENT_USER,
  ANALYZER_DEFAULT_GAME_ID,
  ANALYZER_GAMES_FIXTURE,
  ANALYZER_TIMELINE_FIXTURE,
  generateApmSeries,
  generateResourceSeries,
  generateUnitProductionSeries
} from "@/lib/fixtures/analyzer";
import { createVaultPageModel } from "@/lib/adapters/vault";
import type { ApiAnalyzerPlayerFinal, ApiAnalyzerPlayerSeries, ApiGameAnalyzerResponse, ApiGameDetailResponse, ApiGamesListResponse, ApiPlayerSeriesRow, ApiSeriesPoint } from "@/types/api";
import type { AnalyzerApmPoint, AnalyzerGameInsight, AnalyzerPageModel, SeriesPoint, TeamComparison, TimelineEvent } from "@/types/analyzer";
import type { VaultGame, VaultPlayer } from "@/types/vault";

const ANALYZER_TABS: AnalyzerPageModel["tabs"] = [
  { id: "match_flow", label: "Match Flow" },
  { id: "apm", label: "APM" },
  { id: "resource", label: "Resource Spend" },
  { id: "unit_prod", label: "Unit Production" },
  { id: "tech", label: "Tech / Upgrade" }
];

function toNumber(value: unknown, fallback = 0): number {
  const candidate = Number(value);

  return Number.isFinite(candidate) ? candidate : fallback;
}

function normalizeName(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function formatTimelineTime(second: number): string {
  const safeSecond = Math.max(0, Math.floor(second));
  const minutes = Math.floor(safeSecond / 60);
  const seconds = safeSecond % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function makeNameSet(players: VaultPlayer[]): Set<string> {
  return new Set(players.map((player) => normalizeName(player.name)));
}

function getMinutesFromGame(game: VaultGame): number {
  return Math.max(6, Number(game.playTime.split(":")[0]) + 1);
}

function getFallbackInsight(game: VaultGame): AnalyzerGameInsight {
  const minutes = getMinutesFromGame(game);

  return {
    players: [...game.winnerTeam, ...game.loserTeam],
    timeline: ANALYZER_TIMELINE_FIXTURE,
    comparison: ANALYZER_COMPARISON_FIXTURE,
    apmSeries: generateApmSeries(minutes),
    resourceSeries: generateResourceSeries(minutes),
    unitProductionSeries: generateUnitProductionSeries(minutes),
    keyPlayer: game.keyPlayer,
    worstPlayer: game.worstPlayer
  };
}

function getPlayerSideResolver(game: VaultGame, analyzer?: ApiGameAnalyzerResponse | null) {
  const winnerNames = makeNameSet(game.winnerTeam);
  const loserNames = makeNameSet(game.loserTeam);
  const summaryPlayers = analyzer?.result?.summary?.players ?? [];
  const winnerTeamNumberFromPlayer = summaryPlayers.find((player) => winnerNames.has(normalizeName(player.player_name)))?.team;
  const winnerTeamNumber = toNumber(winnerTeamNumberFromPlayer, toNumber(analyzer?.result?.analysis_phase?.winner_team_candidate, 0));

  return {
    winnerNames,
    loserNames,
    sideForName(name: string | undefined): "WINNER" | "LOSER" | null {
      const normalized = normalizeName(name);
      if (winnerNames.has(normalized)) return "WINNER";
      if (loserNames.has(normalized)) return "LOSER";
      return null;
    },
    sideForTeam(team: number | undefined): "WINNER" | "LOSER" | null {
      if (!winnerTeamNumber || !team) return null;
      return team === winnerTeamNumber ? "WINNER" : "LOSER";
    }
  };
}

function buildEnhancedPlayers(game: VaultGame, detail?: ApiGameDetailResponse | null): VaultPlayer[] {
  const productionByPlayer = new Map(
    (detail?.unit_production?.summaries ?? []).map((row) => [normalizeName(row.player_name), toNumber(row.total)])
  );

  return [...game.winnerTeam, ...game.loserTeam].map((player) => ({
    ...player,
    production: productionByPlayer.get(normalizeName(player.name)) ?? player.production
  }));
}

function findPlayerFinal(analyzer: ApiGameAnalyzerResponse | null | undefined, playerName: string): ApiAnalyzerPlayerFinal | undefined {
  const normalized = normalizeName(playerName);
  return analyzer?.result?.summary?.players?.find((player) => normalizeName(player.player_name) === normalized)?.final;
}

function findPlayerSpend(detail: ApiGameDetailResponse | null | undefined, playerName: string): number {
  const normalized = normalizeName(playerName);
  const summary = detail?.resource_spend?.summaries?.find((row) => normalizeName(row.player_name) === normalized);
  return toNumber(summary?.total_spend);
}

function findPlayerProduction(detail: ApiGameDetailResponse | null | undefined, playerName: string): number {
  const normalized = normalizeName(playerName);
  const summary = detail?.unit_production?.summaries?.find((row) => normalizeName(row.player_name) === normalized);
  return toNumber(summary?.total);
}

function findPlayerTechCount(detail: ApiGameDetailResponse | null | undefined, playerName: string): number {
  const normalized = normalizeName(playerName);
  const summary = detail?.tech_tree?.summary?.find((row) => normalizeName(row.player_name) === normalized);
  return toNumber(summary?.tech_count) + toNumber(summary?.upgrade_count);
}

function impactScore(player: VaultPlayer, detail?: ApiGameDetailResponse | null, analyzer?: ApiGameAnalyzerResponse | null): number {
  const final = findPlayerFinal(analyzer, player.name);
  const spend = findPlayerSpend(detail, player.name);
  const production = findPlayerProduction(detail, player.name);

  return (
    toNumber(final?.kills) * 3 +
    toNumber(final?.worker_peak) * 1.2 +
    toNumber(final?.supply_peak_used) * 0.6 +
    toNumber(final?.vision_score_final) * 2 +
    toNumber(final?.enemy_zone_coverage) * 30 +
    spend / 1000 +
    production / 8 -
    toNumber(final?.deaths) * 1.5
  );
}

function downsideScore(player: VaultPlayer, detail?: ApiGameDetailResponse | null, analyzer?: ApiGameAnalyzerResponse | null): number {
  const final = findPlayerFinal(analyzer, player.name);

  return (
    toNumber(final?.deaths) * 3 -
    toNumber(final?.kills) * 2 -
    toNumber(final?.worker_peak) * 0.8 -
    toNumber(final?.vision_score_final) * 1.5 -
    toNumber(final?.enemy_zone_coverage) * 15
  );
}

function buildComparison(game: VaultGame, detail?: ApiGameDetailResponse | null, analyzer?: ApiGameAnalyzerResponse | null): TeamComparison {
  const resolver = getPlayerSideResolver(game, analyzer);
  const summaryTeams = analyzer?.result?.summary?.teams ?? [];
  const summaryPlayers = analyzer?.result?.summary?.players ?? [];
  const kills = { winner: 0, loser: 0 };

  summaryTeams.forEach((team) => {
    const side = resolver.sideForTeam(toNumber(team.team));
    if (side === "WINNER") kills.winner = toNumber(team.kills);
    if (side === "LOSER") kills.loser = toNumber(team.kills);
  });

  if (kills.winner === 0 && kills.loser === 0) {
    summaryPlayers.forEach((player) => {
      const side = resolver.sideForName(player.player_name) ?? resolver.sideForTeam(toNumber(player.team));
      if (side === "WINNER") kills.winner += toNumber(player.final?.kills);
      if (side === "LOSER") kills.loser += toNumber(player.final?.kills);
    });
  }

  const workerPeak = { winner: 0, loser: 0 };
  summaryPlayers.forEach((player) => {
    const side = resolver.sideForName(player.player_name) ?? resolver.sideForTeam(toNumber(player.team));
    if (side === "WINNER") workerPeak.winner += toNumber(player.final?.worker_peak);
    if (side === "LOSER") workerPeak.loser += toNumber(player.final?.worker_peak);
  });

  const totalSpend = { winner: 0, loser: 0 };
  (detail?.resource_spend?.summaries ?? []).forEach((row) => {
    const side = resolver.sideForName(row.player_name);
    if (side === "WINNER") totalSpend.winner += toNumber(row.total_spend);
    if (side === "LOSER") totalSpend.loser += toNumber(row.total_spend);
  });

  const techUpg = { winner: 0, loser: 0 };
  (detail?.tech_tree?.summary ?? []).forEach((row) => {
    const side = resolver.sideForName(row.player_name);
    const count = toNumber(row.tech_count) + toNumber(row.upgrade_count);
    if (side === "WINNER") techUpg.winner += count;
    if (side === "LOSER") techUpg.loser += count;
  });

  return {
    kills,
    workerPeak,
    totalSpend,
    techUpg
  };
}

function buildMatchStory(game: VaultGame, comparison: TeamComparison, keyPlayer?: string): string {
  const parts: string[] = [];
  const killDiff = Math.abs(comparison.kills.winner - comparison.kills.loser);
  const workerDiff = Math.abs(comparison.workerPeak.winner - comparison.workerPeak.loser);
  const spendDiff = Math.abs(comparison.totalSpend.winner - comparison.totalSpend.loser);

  if (killDiff >= 3) {
    parts.push(`${comparison.kills.winner > comparison.kills.loser ? "Winner" : "Loser"} side가 교전 교환비에서 앞섰다.`);
  }
  if (workerDiff >= 3) {
    parts.push(`${comparison.workerPeak.winner > comparison.workerPeak.loser ? "Winner" : "Loser"} side가 더 안정적인 경제 규모를 유지했다.`);
  }
  if (spendDiff >= 800) {
    parts.push(`${comparison.totalSpend.winner > comparison.totalSpend.loser ? "Winner" : "Loser"} side가 더 많은 자원을 전장과 테크에 투입했다.`);
  }
  if (keyPlayer) {
    parts.push(`${keyPlayer}가 시야 장악과 운영 지표에서 가장 눈에 띄었다.`);
  }

  return parts.length > 0 ? parts.join(" ") : game.matchStory;
}

function mapTimelineType(kind: string | undefined): TimelineEvent["type"] {
  const normalized = kind?.trim().toLowerCase() ?? "";
  if (normalized === "prereq_building" || normalized.includes("building")) return "BUILDING";
  if (normalized === "tech" || normalized === "upgrade") return "UPGRADE";
  return "UNIT";
}

function buildTimeline(game: VaultGame, detail?: ApiGameDetailResponse | null, analyzer?: ApiGameAnalyzerResponse | null): TimelineEvent[] {
  const resolver = getPlayerSideResolver(game, analyzer);
  const techEvents = (detail?.tech_tree?.events ?? []).map((event) => ({
    second: toNumber(event.second),
    row: {
      time: formatTimelineTime(toNumber(event.second)),
      event: event.name?.trim() || "Tech Event",
      player: event.player_name?.trim() || "-",
      type: mapTimelineType(event.kind),
      team: resolver.sideForName(event.player_name) ?? "WINNER"
    } satisfies TimelineEvent
  }));
  const matchFlowEvents = (analyzer?.result?.match_flow?.events ?? []).map((event) => ({
    second: toNumber(event.second),
    importance: toNumber(event.importance),
    row: {
      time: formatTimelineTime(toNumber(event.second)),
      event: event.title?.trim() || event.type?.trim() || "Match Event",
      player: event.player_name?.trim() || "-",
      type: mapTimelineType(event.type),
      team: resolver.sideForName(event.player_name) ?? resolver.sideForTeam(toNumber(event.team)) ?? "WINNER"
    } satisfies TimelineEvent
  }));

  const rows = [...techEvents, ...matchFlowEvents];
  rows.sort((left, right) => {
    if (left.second === right.second) {
      return toNumber((right as { importance?: number }).importance) - toNumber((left as { importance?: number }).importance);
    }
    return left.second - right.second;
  });

  return rows.map((item) => item.row);
}

function buildApmSeries(detail?: ApiGameDetailResponse | null): AnalyzerApmPoint[] {
  const rows = detail?.detail?.apm_timeline ?? [];
  const pointCount = Math.max(0, ...rows.map((row) => row.data_points?.length ?? 0));
  if (pointCount === 0) {
    return [];
  }

  return Array.from({ length: pointCount }, (_, index) => {
    const point: AnalyzerApmPoint = { time: index + 1 };
    rows.forEach((row) => {
      const playerName = row.player_name?.trim();
      if (!playerName) return;
      point[playerName] = toNumber(row.data_points?.[index]?.apm);
    });
    return point;
  });
}

function aggregateIndexedSeries<T extends ApiPlayerSeriesRow | ApiAnalyzerPlayerSeries>(
  rows: T[],
  game: VaultGame,
  analyzer: ApiGameAnalyzerResponse | null | undefined,
  getPoints: (row: T) => ApiSeriesPoint[] | undefined,
  pickValue: (point: ApiSeriesPoint) => number
): SeriesPoint[] {
  const resolver = getPlayerSideResolver(game, analyzer);
  const pointCount = Math.max(0, ...rows.map((row) => getPoints(row)?.length ?? 0));
  if (pointCount === 0) {
    return [];
  }

  return Array.from({ length: pointCount }, (_, index) => {
    let winner = 0;
    let loser = 0;

    rows.forEach((row) => {
      const side = resolver.sideForName(row.player_name) ?? resolver.sideForTeam(toNumber(row.team));
      const point = getPoints(row)?.[index];
      if (!side || !point) return;
      if (side === "WINNER") winner += pickValue(point);
      if (side === "LOSER") loser += pickValue(point);
    });

    return {
      time: index + 1,
      winner,
      loser
    };
  });
}

function buildAnalyzerInsight(game: VaultGame, detail?: ApiGameDetailResponse | null, analyzer?: ApiGameAnalyzerResponse | null): AnalyzerGameInsight {
  const fallback = getFallbackInsight(game);
  const players = buildEnhancedPlayers(game, detail);
  const playersWithFinals = players.filter((player) => findPlayerFinal(analyzer, player.name));
  const loserPlayersWithFinals = game.loserTeam.filter((player) => findPlayerFinal(analyzer, player.name));
  const comparison = buildComparison(game, detail, analyzer);
  const keyPlayerPool = playersWithFinals.length > 0 ? playersWithFinals : [...game.winnerTeam, ...game.loserTeam];
  const worstPlayerPool = loserPlayersWithFinals.length > 0 ? loserPlayersWithFinals : game.loserTeam;
  const keyPlayer = keyPlayerPool
    .slice()
    .sort((left, right) => impactScore(right, detail, analyzer) - impactScore(left, detail, analyzer))[0]?.name;
  const worstPlayer = worstPlayerPool
    .slice()
    .sort((left, right) => downsideScore(right, detail, analyzer) - downsideScore(left, detail, analyzer))[0]?.name;
  const timeline = buildTimeline(game, detail, analyzer);
  const apmSeries = buildApmSeries(detail);
  const resourceSeries = aggregateIndexedSeries(detail?.resource_spend?.timelines ?? [], game, analyzer, (row) => row.data_points, (point) => toNumber(point.total));
  const unitProductionSeries = aggregateIndexedSeries(detail?.unit_production?.timelines ?? [], game, analyzer, (row) => row.data_points, (point) => toNumber(point.count));

  return {
    players,
    timeline: timeline.length > 0 ? timeline : fallback.timeline,
    comparison:
      comparison.kills.winner || comparison.kills.loser || comparison.totalSpend.winner || comparison.totalSpend.loser
        ? comparison
        : fallback.comparison,
    apmSeries: apmSeries.length > 0 ? apmSeries : fallback.apmSeries,
    resourceSeries: resourceSeries.length > 0 ? resourceSeries : fallback.resourceSeries,
    unitProductionSeries: unitProductionSeries.length > 0 ? unitProductionSeries : fallback.unitProductionSeries,
    keyPlayer: keyPlayer ?? fallback.keyPlayer,
    worstPlayer: worstPlayer ?? fallback.worstPlayer
  };
}

function applyInsightToGame(game: VaultGame, insight: AnalyzerGameInsight): VaultGame {
  const playerByName = new Map(insight.players.map((player) => [normalizeName(player.name), player]));

  return {
    ...game,
    winnerTeam: game.winnerTeam.map((player) => playerByName.get(normalizeName(player.name)) ?? player),
    loserTeam: game.loserTeam.map((player) => playerByName.get(normalizeName(player.name)) ?? player),
    keyPlayer: insight.keyPlayer ?? game.keyPlayer,
    worstPlayer: insight.worstPlayer ?? game.worstPlayer,
    matchStory: buildMatchStory(game, insight.comparison, insight.keyPlayer)
  };
}

export function getAnalyzerPageModel(selectedGameId = ANALYZER_DEFAULT_GAME_ID): AnalyzerPageModel {
  const selectedGame = ANALYZER_GAMES_FIXTURE.find((game) => game.id === selectedGameId) ?? ANALYZER_GAMES_FIXTURE.find((game) => game.id === ANALYZER_DEFAULT_GAME_ID) ?? ANALYZER_GAMES_FIXTURE[0];
  const insight = getFallbackInsight(selectedGame);

  return {
    currentUser: ANALYZER_CURRENT_USER,
    selectedGameId: selectedGame.id,
    games: ANALYZER_GAMES_FIXTURE,
    selectedGame,
    players: insight.players,
    tabs: ANALYZER_TABS,
    timeline: insight.timeline,
    comparison: insight.comparison,
    apmSeries: insight.apmSeries,
    resourceSeries: insight.resourceSeries,
    unitProductionSeries: insight.unitProductionSeries,
    insightsByGameId: Object.fromEntries(ANALYZER_GAMES_FIXTURE.map((game) => [game.id, getFallbackInsight(game)]))
  };
}

export function createAnalyzerPageModel({
  currentUser = ANALYZER_CURRENT_USER,
  gamesResponse,
  detailsByGameId = {},
  analyzersByGameId = {},
  selectedGameId
}: {
  currentUser?: string;
  gamesResponse?: ApiGamesListResponse | null;
  detailsByGameId?: Record<number, ApiGameDetailResponse | null>;
  analyzersByGameId?: Record<number, ApiGameAnalyzerResponse | null>;
  selectedGameId?: number;
} = {}): AnalyzerPageModel {
  if (!gamesResponse) {
    return getAnalyzerPageModel(selectedGameId);
  }

  const fallback = getAnalyzerPageModel(selectedGameId);
  const vaultModel = createVaultPageModel({
    currentUser,
    gamesResponse
  });

  if (vaultModel.games.length === 0) {
    return {
      ...fallback,
      currentUser,
      games: [],
      insightsByGameId: {}
    };
  }

  const insightsByGameId = Object.fromEntries(
    vaultModel.games.map((game) => [
      game.id,
      buildAnalyzerInsight(game, detailsByGameId[game.id], analyzersByGameId[game.id])
    ])
  ) as Record<number, AnalyzerGameInsight>;

  const enhancedGames = vaultModel.games.map((game) => applyInsightToGame(game, insightsByGameId[game.id] ?? getFallbackInsight(game)));
  const selectedGame = enhancedGames.find((game) => game.id === selectedGameId) ?? enhancedGames[0];
  const selectedInsight = insightsByGameId[selectedGame.id] ?? getFallbackInsight(selectedGame);

  return {
    currentUser,
    selectedGameId: selectedGame.id,
    games: enhancedGames,
    selectedGame,
    players: selectedInsight.players,
    tabs: ANALYZER_TABS,
    timeline: selectedInsight.timeline,
    comparison: selectedInsight.comparison,
    apmSeries: selectedInsight.apmSeries,
    resourceSeries: selectedInsight.resourceSeries,
    unitProductionSeries: selectedInsight.unitProductionSeries,
    insightsByGameId
  };
}
