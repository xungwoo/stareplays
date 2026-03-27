"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { generateApmSeries, generateResourceSeries, generateUnitProductionSeries } from "@/lib/fixtures/analyzer";
import { CYAN_PANEL_STYLE, INNER_PANEL_STYLE } from "@/lib/constants/ui-styles";
import { RaceBadge } from "@/components/shared/race-badge";
import { ResultBadge } from "@/components/shared/status-badge";
import { getPlayerColor } from "@/lib/utils/player-colors";
import { getStartGridBoard } from "@/lib/utils/start-grid-board";
import type { ApiApmTimelineRow, ApiGameDetailResponse, ApiGetGameResponse, ApiPlayerSeriesRow, ApiSeriesPoint } from "@/types/api";
import type { VaultGame, VaultPlayer } from "@/types/vault";

export type VaultTechFocus = {
  playerName: string;
  kind: "tech" | "upgrade";
} | null;

type VaultTimelinePoint = Record<string, number> & {
  time: number;
};

type VaultMetricSummary = {
  playerName: string;
  total: number;
  worker: number;
  army: number;
  techUnit: number;
};

type VaultSpendSummary = {
  playerName: string;
  totalSpend: number;
};

type VaultTechSummary = {
  playerName: string;
  techCount: number;
  upgradeCount: number;
  prereqBuildCount: number;
};

type VaultTechEvent = {
  playerName: string;
  second: number;
  kind: "tech" | "upgrade" | "building";
  name: string;
};

export type VaultHydratedDetail = {
  reliability: string | null;
  reliabilityMOfN: string | null;
  replayFileCount: number | null;
  analysisMessage: string | null;
  apmSeries: VaultTimelinePoint[];
  unitProductionSummaries?: VaultMetricSummary[];
  unitProductionSeries?: VaultTimelinePoint[];
  resourceSpendSummaries?: VaultSpendSummary[];
  resourceSpendSeries?: VaultTimelinePoint[];
  techTreeSummaries?: VaultTechSummary[];
  techTreeEvents?: VaultTechEvent[];
};

const CARD_STYLE = CYAN_PANEL_STYLE;
const VIZ_TABS = [
  { id: "apm", label: "APM" },
  { id: "unitprod", label: "Unit_Production" },
  { id: "spend", label: "Resource_Spend" },
  { id: "production", label: "Production" },
  { id: "tech", label: "Tech" },
  { id: "battle", label: "Battle" },
  { id: "actions", label: "Actions" }
] as const;

export type VaultVizTab = (typeof VIZ_TABS)[number]["id"];

function toNumber(value: unknown, fallback = 0): number {
  const candidate = Number(value);
  return Number.isFinite(candidate) ? candidate : fallback;
}

function getGameMinutes(game: VaultGame) {
  const parsedMinutes = Number.parseInt(game.playTime.split(":")[0] ?? "0", 10);
  return Math.max(6, parsedMinutes + 1);
}

function normalizeKind(kind: string | undefined): "tech" | "upgrade" | "building" {
  const normalized = kind?.trim().toLowerCase() ?? "";
  if (normalized.includes("upgrade")) {
    return "upgrade";
  }
  if (normalized.includes("building")) {
    return "building";
  }

  return "tech";
}

function buildVaultApmSeries(rows: ApiApmTimelineRow[] | undefined): VaultTimelinePoint[] {
  const timelines = rows ?? [];
  const pointCount = Math.max(0, ...timelines.map((row) => row.data_points?.length ?? 0));
  if (pointCount === 0) {
    return [];
  }

  return Array.from({ length: pointCount }, (_, index) => {
    const sampleFrame = toNumber(timelines.find((row) => row.data_points?.[index]?.frame != null)?.data_points?.[index]?.frame);
    const point: VaultTimelinePoint = {
      time: Math.max(1, Math.round(sampleFrame / (24 * 60)) || index + 1)
    };

    timelines.forEach((row) => {
      const playerName = row.player_name?.trim();
      if (!playerName) {
        return;
      }
      point[playerName] = toNumber(row.data_points?.[index]?.apm);
    });

    return point;
  });
}

function buildVaultSeries(rows: ApiPlayerSeriesRow[] | undefined, pickValue: (point: ApiSeriesPoint) => number): VaultTimelinePoint[] {
  const timelines = rows ?? [];
  const pointCount = Math.max(0, ...timelines.map((row) => row.data_points?.length ?? 0));
  if (pointCount === 0) {
    return [];
  }

  return Array.from({ length: pointCount }, (_, index) => {
    const sampleSecond = toNumber(timelines.find((row) => row.data_points?.[index]?.second != null)?.data_points?.[index]?.second);
    const point: VaultTimelinePoint = {
      time: Math.max(1, Math.round(sampleSecond / 60) || index + 1)
    };

    timelines.forEach((row) => {
      const playerName = row.player_name?.trim();
      if (!playerName) {
        return;
      }

      const seriesPoint = row.data_points?.[index];
      if (!seriesPoint) {
        return;
      }

      point[playerName] = pickValue(seriesPoint);
    });

    return point;
  });
}

function buildMetricSummary(
  summary: VaultMetricSummary | undefined,
  fallback: VaultPlayer
): VaultMetricSummary {
  if (summary) {
    return summary;
  }

  const total = fallback.production;
  const worker = Math.max(0, Math.round(total * 0.42));
  const army = Math.max(0, Math.round(total * 0.33));
  const techUnit = Math.max(0, total - worker - army);

  return {
    playerName: fallback.name,
    total,
    worker,
    army,
    techUnit
  };
}

function buildSpendSummary(summary: VaultSpendSummary | undefined, fallback: VaultPlayer): VaultSpendSummary {
  if (summary) {
    return summary;
  }

  return {
    playerName: fallback.name,
    totalSpend: fallback.cmd
  };
}

function buildTechSummary(summary: VaultTechSummary | undefined, fallback: VaultPlayer): VaultTechSummary {
  if (summary) {
    return summary;
  }

  return {
    playerName: fallback.name,
    techCount: Math.max(1, Math.round(fallback.production / 60)),
    upgradeCount: Math.max(1, Math.round(fallback.redundancy / 2)),
    prereqBuildCount: Math.max(0, Math.round(fallback.redundancy / 6))
  };
}

function buildTechEvents(detailResponse: ApiGameDetailResponse | undefined): VaultTechEvent[] {
  const events = detailResponse?.tech_tree?.events ?? [];

  return events
    .map((event) => ({
      playerName: event.player_name?.trim() || "-",
      second: toNumber(event.second),
      kind: normalizeKind(event.kind),
      name: event.name?.trim() || "Tech Event"
    }))
    .sort((left, right) => left.second - right.second);
}

function findSummaryByPlayer<T extends { playerName: string }>(rows: T[] | undefined, playerName: string) {
  return rows?.find((row) => row.playerName === playerName);
}

function getSeriesSnapshot(series: VaultTimelinePoint[] | undefined, playerName: string, fallback: number) {
  const points = series ?? [];
  if (points.length === 0) {
    return {
      opening: fallback,
      mid: fallback,
      late: fallback
    };
  }

  const opening = toNumber(points[0]?.[playerName], fallback);
  const mid = toNumber(points[Math.floor(points.length / 2)]?.[playerName], fallback);
  const late = toNumber(points[points.length - 1]?.[playerName], fallback);

  return { opening, mid, late };
}

function getBattlePressure(game: VaultGame) {
  const winnerTotal = game.winnerTeam.reduce(
    (sum, player) => sum + player.apm * 0.45 + player.eapm * 0.35 + player.effective * 0.2,
    0
  );
  const loserTotal = game.loserTeam.reduce(
    (sum, player) => sum + player.apm * 0.45 + player.eapm * 0.35 + player.effective * 0.2,
    0
  );

  const winnerAverage = game.winnerTeam.length ? winnerTotal / game.winnerTeam.length : 0;
  const loserAverage = game.loserTeam.length ? loserTotal / game.loserTeam.length : 0;

  return {
    winnerAverage,
    loserAverage,
    swing: winnerAverage - loserAverage
  };
}

function getActionMix(player: VaultPlayer) {
  const macro = player.production * 0.45 + player.redundancy * 1.5;
  const combat = player.apm * 0.3 + player.eapm * 0.4;
  const tech = player.cmd * 0.04 + player.ecmd * 0.03;
  const total = macro + combat + tech || 1;

  return {
    macro,
    combat,
    tech,
    total
  };
}

export function createHydratedVaultDetail(gameResponse: ApiGetGameResponse, detailResponse: ApiGameDetailResponse): VaultHydratedDetail {
  const detailSummaries = detailResponse.tech_tree?.summary ?? [];
  const resourceSpendSummaries = detailResponse.resource_spend?.summaries ?? [];
  const unitProductionSummaries = detailResponse.unit_production?.summaries ?? [];

  return {
    reliability: gameResponse.reliability?.trim() || null,
    reliabilityMOfN: gameResponse.reliability_m_of_n?.trim() || null,
    replayFileCount: gameResponse.game?.edges?.replay_files?.length ?? null,
    analysisMessage: detailResponse.analysis_status?.user_message?.trim() || null,
    apmSeries: buildVaultApmSeries(detailResponse.detail?.apm_timeline),
    unitProductionSummaries: unitProductionSummaries.map((summary) => ({
      playerName: summary.player_name?.trim() || "-",
      total: toNumber(summary.total),
      worker: toNumber(summary.worker),
      army: toNumber(summary.army),
      techUnit: toNumber(summary.tech_unit)
    })),
    unitProductionSeries: buildVaultSeries(detailResponse.unit_production?.timelines, (point) => toNumber(point.count)),
    resourceSpendSummaries: resourceSpendSummaries.map((summary) => ({
      playerName: summary.player_name?.trim() || "-",
      totalSpend: toNumber(summary.total_spend)
    })),
    resourceSpendSeries: buildVaultSeries(detailResponse.resource_spend?.timelines, (point) => toNumber(point.total)),
    techTreeSummaries: detailSummaries.map((summary) => ({
      playerName: summary.player_name?.trim() || "-",
      techCount: toNumber(summary.tech_count),
      upgradeCount: toNumber(summary.upgrade_count),
      prereqBuildCount: toNumber(summary.prereq_build_count)
    })),
    techTreeEvents: buildTechEvents(detailResponse)
  };
}

function getAllGamePlayers(game: VaultGame): VaultPlayer[] {
  return [...game.winnerTeam, ...game.loserTeam];
}

function buildAnalyzerHref(currentUser: string, gameId: number) {
  return `/analyzer?currentUser=${encodeURIComponent(currentUser)}&gameId=${gameId}`;
}

function buildTechEventLabel(playerName: string, kind: "tech" | "upgrade") {
  return `${playerName} • ${kind.toUpperCase()}`;
}

function buildTechMarkerLabel(playerName: string, kind: "tech" | "upgrade") {
  return `${playerName} • ${kind.toUpperCase()} MARKER`;
}

function PlayerBoardCard({
  player,
  result,
  highlighted
}: {
  player: VaultPlayer;
  result: "WINNER" | "LOSER";
  highlighted: boolean;
}) {
  const isWinner = result === "WINNER";

  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg p-3 transition-all"
      style={{
        backgroundColor: highlighted ? "rgba(34,211,238,0.12)" : isWinner ? "rgba(16,185,129,0.04)" : "rgba(239,68,68,0.04)",
        border: `1px solid ${highlighted ? "rgba(34,211,238,0.35)" : isWinner ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}`,
        opacity: highlighted ? 1 : undefined
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <RaceBadge race={player.race} />
          <span data-testid="start-grid-player-name" className="text-xs font-mono font-semibold text-slate-200">
            {player.name}
          </span>
          {player.isCurrentUser ? (
            <span
              className="rounded px-1 py-0.5 text-[9px] font-mono font-bold"
              style={{
                backgroundColor: "rgba(34,211,238,0.15)",
                color: "#22d3ee",
                border: "1px solid rgba(34,211,238,0.3)"
              }}
            >
              YOU
            </span>
          ) : null}
        </div>
        <ResultBadge result={result} size="sm" />
      </div>

      <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] font-mono text-slate-400">
        <span>
          APM <span className="text-slate-200">{player.apm}</span>
        </span>
        <span>
          EAPM <span className="text-slate-200">{player.eapm}</span>
        </span>
        <span>
          CMD <span className="text-slate-300">{player.cmd.toLocaleString()}</span>
        </span>
        <span>
          ECMD <span className="text-slate-300">{player.ecmd.toLocaleString()}</span>
        </span>
        <span>
          EFF{" "}
          <span style={{ color: player.effective >= 90 ? "#34d399" : player.effective >= 80 ? "#f59e0b" : "#f87171" }}>
            {player.effective.toFixed(1)}%
          </span>
        </span>
        <span>
          PROD <span className="text-slate-200">{player.production}</span>
        </span>
        <span>
          REDUNDANCY% <span className="text-slate-200">{player.redundancy}%</span>
        </span>
      </div>
    </div>
  );
}

function getApmData(game: VaultGame, hydratedDetail?: VaultHydratedDetail): VaultTimelinePoint[] {
  if (hydratedDetail?.apmSeries.length) {
    return hydratedDetail.apmSeries;
  }

  return generateApmSeries(Number.parseInt(game.playTime.split(":")[0] ?? "0", 10) + 1) as unknown as VaultTimelinePoint[];
}

export function VaultDetailPanel({
  game,
  currentUser,
  hydratedDetail,
  isHydrating,
  hydrateError,
  activeVizTab,
  isFullscreen,
  techFocus,
  techEventInfo,
  highlightedPlayer,
  onActiveVizTabChange,
  onFullscreenToggle,
  onTechFocusChange,
  onTechEventInfoChange,
  onHighlightedPlayerChange
}: {
  game: VaultGame;
  currentUser: string;
  hydratedDetail?: VaultHydratedDetail;
  isHydrating?: boolean;
  hydrateError?: string | null;
  activeVizTab: VaultVizTab;
  isFullscreen: boolean;
  techFocus: VaultTechFocus;
  techEventInfo: string | null;
  highlightedPlayer: string | null;
  onActiveVizTabChange: (tab: VaultVizTab) => void;
  onFullscreenToggle: () => void;
  onTechFocusChange: (focus: VaultTechFocus) => void;
  onTechEventInfoChange?: (value: string | null) => void;
  onHighlightedPlayerChange: (playerName: string | null) => void;
}) {
  const apmData = useMemo(() => getApmData(game, hydratedDetail), [game, hydratedDetail]);
  const allPlayers = getAllGamePlayers(game).map((player) => player.name);
  const allGamePlayers = getAllGamePlayers(game);
  const board = useMemo(() => getStartGridBoard(game), [game]);
  const insightMessage = hydratedDetail?.analysisMessage || game.matchStory;
  const reliabilityLabel = hydratedDetail?.reliabilityMOfN
    ? `${hydratedDetail.reliabilityMOfN}${hydratedDetail.reliability ? ` • ${hydratedDetail.reliability}` : ""}`
    : hydratedDetail?.reliability || "UNAVAILABLE";
  const unitProductionRows = useMemo(
    () =>
      allGamePlayers.map((player) =>
        buildMetricSummary(findSummaryByPlayer(hydratedDetail?.unitProductionSummaries, player.name), player)
      ),
    [allGamePlayers, hydratedDetail?.unitProductionSummaries]
  );
  const resourceSpendRows = useMemo(
    () =>
      allGamePlayers.map((player) =>
        buildSpendSummary(findSummaryByPlayer(hydratedDetail?.resourceSpendSummaries, player.name), player)
      ),
    [allGamePlayers, hydratedDetail?.resourceSpendSummaries]
  );
  const techSummaryRows = useMemo(
    () =>
      allGamePlayers.map((player) => buildTechSummary(findSummaryByPlayer(hydratedDetail?.techTreeSummaries, player.name), player)),
    [allGamePlayers, hydratedDetail?.techTreeSummaries]
  );
  const techEvents = useMemo(() => hydratedDetail?.techTreeEvents ?? [], [hydratedDetail?.techTreeEvents]);
  const productionSeries = useMemo<VaultTimelinePoint[]>(
    () =>
      hydratedDetail?.unitProductionSeries?.length
        ? hydratedDetail.unitProductionSeries
        : (generateUnitProductionSeries(getGameMinutes(game)) as unknown as VaultTimelinePoint[]),
    [game, hydratedDetail?.unitProductionSeries]
  );
  const spendSeries = useMemo<VaultTimelinePoint[]>(
    () =>
      hydratedDetail?.resourceSpendSeries?.length
        ? hydratedDetail.resourceSpendSeries
        : (generateResourceSeries(getGameMinutes(game)) as unknown as VaultTimelinePoint[]),
    [game, hydratedDetail?.resourceSpendSeries]
  );
  const battlePressure = useMemo(() => getBattlePressure(game), [game]);

  function handleLegendPlayerClick(playerName: string) {
    onHighlightedPlayerChange(highlightedPlayer === playerName ? null : playerName);

    if (activeVizTab === "tech") {
      onTechFocusChange(null);
      onTechEventInfoChange?.(null);
    }
  }

  function handleTechSummaryClick(playerName: string, kind: "tech" | "upgrade") {
    const nextFocus = techFocus?.playerName === playerName && techFocus.kind === kind ? null : { playerName, kind };
    onTechFocusChange(nextFocus);
  }

  function handleTechMarkerClick(playerName: string, kind: "tech" | "upgrade") {
    onHighlightedPlayerChange(playerName);
    onTechEventInfoChange?.(buildTechMarkerLabel(playerName, kind));
  }

  function renderChartArea() {
    if (activeVizTab === "apm") {
      return (
        <div className="space-y-3">
          <p className="text-[10px] font-mono tracking-widest text-slate-500">APM TIMELINE</p>
          <div className="rounded-lg p-3" style={INNER_PANEL_STYLE}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={apmData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                <XAxis dataKey="time" tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono" }} tickLine={false} />
                <YAxis tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0d1833",
                    border: "1px solid rgba(34,211,238,0.2)",
                    borderRadius: 8,
                    fontSize: 11,
                    fontFamily: "JetBrains Mono"
                  }}
                  labelStyle={{ color: "#94a3b8" }}
                />
                {allPlayers.map((name) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={getPlayerColor(name)}
                    dot={false}
                    strokeWidth={highlightedPlayer && highlightedPlayer !== name ? 1 : 1.8}
                    opacity={highlightedPlayer && highlightedPlayer !== name ? 0.25 : 1}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (activeVizTab === "unitprod") {
      return (
        <div data-testid="vault-unit-production-ledger" className="space-y-3 rounded-lg p-3 text-xs font-mono text-slate-300" style={INNER_PANEL_STYLE}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">unit production ledger</p>
            <span className="text-[10px] uppercase tracking-widest text-slate-500">PLAYER / TOTAL / WORKER / ARMY / TECH_UNIT</span>
          </div>
          <div className="space-y-2">
            {unitProductionRows.map((row) => {
              const isDimmed = highlightedPlayer != null && highlightedPlayer !== row.playerName;

              return (
                <div key={row.playerName} className="rounded border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.08)", opacity: isDimmed ? 0.5 : 1 }}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-200">{row.playerName}</span>
                    <span className="text-slate-500">TOTAL {row.total}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] uppercase tracking-widest text-slate-500 sm:grid-cols-4">
                    <span>WORKER {row.worker}</span>
                    <span>ARMY {row.army}</span>
                    <span>TECH_UNIT {row.techUnit}</span>
                    <span>PROD {row.total}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (activeVizTab === "spend") {
      return (
        <div data-testid="vault-resource-spend-ledger" className="space-y-3 rounded-lg p-3 text-xs font-mono text-slate-300" style={INNER_PANEL_STYLE}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">resource spend ledger</p>
            <span className="text-[10px] uppercase tracking-widest text-slate-500">TOTAL_SPEND / EARLY / MID / LATE</span>
          </div>
          <div className="space-y-2">
            {resourceSpendRows.map((row) => {
              const isDimmed = highlightedPlayer != null && highlightedPlayer !== row.playerName;
              const snap = getSeriesSnapshot(spendSeries, row.playerName, row.totalSpend);
              const totalSeries = Math.max(1, snap.opening + snap.mid + snap.late);

              return (
                <div key={row.playerName} className="rounded border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.08)", opacity: isDimmed ? 0.5 : 1 }}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-200">{row.playerName}</span>
                    <span className="text-slate-500">TOTAL_SPEND {row.totalSpend.toLocaleString()}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-widest text-slate-500">
                    <span>EARLY {snap.opening.toLocaleString()}</span>
                    <span>MID {snap.mid.toLocaleString()}</span>
                    <span>LATE {snap.late.toLocaleString()}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="flex h-full">
                      <span className="bg-cyan-500/60" style={{ width: `${Math.max(8, (snap.opening / totalSeries) * 100)}%` }} />
                      <span className="bg-cyan-400/40" style={{ width: `${Math.max(8, (snap.mid / totalSeries) * 100)}%` }} />
                      <span className="bg-cyan-300/30" style={{ width: `${Math.max(8, (snap.late / totalSeries) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (activeVizTab === "production") {
      return (
        <div data-testid="vault-production-cadence" className="space-y-3 rounded-lg p-3 text-xs font-mono text-slate-300" style={INNER_PANEL_STYLE}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">production cadence</p>
            <span className="text-[10px] uppercase tracking-widest text-slate-500">OPENING / MID / LATE</span>
          </div>
          <div className="space-y-2">
            {unitProductionRows.map((row) => {
              const isDimmed = highlightedPlayer != null && highlightedPlayer !== row.playerName;
              const snap = getSeriesSnapshot(productionSeries, row.playerName, row.total);
              const totalSeries = Math.max(1, snap.opening + snap.mid + snap.late);

              return (
                <div key={row.playerName} className="rounded border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.08)", opacity: isDimmed ? 0.5 : 1 }}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-200">{row.playerName}</span>
                    <span className="text-slate-500">PRODUCTION {row.total}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-widest text-slate-500">
                    <span>OPENING {snap.opening.toLocaleString()}</span>
                    <span>MID {snap.mid.toLocaleString()}</span>
                    <span>LATE {snap.late.toLocaleString()}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="flex h-full">
                      <span className="bg-emerald-500/60" style={{ width: `${Math.max(8, (snap.opening / totalSeries) * 100)}%` }} />
                      <span className="bg-emerald-400/40" style={{ width: `${Math.max(8, (snap.mid / totalSeries) * 100)}%` }} />
                      <span className="bg-emerald-300/30" style={{ width: `${Math.max(8, (snap.late / totalSeries) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (activeVizTab === "tech") {
      return (
        <div data-testid="vault-tech-tree" className="space-y-3 rounded-lg p-3 text-xs font-mono text-slate-300" style={INNER_PANEL_STYLE}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">tech tree summary</p>
            <span className="text-[10px] uppercase tracking-widest text-slate-500">TECH / UPG / BUILD</span>
          </div>
          <div className="space-y-2">
            {techSummaryRows.map((row) => {
              const isFocused = techFocus?.playerName === row.playerName;
              const isDimmed = highlightedPlayer != null && highlightedPlayer !== row.playerName;

              return (
                <div key={row.playerName} className="rounded border px-3 py-2" style={{ borderColor: isFocused ? "rgba(34,211,238,0.35)" : "rgba(255,255,255,0.08)", opacity: isDimmed ? 0.5 : 1 }}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-200">{row.playerName}</span>
                    <span className="text-slate-500">{isFocused ? "FOCUSED" : "IDLE"}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      aria-pressed={techFocus?.playerName === row.playerName && techFocus.kind === "tech"}
                      aria-label={`${row.playerName} TECH ${row.techCount}`}
                      onClick={() => handleTechSummaryClick(row.playerName, "tech")}
                      className="rounded border px-3 py-1 text-[10px] uppercase tracking-widest transition-all"
                      style={{
                        backgroundColor: techFocus?.playerName === row.playerName && techFocus.kind === "tech" ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.04)",
                        borderColor: techFocus?.playerName === row.playerName && techFocus.kind === "tech" ? "rgba(34,211,238,0.35)" : "rgba(255,255,255,0.1)",
                        color: techFocus?.playerName === row.playerName && techFocus.kind === "tech" ? "#22d3ee" : "#cbd5e1"
                      }}
                    >
                      TECH {row.techCount}
                    </button>
                    <button
                      type="button"
                      aria-pressed={techFocus?.playerName === row.playerName && techFocus.kind === "upgrade"}
                      aria-label={`${row.playerName} UPG ${row.upgradeCount}`}
                      onClick={() => handleTechSummaryClick(row.playerName, "upgrade")}
                      className="rounded border px-3 py-1 text-[10px] uppercase tracking-widest transition-all"
                      style={{
                        backgroundColor: techFocus?.playerName === row.playerName && techFocus.kind === "upgrade" ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.04)",
                        borderColor: techFocus?.playerName === row.playerName && techFocus.kind === "upgrade" ? "rgba(34,211,238,0.35)" : "rgba(255,255,255,0.1)",
                        color: techFocus?.playerName === row.playerName && techFocus.kind === "upgrade" ? "#22d3ee" : "#cbd5e1"
                      }}
                    >
                      UPG {row.upgradeCount}
                    </button>
                    <span className="self-center text-[10px] uppercase tracking-widest text-slate-500">BUILD {row.prereqBuildCount}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div data-testid="vault-tech-tree-markers" className="rounded border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-200">MARKERS</span>
              <span className="text-slate-500">click an event to update techEventInfo</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {techEvents.length > 0 ? (
                techEvents.map((event) => (
                  <button
                    key={`${event.playerName}-${event.second}-${event.name}`}
                    type="button"
                    aria-label={`${event.playerName} ${event.kind} marker`}
                    onClick={() => handleTechMarkerClick(event.playerName, event.kind === "upgrade" ? "upgrade" : "tech")}
                    className="rounded border px-2 py-1 text-[10px] uppercase tracking-widest transition-all"
                    style={{ borderColor: "rgba(255,255,255,0.12)", color: "#cbd5e1", backgroundColor: "rgba(255,255,255,0.04)" }}
                  >
                    {event.second}s {event.name}
                  </button>
                ))
              ) : (
                <span className="text-slate-500">NO TECH EVENTS</span>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (activeVizTab === "battle") {
      return (
        <div data-testid="vault-battle-pressure" className="space-y-3 rounded-lg p-3 text-xs font-mono text-slate-300" style={INNER_PANEL_STYLE}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">team_pressure</p>
            <span className="text-[10px] uppercase tracking-widest text-slate-500">WINNER / LOSER / SWING</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded border px-3 py-2" style={{ borderColor: "rgba(34,211,238,0.18)" }}>
              <div className="text-slate-200">WINNER SIDE</div>
              <div className="mt-1 text-slate-500">AVG PRESSURE {battlePressure.winnerAverage.toFixed(1)}</div>
            </div>
            <div className="rounded border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="text-slate-200">LOSER SIDE</div>
              <div className="mt-1 text-slate-500">AVG PRESSURE {battlePressure.loserAverage.toFixed(1)}</div>
            </div>
          </div>
          <div className="rounded border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-300">SWING</span>
              <span className="text-slate-500">{battlePressure.swing.toFixed(1)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full bg-red-400/40" style={{ width: `${Math.min(100, Math.abs(battlePressure.swing) * 1.2)}%` }} />
            </div>
          </div>
        </div>
      );
    }

    if (activeVizTab === "actions") {
      return (
        <div data-testid="vault-actions-mix" className="space-y-3 rounded-lg p-3 text-xs font-mono text-slate-300" style={INNER_PANEL_STYLE}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">action mix profile</p>
            <span className="text-[10px] uppercase tracking-widest text-slate-500">MACRO / COMBAT / TECH</span>
          </div>
          <div className="space-y-2">
            {allGamePlayers.map((player) => {
              const mix = getActionMix(player);
              const isDimmed = highlightedPlayer != null && highlightedPlayer !== player.name;

              return (
                <div key={player.name} className="rounded border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.08)", opacity: isDimmed ? 0.5 : 1 }}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-200">{player.name}</span>
                    <span className="text-slate-500">TOTAL {mix.total.toFixed(1)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="flex h-full">
                      <span className="bg-cyan-500/60" style={{ width: `${(mix.macro / mix.total) * 100}%` }} />
                      <span className="bg-emerald-400/40" style={{ width: `${(mix.combat / mix.total) * 100}%` }} />
                      <span className="bg-amber-400/40" style={{ width: `${(mix.tech / mix.total) * 100}%` }} />
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-widest text-slate-500">
                    <span>MACRO {mix.macro.toFixed(1)}</span>
                    <span>COMBAT {mix.combat.toFixed(1)}</span>
                    <span>TECH {mix.tech.toFixed(1)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-lg p-3 text-xs font-mono text-slate-400" style={INNER_PANEL_STYLE}>
        <div className="mb-2 text-[10px] uppercase tracking-widest text-slate-500">OTHER</div>
        <div className="space-y-1">
          {allGamePlayers.map((player) => (
            <div key={player.name} className="flex items-center justify-between gap-3">
              <span className="text-slate-300">{player.name}</span>
              <span className="text-slate-500">
                APM {player.apm} / EAPM {player.eapm}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderLegendRow() {
    return (
      <div className="flex flex-wrap gap-2">
        {allPlayers.map((name) => {
          const isActive = highlightedPlayer === name;

          return (
            <button
              key={name}
              type="button"
              aria-pressed={isActive}
              onClick={() => handleLegendPlayerClick(name)}
              className="rounded border px-3 py-1 text-[10px] font-mono uppercase tracking-widest transition-all"
              style={{
                backgroundColor: isActive ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.04)",
                borderColor: isActive ? "rgba(34,211,238,0.35)" : "rgba(255,255,255,0.1)",
                color: isActive ? "#22d3ee" : "#94a3b8"
              }}
            >
              {name}
            </button>
          );
        })}
      </div>
    );
  }

  function renderChartHint() {
    switch (activeVizTab) {
      case "apm":
        return "click legend items to emphasize a player";
      case "unitprod":
        return "click a player to compare production profiles";
      case "spend":
        return "review command spending by player";
      case "production":
        return "inspect build order pacing by player";
      case "tech":
        return "click markers or summary buttons to set tech focus";
      case "battle":
        return "compare combat pressure across players";
      case "actions":
        return "compare action mix and redundancy";
      default:
        return "click legend items to emphasize a player";
    }
  }

  function renderTechEventInfo() {
    return techEventInfo ?? (techFocus ? buildTechEventLabel(techFocus.playerName, techFocus.kind) : "NO TECH EVENT SELECTED");
  }

  function renderSummaryArea() {
    if (activeVizTab === "apm") {
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {allGamePlayers.map((player) => (
            <div key={player.name} className="rounded border p-2 text-xs font-mono" style={INNER_PANEL_STYLE}>
              <div className="text-slate-300">{player.name}</div>
              <div className="mt-1 text-slate-500">
                APM {player.apm} EAPM {player.eapm}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (activeVizTab === "unitprod") {
      return (
        <div className="space-y-3 rounded-lg p-3" style={INNER_PANEL_STYLE}>
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">unit production summary</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {unitProductionRows.map((row) => (
              <div key={row.playerName} className="rounded border p-2 text-xs font-mono" style={INNER_PANEL_STYLE}>
                <div className="text-slate-300">{row.playerName}</div>
                <div className="mt-1 text-slate-500">
                  TOTAL {row.total} WORKER {row.worker} ARMY {row.army} TECH_UNIT {row.techUnit}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeVizTab === "spend") {
      return (
        <div className="space-y-3 rounded-lg p-3" style={INNER_PANEL_STYLE}>
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">resource spend summary</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {resourceSpendRows.map((row) => {
              const snap = getSeriesSnapshot(spendSeries, row.playerName, row.totalSpend);

              return (
                <div key={row.playerName} className="rounded border p-2 text-xs font-mono" style={INNER_PANEL_STYLE}>
                  <div className="text-slate-300">{row.playerName}</div>
                  <div className="mt-1 text-slate-500">
                    TOTAL_SPEND {row.totalSpend.toLocaleString()} EARLY {snap.opening.toLocaleString()} LATE {snap.late.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (activeVizTab === "production") {
      return (
        <div className="space-y-3 rounded-lg p-3" style={INNER_PANEL_STYLE}>
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">production event summary</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {unitProductionRows.map((row) => {
              const snap = getSeriesSnapshot(productionSeries, row.playerName, row.total);

              return (
                <div key={row.playerName} className="rounded border p-2 text-xs font-mono" style={INNER_PANEL_STYLE}>
                  <div className="text-slate-300">{row.playerName}</div>
                  <div className="mt-1 text-slate-500">
                    OPENING {snap.opening} MID {snap.mid} LATE {snap.late}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (activeVizTab === "tech") {
      return (
        <div data-testid="vault-tech-summary" className="space-y-3 rounded-lg p-3" style={INNER_PANEL_STYLE}>
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">tech focus summary</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {techSummaryRows.map((row) => {
              const isFocused = techFocus?.playerName === row.playerName;

              return (
                <div key={row.playerName} className="rounded border p-2 text-xs font-mono" style={INNER_PANEL_STYLE}>
                  <div className="text-slate-300">{row.playerName}</div>
                  <div className="mt-1 text-slate-500">
                    TECH {row.techCount} / UPG {row.upgradeCount} / BUILD {row.prereqBuildCount}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-widest" style={{ color: isFocused ? "#22d3ee" : "#64748b" }}>
                    {isFocused ? "FOCUSED" : "IDLE"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (activeVizTab === "battle") {
      return (
        <div className="space-y-3 rounded-lg p-3" style={INNER_PANEL_STYLE}>
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">battle summary</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded border p-2 text-xs font-mono" style={INNER_PANEL_STYLE}>
              <div className="text-slate-300">WINNER</div>
              <div className="mt-1 text-slate-500">{battlePressure.winnerAverage.toFixed(1)}</div>
            </div>
            <div className="rounded border p-2 text-xs font-mono" style={INNER_PANEL_STYLE}>
              <div className="text-slate-300">LOSER</div>
              <div className="mt-1 text-slate-500">{battlePressure.loserAverage.toFixed(1)}</div>
            </div>
            <div className="rounded border p-2 text-xs font-mono" style={INNER_PANEL_STYLE}>
              <div className="text-slate-300">SWING</div>
              <div className="mt-1 text-slate-500">{battlePressure.swing.toFixed(1)}</div>
            </div>
          </div>
        </div>
      );
    }

    if (activeVizTab === "actions") {
      return (
        <div className="space-y-3 rounded-lg p-3" style={INNER_PANEL_STYLE}>
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">actions summary</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {allGamePlayers.map((player) => {
              const mix = getActionMix(player);

              return (
                <div key={player.name} className="rounded border p-2 text-xs font-mono" style={INNER_PANEL_STYLE}>
                  <div className="text-slate-300">{player.name}</div>
                  <div className="mt-1 text-slate-500">
                    MACRO {mix.macro.toFixed(1)} COMBAT {mix.combat.toFixed(1)} TECH {mix.tech.toFixed(1)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {allGamePlayers.map((player) => (
          <div key={player.name} className="rounded border p-2 text-xs font-mono" style={INNER_PANEL_STYLE}>
            <div className="text-slate-300">{player.name}</div>
            <div className="mt-1 text-slate-500">
              APM {player.apm} EAPM {player.eapm}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div data-testid="vault-detail-shell" data-fullscreen={isFullscreen ? "true" : "false"} className="rounded-xl p-5" style={{ backgroundColor: "#080e1f", border: "1px solid rgba(34,211,238,0.12)" }}>
      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs font-mono text-slate-400">#{game.id}</span>
        <span className="text-sm font-mono font-semibold text-slate-200">{game.map}</span>
        <span className="text-xs font-mono text-slate-500">{game.startTime}</span>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[10px] font-mono tracking-widest text-slate-500">Selected_Game</p>
            <Link
              href={buildAnalyzerHref(currentUser, game.id)}
              className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-mono font-bold tracking-wider transition-all"
              style={{
                background: "linear-gradient(90deg, #0891b2, #1d4ed8)",
                color: "#e0f7ff",
                border: "1px solid rgba(34,211,238,0.3)"
              }}
            >
              <ExternalLink className="h-3 w-3" />
              Open_In_Analyzer
            </Link>
          </div>

          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-lg px-3 py-2" style={INNER_PANEL_STYLE}>
              <p className="text-[10px] font-mono tracking-widest text-slate-500">RELIABILITY</p>
              <p className="mt-1 text-xs font-mono text-slate-200">{reliabilityLabel}</p>
            </div>
            <div className="rounded-lg px-3 py-2" style={INNER_PANEL_STYLE}>
              <p className="text-[10px] font-mono tracking-widest text-slate-500">REPLAY_FILES</p>
              <p className="mt-1 text-xs font-mono text-slate-200">{hydratedDetail?.replayFileCount ?? "-"}</p>
            </div>
            <div className="rounded-lg px-3 py-2" style={INNER_PANEL_STYLE}>
              <p className="text-[10px] font-mono tracking-widest text-slate-500">DETAIL_STATUS</p>
              <p className="mt-1 text-xs font-mono text-slate-200">{isHydrating ? "FETCHING_LIVE_DETAIL..." : hydrateError ? "DETAIL_FALLBACK" : "LIVE_DETAIL_READY"}</p>
            </div>
          </div>

          <div className="my-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px_minmax(0,1fr)]">
            <div data-testid="vault-start-grid-left" className="flex flex-col gap-2">
              {board.leftColumn.map((entry) => (
                <PlayerBoardCard key={entry.player.name} player={entry.player} result={entry.result} highlighted={!highlightedPlayer || highlightedPlayer === entry.player.name} />
              ))}
            </div>

            <div className="flex flex-col items-center justify-center rounded-xl px-4 py-5 text-center" style={{ background: "radial-gradient(circle at center, rgba(255,255,255,0.08), rgba(255,255,255,0.02))", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-4xl font-mono font-bold text-slate-300">{game.matchup}</div>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex gap-0.5">
                  {board.leftColumn.map((entry) => (
                    <RaceBadge key={`left-${entry.player.name}`} race={entry.player.race} />
                  ))}
                </div>
                <span className="text-base font-mono font-bold text-slate-500">vs</span>
                <div className="flex gap-0.5">
                  {board.rightColumn.map((entry) => (
                    <RaceBadge key={`right-${entry.player.name}`} race={entry.player.race} />
                  ))}
                </div>
              </div>
              <div className="mt-3 text-xs font-mono tracking-widest text-slate-500">PLAY TIME</div>
              <div className="text-3xl font-mono font-bold" style={{ color: "#22d3ee" }}>
                {game.playTime}
              </div>
            </div>

            <div data-testid="vault-start-grid-right" className="flex flex-col gap-2">
              {board.rightColumn.map((entry) => (
                <PlayerBoardCard key={entry.player.name} player={entry.player} result={entry.result} highlighted={!highlightedPlayer || highlightedPlayer === entry.player.name} />
              ))}
            </div>
          </div>

          {game.matchStory ? (
            <div className="mt-3 rounded-lg p-3" style={{ backgroundColor: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.1)" }}>
              <p className="mb-1 text-[10px] font-mono tracking-widest text-cyan-500">MATCH STORY</p>
              <p className="text-xs leading-relaxed text-slate-300">{insightMessage}</p>
            </div>
          ) : null}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[10px] font-mono tracking-widest text-slate-500">Game_Detail_Visualization</p>
            <button
              type="button"
              onClick={onFullscreenToggle}
              className="rounded-lg px-3 py-1.5 text-xs font-mono font-bold tracking-wider transition-all"
              style={{
                backgroundColor: isFullscreen ? "rgba(34,211,238,0.18)" : "rgba(255,255,255,0.04)",
                color: isFullscreen ? "#22d3ee" : "#cbd5e1",
                border: "1px solid rgba(255,255,255,0.1)"
              }}
            >
              {isFullscreen ? "작게 보기" : "크게 보기"}
            </button>
          </div>
          {hydrateError ? (
            <div data-testid="vault-detail-error" className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-xs font-mono text-red-100">
              <p className="text-[10px] uppercase tracking-widest text-red-200">DETAIL_ERROR</p>
              <p className="mt-2 font-semibold">Unable to load selected game detail.</p>
              <p className="mt-1 text-red-100/90">{hydrateError}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg px-3 py-2 text-xs font-mono text-slate-300" style={INNER_PANEL_STYLE}>
                <p className="text-[10px] uppercase tracking-widest text-slate-500">analysis notice</p>
                <p className="mt-1">{insightMessage || "analysis pending"}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <p className="mr-2 self-center text-[10px] font-mono uppercase tracking-widest text-slate-500">viz tabs</p>
                {VIZ_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={activeVizTab === tab.id}
                    onClick={() => onActiveVizTabChange(tab.id)}
                    className="rounded border px-3 py-1 text-xs font-mono uppercase tracking-widest transition-all"
                    style={{
                      backgroundColor: activeVizTab === tab.id ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.04)",
                      color: activeVizTab === tab.id ? "#22d3ee" : "#94a3b8",
                      borderColor: activeVizTab === tab.id ? "rgba(34,211,238,0.35)" : "rgba(255,255,255,0.1)"
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">chart area</p>
                {renderChartArea()}
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">legend row</p>
                {renderLegendRow()}
              </div>

              <div className="rounded-lg px-3 py-2 text-xs font-mono text-slate-400" style={INNER_PANEL_STYLE}>
                <p className="text-[10px] uppercase tracking-widest text-slate-500">chart hint</p>
                <p className="mt-1">{renderChartHint()}</p>
              </div>

              <div className="rounded-lg px-3 py-2 text-xs font-mono text-slate-300" style={INNER_PANEL_STYLE}>
                <p className="text-[10px] uppercase tracking-widest text-slate-500">tech event info</p>
                <p data-testid="vault-tech-tree-focus" className="mt-1">{renderTechEventInfo()}</p>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">summary area</p>
                {renderSummaryArea()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
