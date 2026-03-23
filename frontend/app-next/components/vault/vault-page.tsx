"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, RefreshCw } from "lucide-react";
import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { generateApmSeries } from "@/lib/fixtures/analyzer";
import { CYAN_PANEL_STYLE, CYAN_SECTION_DIVIDER_STYLE, INNER_PANEL_STYLE } from "@/lib/constants/ui-styles";
import { buildApiUrl } from "@/lib/api/url";
import { RaceBadge } from "@/components/shared/race-badge";
import { ResultBadge, StatusBadge } from "@/components/shared/status-badge";
import { getPlayerColor } from "@/lib/utils/player-colors";
import { getStartGridBoard } from "@/lib/utils/start-grid-board";
import type { ApiApmTimelineRow, ApiGameDetailResponse, ApiGetGameResponse } from "@/types/api";
import type { VaultGame, VaultPlayer, VaultPageModel } from "@/types/vault";

const CARD_STYLE = CYAN_PANEL_STYLE;
const VIZ_TABS = [
  { id: "apm", label: "APM" },
  { id: "unitprod", label: "Unit Production" },
  { id: "spend", label: "Resource Spend" },
  { id: "production", label: "Production" },
  { id: "tech", label: "Tech / Upgrade" },
  { id: "battle", label: "Battle Intensity" },
  { id: "actions", label: "Action Mix" }
] as const;

type VaultVizTab = (typeof VIZ_TABS)[number]["id"];

type VaultTechFocus = {
  playerName: string;
  kind: "tech" | "upgrade";
} | null;

type VaultHydratedDetail = {
  reliability: string | null;
  reliabilityMOfN: string | null;
  replayFileCount: number | null;
  analysisMessage: string | null;
  apmSeries: Array<Record<string, number>>;
};

async function fetchBrowserApiJson<T>(path: string): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    headers: {
      accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    let message = `API request failed: ${path}`;

    try {
      const payload = (await response.json()) as { error?: unknown; message?: unknown };
      const errorMessage = payload.error ?? payload.message;
      if (typeof errorMessage === "string" && errorMessage.trim()) {
        message = errorMessage.trim();
      }
    } catch {
      // Keep the generic message above.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

function toNumber(value: unknown, fallback = 0): number {
  const candidate = Number(value);
  return Number.isFinite(candidate) ? candidate : fallback;
}

function buildVaultApmSeries(rows: ApiApmTimelineRow[] | undefined): Array<Record<string, number>> {
  const timelines = rows ?? [];
  const pointCount = Math.max(0, ...timelines.map((row) => row.data_points?.length ?? 0));
  if (pointCount === 0) {
    return [];
  }

  return Array.from({ length: pointCount }, (_, index) => {
    const sampleFrame = toNumber(timelines.find((row) => row.data_points?.[index]?.frame != null)?.data_points?.[index]?.frame);
    const point: Record<string, number> = {
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

function createHydratedVaultDetail(gameResponse: ApiGetGameResponse, detailResponse: ApiGameDetailResponse): VaultHydratedDetail {
  return {
    reliability: gameResponse.reliability?.trim() || null,
    reliabilityMOfN: gameResponse.reliability_m_of_n?.trim() || null,
    replayFileCount: gameResponse.game?.edges?.replay_files?.length ?? null,
    analysisMessage: detailResponse.analysis_status?.user_message?.trim() || null,
    apmSeries: buildVaultApmSeries(detailResponse.detail?.apm_timeline)
  };
}

function getAllGamePlayers(game: VaultGame): VaultPlayer[] {
  return [...game.winnerTeam, ...game.loserTeam];
}

function buildAnalyzerHref(currentUser: string, gameId: number) {
  return `/analyzer?currentUser=${encodeURIComponent(currentUser)}&gameId=${gameId}`;
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
        backgroundColor: highlighted
          ? "rgba(34,211,238,0.12)"
          : isWinner
            ? "rgba(16,185,129,0.04)"
            : "rgba(239,68,68,0.04)",
        border: `1px solid ${
          highlighted ? "rgba(34,211,238,0.35)" : isWinner ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"
        }`,
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
      </div>
    </div>
  );
}

function GameDetailExpand({
  game,
  currentUser,
  hydratedDetail,
  isHydrating,
  hydrateError,
  activeVizTab,
  isFullscreen,
  techFocus,
  highlightedPlayer,
  onActiveVizTabChange,
  onFullscreenToggle,
  onTechFocusChange
}: {
  game: VaultGame;
  currentUser: string;
  hydratedDetail?: VaultHydratedDetail;
  isHydrating?: boolean;
  hydrateError?: string | null;
  activeVizTab: VaultVizTab;
  isFullscreen: boolean;
  techFocus: VaultTechFocus;
  highlightedPlayer: string | null;
  onActiveVizTabChange: (tab: VaultVizTab) => void;
  onFullscreenToggle: () => void;
  onTechFocusChange: (focus: VaultTechFocus) => void;
}) {
  const apmData = useMemo(() => {
    if (hydratedDetail?.apmSeries.length) {
      return hydratedDetail.apmSeries;
    }

    return generateApmSeries(Number.parseInt(game.playTime.split(":")[0] ?? "0", 10) + 1);
  }, [game.playTime, hydratedDetail?.apmSeries]);
  const allPlayers = getAllGamePlayers(game).map((player) => player.name);
  const board = useMemo(() => getStartGridBoard(game), [game]);
  const insightMessage = hydratedDetail?.analysisMessage || game.matchStory;
  const reliabilityLabel = hydratedDetail?.reliabilityMOfN
    ? `${hydratedDetail.reliabilityMOfN}${hydratedDetail.reliability ? ` • ${hydratedDetail.reliability}` : ""}`
    : hydratedDetail?.reliability || "UNAVAILABLE";

  const renderVizPanel = () => {
    if (activeVizTab === "apm") {
      return (
        <div>
          <p className="mb-3 text-[10px] font-mono tracking-widest text-slate-500">APM TIMELINE</p>
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
                  <Line key={name} type="monotone" dataKey={name} stroke={getPlayerColor(name)} dot={false} strokeWidth={1.5} />
                ))}
                <Legend
                  wrapperStyle={{ fontSize: 10, fontFamily: "JetBrains Mono", paddingTop: 8 }}
                  formatter={(value) => <span style={{ color: getPlayerColor(String(value)) }}>{String(value)}</span>}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (activeVizTab === "tech") {
      return (
        <div data-testid="vault-tech-tree" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {getAllGamePlayers(game).map((player) => {
              const isActive = techFocus?.playerName === player.name;

              return (
                <button
                  key={player.name}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() =>
                    onTechFocusChange(
                      techFocus?.playerName === player.name ? null : { playerName: player.name, kind: techFocus?.kind ?? "tech" }
                    )
                  }
                  className="rounded border px-3 py-1 text-xs font-mono transition-all"
                  style={{
                    backgroundColor: isActive ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.04)",
                    borderColor: isActive ? "rgba(34,211,238,0.35)" : "rgba(255,255,255,0.1)",
                    color: isActive ? "#22d3ee" : "#cbd5e1"
                  }}
                >
                  {player.name}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            {(["tech", "upgrade"] as const).map((kind) => {
              const isActive = techFocus?.kind === kind;

              return (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    if (!techFocus) {
                      const firstPlayer = getAllGamePlayers(game)[0];
                      if (firstPlayer) {
                        onTechFocusChange({ playerName: firstPlayer.name, kind });
                      }
                      return;
                    }

                    onTechFocusChange(
                      techFocus.kind === kind ? null : { ...techFocus, kind }
                    );
                  }}
                  className="rounded border px-3 py-1 text-[10px] font-mono uppercase tracking-widest transition-all"
                  style={{
                    backgroundColor: isActive ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.04)",
                    borderColor: isActive ? "rgba(34,211,238,0.35)" : "rgba(255,255,255,0.1)",
                    color: isActive ? "#22d3ee" : "#94a3b8"
                  }}
                >
                  {kind}
                </button>
              );
            })}
          </div>

          <div data-testid="vault-tech-tree-focus" className="rounded-lg p-3 text-xs font-mono" style={INNER_PANEL_STYLE}>
            {techFocus ? `FOCUS: ${techFocus.playerName} • ${techFocus.kind}` : "FOCUS: NONE"}
          </div>
        </div>
      );
    }

    if (activeVizTab === "unitprod") {
      return <div className="text-xs font-mono text-slate-400">UNITPROD VIEW</div>;
    }

    if (activeVizTab === "spend") {
      return <div className="text-xs font-mono text-slate-400">SPEND VIEW</div>;
    }

    if (activeVizTab === "production") {
      return <div className="text-xs font-mono text-slate-400">PRODUCTION VIEW</div>;
    }

    if (activeVizTab === "battle") {
      return <div className="text-xs font-mono text-slate-400">BATTLE VIEW</div>;
    }

    return <div className="text-xs font-mono text-slate-400">ACTIONS VIEW</div>;
  };

  return (
    <div data-testid="vault-detail-shell" data-fullscreen={isFullscreen ? "true" : "false"} className="mt-2 rounded-xl p-5" style={{ backgroundColor: "#080e1f", border: "1px solid rgba(34,211,238,0.12)" }}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400">#{game.id}</span>
          <span className="text-sm font-mono font-semibold text-slate-200">{game.map}</span>
          <span className="text-xs font-mono text-slate-500">{game.startTime}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            onClick={onFullscreenToggle}
            className="rounded-lg px-3 py-1.5 text-xs font-mono font-bold tracking-wider transition-all"
            style={{
              backgroundColor: isFullscreen ? "rgba(34,211,238,0.18)" : "rgba(255,255,255,0.04)",
              color: isFullscreen ? "#22d3ee" : "#cbd5e1",
              border: "1px solid rgba(255,255,255,0.1)"
            }}
          >
            FULLSCREEN
          </button>
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
            GAME ANALYZER
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div>
          <p className="mb-3 text-[10px] font-mono tracking-widest text-slate-500">SELECTED_GAME</p>

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
              <p className="mt-1 text-xs font-mono text-slate-200">
                {isHydrating ? "FETCHING_LIVE_DETAIL..." : hydrateError ? "DETAIL_FALLBACK" : "LIVE_DETAIL_READY"}
              </p>
            </div>
          </div>

          <div className="my-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px_minmax(0,1fr)]">
            <div data-testid="vault-start-grid-left" className="flex flex-col gap-2">
              {board.leftColumn.map((entry) => (
                <PlayerBoardCard
                  key={entry.player.name}
                  player={entry.player}
                  result={entry.result}
                  highlighted={!highlightedPlayer || highlightedPlayer === entry.player.name}
                />
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
                <PlayerBoardCard
                  key={entry.player.name}
                  player={entry.player}
                  result={entry.result}
                  highlighted={!highlightedPlayer || highlightedPlayer === entry.player.name}
                />
              ))}
            </div>
          </div>

          {game.matchStory ? (
            <div
              className="mt-3 rounded-lg p-3"
              style={{ backgroundColor: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.1)" }}
            >
              <p className="mb-1 text-[10px] font-mono tracking-widest text-cyan-500">MATCH STORY</p>
              <p className="text-xs leading-relaxed text-slate-300">{insightMessage}</p>
            </div>
          ) : null}
        </div>

        <div>
          <div className="mb-3 flex flex-wrap gap-2">
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

          <div className="rounded-lg p-3" style={INNER_PANEL_STYLE}>
            {renderVizPanel()}
          </div>
        </div>
      </div>
    </div>
  );
}

function GameRow({
  game,
  currentUser,
  isExpanded,
  onToggle,
  hydratedDetail,
  isHydrating,
  hydrateError
}: {
  game: VaultGame;
  currentUser: string;
  isExpanded: boolean;
  onToggle: () => void;
  hydratedDetail?: VaultHydratedDetail;
  isHydrating?: boolean;
  hydrateError?: string | null;
}) {
  const isCurrentUserWinner = game.winnerTeam.some((player) => player.isCurrentUser);
  const primaryTeam = isCurrentUserWinner ? game.winnerTeam : game.loserTeam;
  const secondaryTeam = isCurrentUserWinner ? game.loserTeam : game.winnerTeam;

  return (
    <div className="border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
      <div
        className="grid cursor-pointer items-center gap-4 px-4 py-3 transition-all duration-200 hover:bg-slate-800/30"
        style={{
          gridTemplateColumns: "50px 1fr 80px 2fr 2fr 100px 80px 1fr",
          backgroundColor: isExpanded ? "rgba(34,211,238,0.06)" : "transparent"
        }}
        onClick={onToggle}
      >
        <span className="text-xs font-mono text-slate-500">#{game.id}</span>
        <span className="truncate text-xs font-mono text-slate-300">{game.map}</span>
        <span className="text-xs font-mono text-slate-400">{game.matchup}</span>

        <div className="flex flex-col gap-0.5">
          <ResultBadge result={isCurrentUserWinner ? "WINNER" : "LOSER"} size="sm" />
          {primaryTeam.map((player) => (
            <div key={player.name} className="flex items-center gap-1 text-[11px] font-mono">
              <RaceBadge race={player.race} />
              <span className={player.isCurrentUser ? "text-cyan-300" : "text-slate-400"}>{player.name}</span>
              {player.isCurrentUser ? <span className="text-[9px] text-cyan-500">[YOU]</span> : null}
              <span className="ml-auto text-slate-600">
                A:{player.apm} E:{player.eapm}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-0.5">
          <ResultBadge result={isCurrentUserWinner ? "LOSER" : "WINNER"} size="sm" />
          {secondaryTeam.map((player) => (
            <div key={player.name} className="flex items-center gap-1 text-[11px] font-mono">
              <RaceBadge race={player.race} />
              <span className="text-slate-400">{player.name}</span>
              <span className="ml-auto text-slate-600">
                A:{player.apm} E:{player.eapm}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <StatusBadge status={game.analyzerStatus} />
        </div>
        <span className="text-center text-xs font-mono text-slate-400">{game.playTime}</span>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-slate-500">{game.startTime}</span>
          {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-600" /> : <ChevronDown className="h-4 w-4 text-slate-600" />}
        </div>
      </div>
    </div>
  );
}

export function VaultPage({ model }: { model: VaultPageModel }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [detailByGameId, setDetailByGameId] = useState<Record<number, VaultHydratedDetail>>({});
  const [detailStatusByGameId, setDetailStatusByGameId] = useState<Record<number, "idle" | "loading" | "success" | "error">>({});
  const [detailErrorByGameId, setDetailErrorByGameId] = useState<Record<number, string | null>>({});
  const [activeVizTab, setActiveVizTab] = useState<VaultVizTab>("apm");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [techFocus, setTechFocus] = useState<VaultTechFocus>(null);
  const [highlightedPlayer, setHighlightedPlayer] = useState<string | null>(null);
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(model.games.length / pageSize));
  const pageGames = model.games.slice((page - 1) * pageSize, page * pageSize);
  const currentUserHref = `/vault?currentUser=${encodeURIComponent(model.currentUser)}`;

  useEffect(() => {
    if (expandedId != null && !model.games.some((game) => game.id === expandedId)) {
      setExpandedId(null);
    }
  }, [expandedId, model.games]);

  useEffect(() => {
    if (!isFullscreen) {
      document.body.classList.remove("viz-fullscreen-lock");
      return undefined;
    }

    document.body.classList.add("viz-fullscreen-lock");

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("viz-fullscreen-lock");
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (expandedId == null) {
      return;
    }

    let cancelled = false;
    setDetailStatusByGameId((previous) => ({ ...previous, [expandedId]: "loading" }));
    setDetailErrorByGameId((previous) => ({ ...previous, [expandedId]: null }));

    void Promise.all([
      fetchBrowserApiJson<ApiGetGameResponse>(`/api/v1/games/${expandedId}`),
      fetchBrowserApiJson<ApiGameDetailResponse>(`/api/v1/games/${expandedId}/detail`)
    ])
      .then(([gameResponse, detailResponse]) => {
        if (cancelled) {
          return;
        }
        setDetailByGameId((previous) => ({
          ...previous,
          [expandedId]: createHydratedVaultDetail(gameResponse, detailResponse)
        }));
        setDetailStatusByGameId((previous) => ({ ...previous, [expandedId]: "success" }));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setDetailStatusByGameId((previous) => ({ ...previous, [expandedId]: "error" }));
        setDetailErrorByGameId((previous) => ({
          ...previous,
          [expandedId]: error instanceof Error ? error.message : "failed to load selected game detail"
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [expandedId]);

  const handleSelectGame = (gameId: number) => {
    setExpandedId((current) => {
      const next = current === gameId ? null : gameId;
      if (next !== current) {
        setActiveVizTab("apm");
        setIsFullscreen(false);
        setTechFocus(null);
        setHighlightedPlayer(null);
        setDetailErrorByGameId((previous) => ({
          ...previous,
          [gameId]: null
        }));
        setDetailStatusByGameId((previous) => ({
          ...previous,
          [gameId]: next == null ? "idle" : "loading"
        }));
      }
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-5 rounded-sm" style={{ backgroundColor: "#22d3ee" }} />
          <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-slate-200">Recent Games</h2>
          <span className="rounded px-2 py-1 text-[10px] font-mono font-bold" style={{ backgroundColor: "rgba(34,211,238,0.08)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.18)" }}>
            CURRENT_USER: {model.currentUser}
          </span>
        </div>

        <Link
          href={currentUserHref}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 transition-all hover:text-slate-200"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <RefreshCw className="h-3 w-3" />
          REFRESH
        </Link>
      </div>

      <div className="rounded-xl overflow-hidden" style={CARD_STYLE}>
        <div
          className="grid items-center gap-4 px-4 py-2.5"
          style={{
            gridTemplateColumns: "50px 1fr 80px 2fr 2fr 100px 80px 1fr",
            backgroundColor: "#081428",
            ...CYAN_SECTION_DIVIDER_STYLE
          }}
        >
          {["ID", "MAP_NAME", "MATCHUP", "OUR_TEAM", "ENEMY_TEAM", "ANALYZER", "TIME", "START_TIME"].map((header) => (
            <span key={header} className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-600">
              {header}
            </span>
          ))}
        </div>

        {pageGames.map((game) => (
          <GameRow
            key={game.id}
            game={game}
            currentUser={model.currentUser}
            isExpanded={expandedId === game.id}
            hydratedDetail={detailByGameId[game.id]}
            isHydrating={detailStatusByGameId[game.id] === "loading"}
            hydrateError={detailErrorByGameId[game.id]}
            onToggle={() => handleSelectGame(game.id)}
          />
        ))}

        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="rounded px-4 py-1.5 text-xs font-mono transition-all hover:bg-slate-800 disabled:opacity-30"
            style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}
          >
            Prev
          </button>
          <span className="text-xs font-mono text-slate-500">
            PAGE {page}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page === totalPages}
            className="rounded px-4 py-1.5 text-xs font-mono transition-all hover:bg-slate-800 disabled:opacity-30"
            style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}
          >
            Next
          </button>
        </div>
      </div>

      {expandedId != null
        ? (() => {
            const expandedGame =
              model.games.find((game) => game.id === expandedId) ??
              pageGames.find((game) => game.id === expandedId) ??
              null;

            if (!expandedGame) {
              return null;
            }

            if (detailStatusByGameId[expandedId] === "loading") {
              return (
                <div
                  className="mt-2 rounded-xl px-5 py-4 text-xs font-mono text-slate-400"
                  style={{ backgroundColor: "#080e1f", border: "1px solid rgba(34,211,238,0.12)" }}
                >
                  FETCHING_GAME...
                </div>
              );
            }

            return (
                <GameDetailExpand
                  game={expandedGame}
                  currentUser={model.currentUser}
                  hydratedDetail={detailByGameId[expandedId]}
                  isHydrating={false}
                  hydrateError={detailErrorByGameId[expandedId]}
                activeVizTab={activeVizTab}
                isFullscreen={isFullscreen}
                techFocus={techFocus}
                highlightedPlayer={highlightedPlayer}
                onActiveVizTabChange={setActiveVizTab}
                onFullscreenToggle={() => setIsFullscreen((current) => !current)}
                onTechFocusChange={(focus) => {
                  setTechFocus(focus);
                  setHighlightedPlayer(focus?.playerName ?? null);
                }}
              />
            );
          })()
        : null}
    </div>
  );
}
