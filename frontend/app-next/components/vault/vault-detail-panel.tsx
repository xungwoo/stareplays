"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
  totalMineral?: number;
  totalGas?: number;
  totalSpend: number;
};

type VaultSpendMode = "both" | "mineral" | "gas";

type VaultSpendFocus = {
  playerName: string;
  mode: VaultSpendMode;
};

type VaultSpendPoint = {
  frame: number;
  second: number;
  mineral: number;
  gas: number;
  total: number;
};

type VaultSpendTimelineRow = {
  playerName: string;
  dataPoints: VaultSpendPoint[];
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

type VaultBuildEvent = {
  frame: number;
  endFrame?: number;
  count?: number;
  eventType?: string;
  unit?: string;
  tech?: string;
  upgrade?: string;
  order?: string;
  x?: number;
  y?: number;
  isMorph?: boolean;
  isEffective?: boolean;
  ineffKind?: string;
  isQueued?: boolean;
};

type VaultBuildOrder = {
  playerName: string;
  events: VaultBuildEvent[];
};

export type VaultHydratedDetail = {
  reliability: string | null;
  reliabilityMOfN: string | null;
  replayFileCount: number | null;
  analysisStatus?: string | null;
  analysisMessage: string | null;
  apmSeries: VaultTimelinePoint[];
  unitProductionSummaries?: VaultMetricSummary[];
  unitProductionSeries?: VaultTimelinePoint[];
  resourceSpendSummaries?: VaultSpendSummary[];
  resourceSpendSeries?: VaultTimelinePoint[];
  resourceSpendTimelines?: VaultSpendTimelineRow[];
  techTreeSummaries?: VaultTechSummary[];
  techTreeEvents?: VaultTechEvent[];
  buildOrders?: VaultBuildOrder[];
  compressedBuildOrders?: VaultBuildOrder[];
};

const CARD_STYLE = CYAN_PANEL_STYLE;
const WINDOW_FRAMES = 238;
const VIZ_TABS = [
  { id: "apm", label: "APM" },
  { id: "unitprod", label: "Unit Production" },
  { id: "spend", label: "Resource Spend" },
  { id: "production", label: "Production" },
  { id: "tech", label: "Tech / Upgrade" },
  { id: "battle", label: "Battle Intensity" },
  { id: "actions", label: "Action Mix" }
] as const;

export type VaultVizTab = (typeof VIZ_TABS)[number]["id"];

function toNumber(value: unknown, fallback = 0): number {
  const candidate = Number(value);
  return Number.isFinite(candidate) ? candidate : fallback;
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

function toFrame(point: ApiSeriesPoint | undefined) {
  const candidate = point as ApiSeriesPoint & { frame?: unknown };
  if (candidate?.frame != null) {
    return toNumber(candidate.frame);
  }

  return Math.max(0, Math.round(toNumber(point?.second) * 12));
}

function buildSpendTimelines(rows: ApiPlayerSeriesRow[] | undefined): VaultSpendTimelineRow[] {
  return (rows ?? []).map((row) => ({
    playerName: row.player_name?.trim() || "-",
    dataPoints: (row.data_points ?? []).map((point) => {
      const spendPoint = point as ApiSeriesPoint & { frame?: unknown; mineral?: unknown; gas?: unknown };
      return {
        frame: toFrame(point),
        second: toNumber(point.second),
        mineral: toNumber(spendPoint.mineral),
        gas: toNumber(spendPoint.gas),
        total: toNumber(point.total)
      };
    })
  }));
}

function buildProductionSeries(buildOrders: VaultBuildOrder[]) {
  return buildOrders.map((order) => {
    const buckets = new Map<number, number>();

    order.events.forEach((event) => {
      const windowIndex = Math.floor(toNumber(event.frame) / WINDOW_FRAMES);
      buckets.set(windowIndex, (buckets.get(windowIndex) ?? 0) + 1);
    });

    const maxWindow = Math.max(0, ...Array.from(buckets.keys()));
    return {
      playerName: order.playerName,
      dataPoints: Array.from({ length: maxWindow + 1 }, (_, windowIndex) => ({
        frame: windowIndex * WINDOW_FRAMES,
        value: buckets.get(windowIndex) ?? 0
      }))
    };
  });
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

type VaultChartPoint = {
  x: number;
  y: number;
};

function scaleSeriesPoints(values: number[], width: number, height: number, padding = 16): VaultChartPoint[] {
  if (values.length === 0) {
    return [];
  }

  const maxValue = Math.max(1, ...values);
  const innerWidth = Math.max(1, width - padding * 2);
  const innerHeight = Math.max(1, height - padding * 2);

  return values.map((value, index) => ({
    x: padding + (values.length === 1 ? innerWidth / 2 : (index / (values.length - 1)) * innerWidth),
    y: padding + (1 - value / maxValue) * innerHeight
  }));
}

function buildLinearPath(points: VaultChartPoint[]) {
  if (points.length === 0) {
    return "";
  }

  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
}

function buildSmoothPath(points: VaultChartPoint[]) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    const point = points[0];
    return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const midX = ((previous.x + current.x) / 2).toFixed(2);
    path += ` C ${midX} ${previous.y.toFixed(2)} ${midX} ${current.y.toFixed(2)} ${current.x.toFixed(2)} ${current.y.toFixed(2)}`;
  }

  return path;
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
  const detailWithBuildOrders = detailResponse as ApiGameDetailResponse & {
    build_orders?: Array<Partial<VaultBuildOrder>>;
    compressed_build_orders?: Array<Partial<VaultBuildOrder>>;
  };

  return {
    reliability: gameResponse.reliability?.trim() || null,
    reliabilityMOfN: gameResponse.reliability_m_of_n?.trim() || null,
    replayFileCount: gameResponse.game?.edges?.replay_files?.length ?? null,
    analysisStatus: detailResponse.analysis_status?.status?.trim() || null,
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
      totalMineral: toNumber((summary as { total_mineral?: unknown }).total_mineral),
      totalGas: toNumber((summary as { total_gas?: unknown }).total_gas),
      totalSpend: toNumber(summary.total_spend)
    })),
    resourceSpendSeries: buildVaultSeries(detailResponse.resource_spend?.timelines, (point) => toNumber(point.total)),
    resourceSpendTimelines: buildSpendTimelines(detailResponse.resource_spend?.timelines),
    techTreeSummaries: detailSummaries.map((summary) => ({
      playerName: summary.player_name?.trim() || "-",
      techCount: toNumber(summary.tech_count),
      upgradeCount: toNumber(summary.upgrade_count),
      prereqBuildCount: toNumber(summary.prereq_build_count)
    })),
    techTreeEvents: buildTechEvents(detailResponse),
    compressedBuildOrders: (detailWithBuildOrders.compressed_build_orders ?? []).map((order) => normalizeBuildOrder(order)).filter((order): order is VaultBuildOrder => order != null),
    buildOrders: (detailWithBuildOrders.build_orders ?? []).map((order) => normalizeBuildOrder(order)).filter((order): order is VaultBuildOrder => order != null)
  };
}

function getAllGamePlayers(game: VaultGame): VaultPlayer[] {
  return [...game.winnerTeam, ...game.loserTeam];
}

function buildAnalyzerHref(gameId: number) {
  return `/analyzer?game_id=${gameId}`;
}

function buildTechMarkerLabel(event: VaultTechEvent) {
  return `TECH_EVENT: ${event.playerName} | ${event.name} | ${event.kind.toUpperCase()} | ${event.second}s`;
}

function normalizeBuildOrderEvent(event: Partial<VaultBuildEvent> | undefined): VaultBuildEvent {
  return {
    frame: toNumber(event?.frame),
    endFrame: event?.endFrame != null ? toNumber(event.endFrame) : undefined,
    count: event?.count != null ? toNumber(event.count) : undefined,
    eventType: event?.eventType?.trim() || (event as { event_type?: string } | undefined)?.event_type?.trim() || undefined,
    unit: event?.unit?.trim() || undefined,
    tech: event?.tech?.trim() || undefined,
    upgrade: event?.upgrade?.trim() || undefined,
    order: event?.order?.trim() || undefined,
    x: event?.x != null ? toNumber(event.x) : undefined,
    y: event?.y != null ? toNumber(event.y) : undefined,
    isMorph: event?.isMorph,
    isEffective: event?.isEffective,
    ineffKind: event?.ineffKind?.trim() || undefined,
    isQueued: event?.isQueued
  };
}

function normalizeBuildOrder(order: Partial<VaultBuildOrder> | undefined): VaultBuildOrder | null {
  const playerName = order?.playerName?.trim() || (order as { player_name?: string } | undefined)?.player_name?.trim();
  if (!playerName) {
    return null;
  }

  return {
    playerName,
    events: ((order?.events ?? (order as { events?: Array<Partial<VaultBuildEvent>> } | undefined)?.events) ?? []).map((event) =>
      normalizeBuildOrderEvent(event)
    )
  };
}

function pickBuildOrders(detail?: VaultHydratedDetail) {
  const compressed = detail?.compressedBuildOrders ?? [];
  if (compressed.length > 0) {
    return compressed;
  }

  return detail?.buildOrders ?? [];
}

function buildOrderEventLabel(event: VaultBuildEvent) {
  return event.unit || event.tech || event.upgrade || event.order || event.eventType || "EVENT";
}

function formatBuildOrderTime(frame: number) {
  const totalSeconds = Math.max(0, Math.round(frame / 23.8));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildSummedApmSeries(points: VaultTimelinePoint[]) {
  const summed = points.map((point) => ({
    time: point.time,
    sum: Object.entries(point).reduce((total, [key, value]) => (key === "time" ? total : total + toNumber(value)), 0)
  }));

  return summed.map((point, index) => ({
    time: point.time,
    sum:
      (toNumber(summed[Math.max(0, index - 1)]?.sum) +
        toNumber(point.sum) +
        toNumber(summed[Math.min(summed.length - 1, index + 1)]?.sum)) /
      3
  }));
}

function getActionMixDominantLabel(mix: ReturnType<typeof getActionMix>) {
  if (mix.macro >= mix.combat && mix.macro >= mix.tech) {
    return "MACRO";
  }

  if (mix.combat >= mix.tech) {
    return "COMBAT";
  }

  return "TECH";
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

function getApmData(hydratedDetail?: VaultHydratedDetail): VaultTimelinePoint[] {
  return hydratedDetail?.apmSeries ?? [];
}

export function VaultDetailPanel({
  game,
  currentUser,
  hydratedDetail,
  isHydrating = false,
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
  void currentUser;
  const [resourceSpendFocus, setResourceSpendFocus] = useState<VaultSpendFocus>({ playerName: "", mode: "both" });
  const apmData = useMemo(() => getApmData(hydratedDetail), [hydratedDetail]);
  const allPlayers = getAllGamePlayers(game).map((player) => player.name);
  const allGamePlayers = getAllGamePlayers(game);
  const board = useMemo(() => getStartGridBoard(game), [game]);
  const analysisStatus = hydratedDetail?.analysisStatus?.trim().toLowerCase() || "";
  const shouldRenderAnalysisNotice = analysisStatus !== "" && analysisStatus !== "ready";
  const analysisNoticeMessage = hydratedDetail?.analysisMessage?.trim() || "analysis pending";
  const unitProductionRows = useMemo(() => hydratedDetail?.unitProductionSummaries ?? [], [hydratedDetail?.unitProductionSummaries]);
  const resourceSpendRows = useMemo(() => hydratedDetail?.resourceSpendSummaries ?? [], [hydratedDetail?.resourceSpendSummaries]);
  const resourceSpendTimelines = useMemo(() => hydratedDetail?.resourceSpendTimelines ?? [], [hydratedDetail?.resourceSpendTimelines]);
  const techSummaryRows = useMemo(() => hydratedDetail?.techTreeSummaries ?? [], [hydratedDetail?.techTreeSummaries]);
  const techEvents = useMemo(() => hydratedDetail?.techTreeEvents ?? [], [hydratedDetail?.techTreeEvents]);
  const techPlayerNames = useMemo(
    () =>
      Array.from(
        new Set([
          ...techSummaryRows.map((row) => row.playerName),
          ...techEvents.map((event) => event.playerName)
        ])
      ),
    [techEvents, techSummaryRows]
  );
  const buildOrders = useMemo(() => pickBuildOrders(hydratedDetail), [hydratedDetail?.buildOrders, hydratedDetail?.compressedBuildOrders]);
  const productionChartSeries = useMemo(() => buildProductionSeries(buildOrders), [buildOrders]);
  const productionSeries = useMemo<VaultTimelinePoint[]>(() => hydratedDetail?.unitProductionSeries ?? [], [hydratedDetail?.unitProductionSeries]);
  const battleSeries = useMemo(() => buildSummedApmSeries(apmData), [apmData]);

  useEffect(() => {
    setResourceSpendFocus({ playerName: "", mode: "both" });
  }, [game.id]);

  const selectedSpendPlayer = resourceSpendTimelines.some((row) => row.playerName === resourceSpendFocus.playerName)
    ? resourceSpendFocus.playerName
    : "";
  const selectedSpendMode = resourceSpendFocus.mode;
  const visibleSpendSeries = useMemo(() => {
    const series = resourceSpendTimelines.flatMap((row) => {
      const items = [
        {
          key: `${row.playerName}-mineral`,
          playerName: row.playerName,
          label: `${row.playerName} [M]`,
          kind: "mineral" as const,
          points: row.dataPoints.map((point) => ({ frame: point.frame, second: point.second, value: point.mineral }))
        },
        {
          key: `${row.playerName}-gas`,
          playerName: row.playerName,
          label: `${row.playerName} [G]`,
          kind: "gas" as const,
          points: row.dataPoints.map((point) => ({ frame: point.frame, second: point.second, value: point.gas }))
        }
      ];
      return items;
    });

    if (selectedSpendMode === "mineral") {
      return series.filter((item) => item.kind === "mineral");
    }

    if (selectedSpendMode === "gas") {
      return series.filter((item) => item.kind === "gas");
    }

    return series;
  }, [resourceSpendTimelines, selectedSpendMode, selectedSpendPlayer]);
  const spendChartMax = Math.max(1, ...visibleSpendSeries.flatMap((series) => series.points.map((point) => point.value)));

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
    onTechEventInfoChange?.(nextFocus ? "TECH_EVENT: CLICK_MARKER_TO_VIEW" : null);
  }

  function handleTechMarkerClick(event: VaultTechEvent) {
    onHighlightedPlayerChange(event.playerName);
    onTechEventInfoChange?.(buildTechMarkerLabel(event));
  }

  function renderEmptyChart(message: string) {
    return (
      <div className="rounded-lg border px-4 py-5 text-xs font-mono text-slate-500" style={INNER_PANEL_STYLE}>
        {message}
      </div>
    );
  }

  function renderChartArea() {
    if (activeVizTab === "apm") {
      if (apmData.length === 0) {
        return renderEmptyChart("NO_APM");
      }

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
      if (productionSeries.length === 0) {
        return renderEmptyChart("NO_UNIT_PRODUCTION");
      }

      const chartWidth = 640;
      const chartHeight = 220;
      const timeLabels = productionSeries.map((point) => point.time);
      const innerWidth = chartWidth - 32;
      const innerHeight = chartHeight - 32;
      const maxValue = Math.max(
        1,
        ...productionSeries.flatMap((point) => allGamePlayers.map((player) => toNumber(point[player.name])))
      );
      const chartLines = allGamePlayers.map((player) => {
        const values = productionSeries.map((point) => toNumber(point[player.name]));
        const points = values.map((value, index) => ({
          x: 16 + (values.length === 1 ? innerWidth / 2 : (index / Math.max(1, values.length - 1)) * innerWidth),
          y: 16 + (1 - value / maxValue) * innerHeight
        }));

        return {
          player,
          path: buildSmoothPath(points)
        };
      });

      return (
        <section aria-label="Unit Production Chart" className="space-y-3 rounded-lg p-3 text-xs font-mono text-slate-300" style={INNER_PANEL_STYLE}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">unit production chart</p>
            <span className="text-[10px] uppercase tracking-widest text-slate-500">LINE SERIES / PLAYER</span>
          </div>
          <div className="space-y-3">
            <svg aria-hidden="true" focusable="false" viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-56 w-full rounded-lg bg-slate-950/40" preserveAspectRatio="none">
              <rect x="0" y="0" width={chartWidth} height={chartHeight} fill="#081428" rx="12" />
              {timeLabels.map((time, index) => (
                <line
                  key={`unitprod-grid-${time}-${index}`}
                  x1={16 + (index / Math.max(1, timeLabels.length - 1)) * innerWidth}
                  y1="16"
                  x2={16 + (index / Math.max(1, timeLabels.length - 1)) * innerWidth}
                  y2={chartHeight - 30}
                  stroke="rgba(255,255,255,0.05)"
                />
              ))}
              {chartLines.map(({ player, path }) => (
                <path
                  key={player.name}
                  d={path}
                  fill="none"
                  stroke={getPlayerColor(player.name)}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={highlightedPlayer && highlightedPlayer !== player.name ? 0.25 : 0.95}
                />
              ))}
              {timeLabels.map((time, index) => (
                <text
                  key={`unitprod-time-${time}-${index}`}
                  x={16 + (index / Math.max(1, timeLabels.length - 1)) * innerWidth}
                  y={chartHeight - 8}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="10"
                >
                  {time}
                </text>
              ))}
            </svg>
          </div>
        </section>
      );
    }

    if (activeVizTab === "spend") {
      if (visibleSpendSeries.length === 0) {
        return renderEmptyChart("NO_RESOURCE_SPEND");
      }

      const chartWidth = 640;
      const chartHeight = 220;
      const innerWidth = chartWidth - 32;
      const innerHeight = chartHeight - 32;
      const maxFrame = Math.max(1, ...visibleSpendSeries.flatMap((series) => series.points.map((point) => point.frame)));
      const chartLines = visibleSpendSeries.map((series) => {
        const points = series.points.map((point) => ({
          x: 16 + (innerWidth * point.frame) / maxFrame,
          y: 16 + (1 - point.value / spendChartMax) * innerHeight
        }));

        return {
          series,
          path: buildSmoothPath(points)
        };
      });

      return (
        <section aria-label="Resource Spend Timeline" className="space-y-3 rounded-lg p-3 text-xs font-mono text-slate-300" style={INNER_PANEL_STYLE}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">resource spend timeline</p>
            <span className="text-[10px] uppercase tracking-widest text-slate-500">PLAYER M/G</span>
          </div>
          <div className="space-y-3">
            <svg aria-hidden="true" focusable="false" viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-56 w-full rounded-lg bg-slate-950/40" preserveAspectRatio="none">
              <rect x="0" y="0" width={chartWidth} height={chartHeight} fill="#081428" rx="12" />
              {chartLines.map(({ series, path }) => (
                <path
                  key={series.key}
                  d={path}
                  fill="none"
                  stroke={series.kind === "mineral" ? "#275DAD" : "#C44536"}
                  strokeWidth={selectedSpendPlayer === series.playerName ? 3 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={!selectedSpendPlayer || selectedSpendPlayer === series.playerName ? 0.95 : 0.24}
                  strokeDasharray={series.kind === "gas" ? "6 4" : undefined}
                />
              ))}
              {visibleSpendSeries[0]?.points.map((point, index) => (
                <text
                  key={`spend-time-${point.frame}-${index}`}
                  x={16 + (innerWidth * point.frame) / maxFrame}
                  y={chartHeight - 8}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="10"
                >
                  {Math.max(0, Math.round(point.second))}
                </text>
              ))}
            </svg>
          </div>
        </section>
      );
    }

    if (activeVizTab === "production") {
      if (productionChartSeries.length === 0) {
        return renderEmptyChart("NO_PRODUCTION");
      }

      const chartWidth = 640;
      const chartHeight = 220;
      const maxFrame = Math.max(1, ...productionChartSeries.flatMap((series) => series.dataPoints.map((point) => point.frame)));
      const maxValue = Math.max(1, ...productionChartSeries.flatMap((series) => series.dataPoints.map((point) => point.value)));
      const innerWidth = chartWidth - 32;
      const innerHeight = chartHeight - 32;

      return (
        <section aria-label="Production Event Chart" className="space-y-3 rounded-lg p-3 text-xs font-mono text-slate-300" style={INNER_PANEL_STYLE}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">production event chart</p>
            <span className="text-[10px] uppercase tracking-widest text-slate-500">EVENT COUNT / WINDOW</span>
          </div>
          <svg aria-hidden="true" focusable="false" viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-56 w-full rounded-lg bg-slate-950/40" preserveAspectRatio="none">
            <rect x="0" y="0" width={chartWidth} height={chartHeight} fill="#081428" rx="12" />
            {productionChartSeries.map((series) => {
              const points = series.dataPoints.map((point) => ({
                x: 16 + (innerWidth * point.frame) / maxFrame,
                y: 16 + (1 - point.value / maxValue) * innerHeight
              }));

              return (
                <path
                  key={series.playerName}
                  d={buildLinearPath(points)}
                  fill="none"
                  stroke={getPlayerColor(series.playerName)}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={highlightedPlayer && highlightedPlayer !== series.playerName ? 0.25 : 0.95}
                />
              );
            })}
          </svg>
        </section>
      );
    }

    if (activeVizTab === "tech") {
      if (techEvents.length === 0 || techPlayerNames.length === 0) {
        return renderEmptyChart("NO_TECH_TIMING");
      }

      const chartMaxSecond = Math.max(1, ...techEvents.map((event) => event.second));

      return (
        <section aria-label="Tech Marker Chart" data-testid="vault-tech-tree" className="space-y-3 rounded-lg p-3 text-xs font-mono text-slate-300" style={INNER_PANEL_STYLE}>
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
              <span className="text-slate-200">PLAYER AXIS MARKERS</span>
              <span className="text-slate-500">click a marker to update techEventInfo</span>
            </div>
            <div className="mt-2 space-y-2">
              {techPlayerNames.map((playerName) => {
                const playerEvents = techEvents.filter((event) => event.playerName === playerName);

                return (
                  <div key={playerName} className="grid grid-cols-[110px_1fr] items-center gap-3">
                    <span className="text-slate-300">{playerName}</span>
                    <div className="relative h-10 rounded bg-slate-950/30">
                      <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-slate-700/70" />
                      {playerEvents.length > 0 ? (
                        playerEvents.map((event) => (
                          <button
                            key={`${event.playerName}-${event.second}-${event.name}`}
                            type="button"
                            aria-label={`${event.playerName} ${event.name} ${event.second}s`}
                            onClick={() => handleTechMarkerClick(event)}
                            className="absolute -top-1 rounded-full border px-2 py-1 text-[10px] uppercase tracking-widest transition-all"
                            style={{
                              left: `calc(${(event.second / chartMaxSecond) * 100}% - 28px)`,
                              borderColor: "rgba(255,255,255,0.12)",
                              color: "#cbd5e1",
                              backgroundColor: "rgba(255,255,255,0.04)"
                            }}
                          >
                            {event.second}s {event.name}
                          </button>
                        ))
                      ) : (
                        <span className="absolute left-2 top-2 text-[10px] uppercase tracking-widest text-slate-500">NO EVENTS</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      );
    }

    if (activeVizTab === "battle") {
      if (battleSeries.length === 0) {
        return renderEmptyChart("NO_BATTLE_INTENSITY");
      }

      const chartWidth = 640;
      const chartHeight = 180;
      const battleValues = battleSeries.map((point) => Math.max(0, point.sum));
      const points = scaleSeriesPoints(battleValues, chartWidth, chartHeight, 18);
      const battleSnapshot = getSeriesSnapshot(battleSeries, "sum", 0);

      return (
        <section aria-label="Battle APM Timeline" data-testid="vault-battle-pressure" className="space-y-3 rounded-lg p-3 text-xs font-mono text-slate-300" style={INNER_PANEL_STYLE}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">battle apm timeline</p>
            <span className="text-[10px] uppercase tracking-widest text-slate-500">summed / smoothed</span>
          </div>
          <div className="rounded border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <svg aria-hidden="true" focusable="false" viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-44 w-full" preserveAspectRatio="none">
              <rect x="0" y="0" width={chartWidth} height={chartHeight} rx="12" fill="#081428" />
              <path d={buildSmoothPath(points)} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="18" y1={chartHeight - 24} x2={chartWidth - 18} y2={chartHeight - 24} stroke="rgba(255,255,255,0.08)" />
              {points.map((point, index) => (
                <circle key={`battle-point-${index}`} cx={point.x} cy={point.y} r="3.5" fill="#22d3ee" />
              ))}
            </svg>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-slate-300">SUMMED APM</span>
              <span className="text-slate-300">
                {battleSnapshot.opening.toFixed(1)} / {battleSnapshot.mid.toFixed(1)} / {battleSnapshot.late.toFixed(1)}
              </span>
              <span className="text-slate-500">SMOOTHED SINGLE LINE</span>
            </div>
          </div>
        </section>
      );
    }

    if (activeVizTab === "actions") {
      if (buildOrders.length === 0 || apmData.length === 0) {
        return renderEmptyChart("NO_ACTION_MIX");
      }

      return (
        <section aria-label="Action Mix Matrix" data-testid="vault-actions-mix" className="space-y-3 rounded-lg p-3 text-xs font-mono text-slate-300" style={INNER_PANEL_STYLE}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">action mix matrix</p>
            <span className="text-[10px] uppercase tracking-widest text-slate-500">macro / combat / tech</span>
          </div>
          <div className="space-y-2">
            {allGamePlayers.map((player) => {
              const mix = getActionMix(player);
              const dominant = getActionMixDominantLabel(mix);
              const isDimmed = highlightedPlayer != null && highlightedPlayer !== player.name;
              const bars = [
                { key: "macro", value: mix.macro, color: "bg-cyan-500/60" },
                { key: "combat", value: mix.combat, color: "bg-emerald-400/40" },
                { key: "tech", value: mix.tech, color: "bg-amber-400/40" }
              ];

              return (
                <div key={player.name} className="rounded border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.08)", opacity: isDimmed ? 0.5 : 1 }}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-200">{player.name}</span>
                    <span className="text-slate-500">DOMINANT {dominant}</span>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-800">
                    <div className="flex h-full w-full">
                      {bars.map((bar) => (
                        <span key={`${player.name}-${bar.key}`} className={bar.color} style={{ width: `${(bar.value / mix.total) * 100}%` }} />
                      ))}
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
        </section>
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
    if (activeVizTab === "spend") {
      if (resourceSpendTimelines.length === 0) {
        return null;
      }

      return (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setResourceSpendFocus({ playerName: "", mode: "both" });
              onHighlightedPlayerChange(null);
            }}
            className="rounded border px-3 py-1 text-[10px] font-mono uppercase tracking-widest transition-all"
            style={{
              backgroundColor: !selectedSpendPlayer ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.04)",
              borderColor: !selectedSpendPlayer ? "rgba(34,211,238,0.35)" : "rgba(255,255,255,0.1)",
              color: !selectedSpendPlayer ? "#22d3ee" : "#94a3b8"
            }}
          >
            ALL
          </button>
          {selectedSpendPlayer ? (
            <>
              {(["both", "mineral", "gas"] as const).map((mode) => {
                const label = mode === "both" ? "MINERAL + GAS" : mode.toUpperCase();
                const isActive = selectedSpendMode === mode;

                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setResourceSpendFocus({ playerName: selectedSpendPlayer, mode });
                      onHighlightedPlayerChange(null);
                    }}
                    className="rounded border px-3 py-1 text-[10px] font-mono uppercase tracking-widest transition-all"
                    style={{
                      backgroundColor: isActive ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.04)",
                      borderColor: isActive ? "rgba(34,211,238,0.35)" : "rgba(255,255,255,0.1)",
                      color: isActive ? "#22d3ee" : "#94a3b8"
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </>
          ) : null}
          {visibleSpendSeries.map((series) => {
            const isActive = !selectedSpendPlayer || selectedSpendPlayer === series.playerName;

            return (
              <button
                key={series.key}
                type="button"
                onClick={() => {
                  setResourceSpendFocus({ playerName: series.playerName, mode: "both" });
                  onHighlightedPlayerChange(null);
                }}
                className="rounded border px-3 py-1 text-[10px] font-mono uppercase tracking-widest transition-all"
                style={{
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderColor: "rgba(255,255,255,0.1)",
                  color: isActive ? "#cbd5e1" : "#64748b",
                  opacity: isActive ? 1 : 0.45
                }}
              >
                {series.label}
              </button>
            );
          })}
        </div>
      );
    }

    if (activeVizTab === "battle") {
      return null;
    }

    if (activeVizTab === "apm" && apmData.length === 0) {
      return null;
    }

    if (activeVizTab === "unitprod" && productionSeries.length === 0) {
      return null;
    }

    if (activeVizTab === "production" && productionChartSeries.length === 0) {
      return null;
    }

    if (activeVizTab === "tech" && (techEvents.length === 0 || techPlayerNames.length === 0)) {
      return null;
    }

    if (activeVizTab === "actions" && (buildOrders.length === 0 || apmData.length === 0)) {
      return null;
    }

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
        return "범례를 클릭하면 플레이어 라인이 강조됩니다.";
      case "unitprod":
        return "시간 구간별 유닛 생산량(유효 생산 기준)입니다.";
      case "spend":
        if (resourceSpendTimelines.length === 0) {
          return "데이터가 없습니다.";
        }
        if (!selectedSpendPlayer) {
          return "전체 플레이어 조회 모드입니다. 플레이어 버튼([M]/[G])을 클릭하면 해당 플레이어가 선택됩니다.";
        }
        if (selectedSpendMode === "mineral") {
          return `${selectedSpendPlayer} Mineral 강조, Gas 숨김`;
        }
        if (selectedSpendMode === "gas") {
          return `${selectedSpendPlayer} Gas 강조, Mineral 숨김`;
        }
        return `${selectedSpendPlayer} 선택 상태: Mineral/Gas 동시 조회`;
      case "production":
        return "시간 구간별 생산 이벤트 개수입니다.";
      case "tech":
        if (techEvents.length === 0 || techPlayerNames.length === 0) {
          return "데이터가 없습니다.";
        }
        return techFocus ? `필터: ${techFocus.playerName} / ${techFocus.kind.toUpperCase()} 강조` : "Tech/UPG 숫자를 클릭하면 해당 플레이어의 해당 이벤트만 강조됩니다.";
      case "battle":
        if (battleSeries.length === 0) {
          return "데이터가 없습니다.";
        }
        return "전 플레이어 APM 합계 기반 교전 강도 추정치입니다.";
      case "actions":
        if (buildOrders.length === 0 || apmData.length === 0) {
          return "데이터가 없습니다.";
        }
        return "APM + 생산 이벤트 기반 액션 비중 추정치입니다.";
      default:
        return "범례를 클릭하면 플레이어 라인이 강조됩니다.";
    }
  }

  function renderTechEventInfo() {
    if (activeVizTab === "tech") {
      return techEventInfo ?? "TECH_EVENT: CLICK_MARKER_TO_VIEW";
    }

    return "TECH_EVENT: NONE_SELECTED";
  }

  function renderSummaryArea() {
    if (activeVizTab === "apm") {
      if (apmData.length === 0) {
        return null;
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

    if (activeVizTab === "unitprod") {
      if (unitProductionRows.length === 0) {
        return null;
      }

      return (
        <div className="overflow-hidden rounded-lg" style={INNER_PANEL_STYLE}>
          <table data-testid="vault-unit-production-summary" className="w-full text-xs font-mono">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {["PLAYER", "TOTAL", "WORKER", "ARMY", "TECH_UNIT"].map((header) => (
                  <th key={header} className="px-3 py-2 text-left text-[10px] tracking-widest text-slate-500">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {unitProductionRows.map((row) => {
                const isDimmed = highlightedPlayer != null && highlightedPlayer !== row.playerName;

                return (
                  <tr key={row.playerName} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: isDimmed ? 0.5 : 1 }}>
                    <td className="px-3 py-2 text-slate-300">{row.playerName}</td>
                    <td className="px-3 py-2 text-slate-200">{row.total}</td>
                    <td className="px-3 py-2 text-slate-400">{row.worker}</td>
                    <td className="px-3 py-2 text-slate-400">{row.army}</td>
                    <td className="px-3 py-2 text-slate-400">{row.techUnit}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeVizTab === "spend") {
      if (resourceSpendRows.length === 0) {
        return null;
      }

      return (
        <div className="overflow-hidden rounded-lg" style={INNER_PANEL_STYLE}>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {["PLAYER", "MINERAL", "GAS", "TOTAL"].map((header) => (
                  <th key={header} className="px-3 py-2 text-left text-[10px] tracking-widest text-slate-500">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
            {resourceSpendRows.map((row) => {
              const isDimmed = selectedSpendPlayer !== "" && selectedSpendPlayer !== row.playerName;
              return (
                <tr
                  key={row.playerName}
                  data-testid={`vault-resource-spend-row-${row.playerName}`}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: isDimmed ? 0.45 : 1 }}
                >
                  <td className="px-3 py-2 text-slate-300">{row.playerName}</td>
                  <td className="px-3 py-2 text-slate-400">{(row.totalMineral ?? 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-slate-400">{(row.totalGas ?? 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-slate-200">{row.totalSpend.toLocaleString()}</td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeVizTab === "production") {
      if (productionChartSeries.length === 0) {
        return null;
      }

      return (
        <div className="overflow-hidden rounded-lg" style={INNER_PANEL_STYLE}>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {["PLAYER", "EVENTS", "PEAK_BUCKET", "WINDOWS"].map((header) => (
                  <th key={header} className="px-3 py-2 text-left text-[10px] tracking-widest text-slate-500">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productionChartSeries.map((row) => {
                const peakBucket = row.dataPoints.reduce((peak, point) => (point.value > peak.value ? point : peak), row.dataPoints[0] ?? { frame: 0, value: 0 });
                const isDimmed = highlightedPlayer != null && highlightedPlayer !== row.playerName;

                return (
                  <tr key={row.playerName} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: isDimmed ? 0.5 : 1 }}>
                    <td className="px-3 py-2 text-slate-300">{row.playerName}</td>
                    <td className="px-3 py-2 text-slate-200">{row.dataPoints.reduce((total, point) => total + point.value, 0)}</td>
                    <td className="px-3 py-2 text-slate-400">{formatBuildOrderTime(peakBucket.frame)} · {peakBucket.value}</td>
                    <td className="px-3 py-2 text-slate-400">{row.dataPoints.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeVizTab === "tech") {
      if (techEvents.length === 0 || techSummaryRows.length === 0) {
        return null;
      }

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
      if (battleSeries.length === 0) {
        return null;
      }

      const battleSnapshot = getSeriesSnapshot(battleSeries, "sum", 0);

      return (
        <div className="space-y-3 rounded-lg p-3" style={INNER_PANEL_STYLE}>
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">summed apm summary</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded border p-2 text-xs font-mono" style={INNER_PANEL_STYLE}>
              <div className="text-slate-300">OPEN</div>
              <div className="mt-1 text-slate-500">{battleSnapshot.opening.toFixed(1)}</div>
            </div>
            <div className="rounded border p-2 text-xs font-mono" style={INNER_PANEL_STYLE}>
              <div className="text-slate-300">MID</div>
              <div className="mt-1 text-slate-500">{battleSnapshot.mid.toFixed(1)}</div>
            </div>
            <div className="rounded border p-2 text-xs font-mono" style={INNER_PANEL_STYLE}>
              <div className="text-slate-300">LATE</div>
              <div className="mt-1 text-slate-500">{battleSnapshot.late.toFixed(1)}</div>
            </div>
          </div>
        </div>
      );
    }

    if (activeVizTab === "actions") {
      if (buildOrders.length === 0 || apmData.length === 0) {
        return null;
      }

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
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <article>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[10px] font-mono tracking-widest text-slate-500">Selected_Game</p>
            <Link
              href={buildAnalyzerHref(game.id)}
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

          {isHydrating ? (
            <div className="rounded-lg border px-4 py-5 text-xs font-mono text-slate-400" style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
              FETCHING_GAME...
            </div>
          ) : hydrateError ? (
            <div className="rounded-lg border px-4 py-5 text-xs font-mono font-bold" style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(239,68,68,0.25)", color: "#8a2f2f" }}>
              ERROR: {hydrateError}
            </div>
          ) : (
            <div className="rounded-lg border p-3" style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-mono uppercase">
                <div className="font-bold text-slate-200">
                  #{game.id} {game.map}
                </div>
                <div className="text-slate-500">{game.startTime}</div>
              </div>

              <div className="rounded border p-1" style={{ backgroundColor: "rgba(74,79,89,0.72)", borderColor: "rgba(255,255,255,0.08)" }}>
                <div className="grid gap-px md:grid-cols-[minmax(0,1fr)_minmax(180px,0.9fr)_minmax(0,1fr)]">
                  <div data-testid="vault-start-grid-left" className="contents">
                    {Array.from({ length: 3 }, (_, rowIndex) => {
                      const entry = board.leftColumn[rowIndex];
                      return entry ? (
                        <PlayerBoardCard key={`left-${entry.player.name}`} player={entry.player} result={entry.result} highlighted={!highlightedPlayer || highlightedPlayer === entry.player.name} />
                      ) : (
                        <div key={`left-empty-${rowIndex}`} className="min-h-[140px] rounded-sm bg-white/70" />
                      );
                    })}
                  </div>

                  <div className="contents">
                    {Array.from({ length: 3 }, (_, rowIndex) =>
                      rowIndex === 1 ? (
                        <div
                          key="center-card"
                          className="flex min-h-[140px] flex-col items-center justify-center rounded-sm px-4 py-5 text-center"
                          style={{
                            background:
                              "radial-gradient(circle at 28% 25%, rgba(255,255,255,0.22), transparent 40%), radial-gradient(circle at 72% 72%, rgba(255,255,255,0.18), transparent 34%), rgba(219,219,223,0.92)"
                          }}
                        >
                          <div className="text-4xl font-mono font-bold text-slate-700">{game.matchup}</div>
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
                          <div className="text-3xl font-mono font-bold text-slate-700">{game.playTime}</div>
                        </div>
                      ) : (
                        <div key={`center-empty-${rowIndex}`} className="min-h-[140px] rounded-sm bg-white/70" />
                      )
                    )}
                  </div>

                  <div data-testid="vault-start-grid-right" className="contents">
                    {Array.from({ length: 3 }, (_, rowIndex) => {
                      const entry = board.rightColumn[rowIndex];
                      return entry ? (
                        <PlayerBoardCard key={`right-${entry.player.name}`} player={entry.player} result={entry.result} highlighted={!highlightedPlayer || highlightedPlayer === entry.player.name} />
                      ) : (
                        <div key={`right-empty-${rowIndex}`} className="min-h-[140px] rounded-sm bg-white/70" />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </article>

        <article
          data-testid="vault-viz-panel"
          style={
            isFullscreen
              ? {
                  position: "fixed",
                  inset: 12,
                  zIndex: 9999,
                  background: "rgba(224, 224, 226, 0.98)",
                  boxShadow: "0 6px 22px rgba(0, 0, 0, 0.18)",
                  overflow: "auto",
                  padding: 16,
                  borderRadius: 12
                }
              : undefined
          }
        >
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
          <div className="space-y-3">
            {shouldRenderAnalysisNotice ? (
              <div className="rounded-lg px-3 py-2 text-xs font-mono text-slate-300" style={INNER_PANEL_STYLE}>
                <p className="mt-1">{analysisNoticeMessage}</p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
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

            {renderChartArea()}

            {renderLegendRow()}

            <div className="rounded-lg px-3 py-2 text-xs font-mono text-slate-400" style={INNER_PANEL_STYLE}>
              <p className="mt-1">{renderChartHint()}</p>
            </div>

            <div className="rounded-lg px-3 py-2 text-xs font-mono text-slate-300" style={INNER_PANEL_STYLE}>
              <p data-testid="vault-tech-tree-focus" className="mt-1">{renderTechEventInfo()}</p>
            </div>

            {renderSummaryArea()}
          </div>
        </article>
      </div>
    </div>
  );
}
