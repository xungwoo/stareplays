"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { generateApmSeries } from "@/lib/fixtures/analyzer";
import { CYAN_PANEL_STYLE, INNER_PANEL_STYLE } from "@/lib/constants/ui-styles";
import { RaceBadge } from "@/components/shared/race-badge";
import { ResultBadge } from "@/components/shared/status-badge";
import { getPlayerColor } from "@/lib/utils/player-colors";
import { getStartGridBoard } from "@/lib/utils/start-grid-board";
import type { ApiApmTimelineRow, ApiGameDetailResponse, ApiGetGameResponse } from "@/types/api";
import type { VaultGame, VaultPlayer } from "@/types/vault";

export type VaultTechFocus = {
  playerName: string;
  kind: "tech" | "upgrade";
} | null;

export type VaultHydratedDetail = {
  reliability: string | null;
  reliabilityMOfN: string | null;
  replayFileCount: number | null;
  analysisMessage: string | null;
  apmSeries: Array<Record<string, number>>;
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

export function createHydratedVaultDetail(gameResponse: ApiGetGameResponse, detailResponse: ApiGameDetailResponse): VaultHydratedDetail {
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

function getPlayerProductionProfile(player: VaultPlayer) {
  const total = player.production;
  const worker = Math.max(0, Math.round(player.production * 0.45));
  const army = Math.max(0, Math.round(player.production * 0.35));
  const tech = Math.max(0, total - worker - army);

  return { total, worker, army, tech };
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

function getApmData(game: VaultGame, hydratedDetail?: VaultHydratedDetail) {
  if (hydratedDetail?.apmSeries.length) {
    return hydratedDetail.apmSeries;
  }

  return generateApmSeries(Number.parseInt(game.playTime.split(":")[0] ?? "0", 10) + 1);
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

  function getTechMetric(playerName: string, kind: "tech" | "upgrade") {
    const player = allGamePlayers.find((entry) => entry.name === playerName);
    if (!player) {
      return 0;
    }

    return kind === "tech" ? Math.max(1, Math.round(player.production / 50)) : Math.max(1, Math.round(player.redundancy / 3));
  }

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
        <div className="rounded-lg p-3 text-xs font-mono text-slate-300" style={INNER_PANEL_STYLE}>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">production profile</p>
          <p className="mt-1 text-slate-400">selected player production curve</p>
          <div className="mt-3 space-y-1">
            {allGamePlayers.map((player) => {
              const profile = getPlayerProductionProfile(player);

              return (
                <div key={player.name} className="flex items-center justify-between gap-3">
                  <span className="text-slate-300">{player.name}</span>
                  <span className="text-slate-500">
                    TOTAL {profile.total} / WORKER {profile.worker} / ARMY {profile.army} / TECH {profile.tech}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (activeVizTab === "spend") {
      return (
        <div className="rounded-lg p-3 text-xs font-mono text-slate-300" style={INNER_PANEL_STYLE}>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">resource spend overview</p>
          <p className="mt-1 text-slate-400">cmd and ecmd pressure by player</p>
          <div className="mt-3 space-y-1">
            {allGamePlayers.map((player) => (
              <div key={player.name} className="flex items-center justify-between gap-3">
                <span className="text-slate-300">{player.name}</span>
                <span className="text-slate-500">
                  CMD {player.cmd.toLocaleString()} / ECMD {player.ecmd.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeVizTab === "production") {
      return (
        <div className="rounded-lg p-3 text-xs font-mono text-slate-300" style={INNER_PANEL_STYLE}>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">build order events</p>
          <p className="mt-1 text-slate-400">time-bucketed production pacing</p>
          <div className="mt-3 space-y-1">
            {allGamePlayers.map((player) => (
              <div key={player.name} className="flex items-center justify-between gap-3">
                <span className="text-slate-300">{player.name}</span>
                <span className="text-slate-500">
                  {player.production} prod events over {game.playTime}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeVizTab === "tech") {
      return (
        <div data-testid="vault-tech-tree-markers" className="rounded-lg p-3 text-xs font-mono text-slate-300" style={INNER_PANEL_STYLE}>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">tech tree</p>
          <p className="mt-1 text-slate-400">marker chart for tech and upgrade events</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {allGamePlayers.map((player) => (
              <div key={player.name} className="rounded border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-200">{player.name}</span>
                  <span className="text-slate-500">marker lane</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    aria-label={`${player.name} tech marker`}
                    onClick={() => handleTechMarkerClick(player.name, "tech")}
                    className="rounded border px-2 py-1 text-[10px] uppercase tracking-widest transition-all"
                    style={{ borderColor: "rgba(255,255,255,0.12)", color: "#cbd5e1", backgroundColor: "rgba(255,255,255,0.04)" }}
                  >
                    TECH
                  </button>
                  <button
                    type="button"
                    aria-label={`${player.name} upgrade marker`}
                    onClick={() => handleTechMarkerClick(player.name, "upgrade")}
                    className="rounded border px-2 py-1 text-[10px] uppercase tracking-widest transition-all"
                    style={{ borderColor: "rgba(255,255,255,0.12)", color: "#cbd5e1", backgroundColor: "rgba(255,255,255,0.04)" }}
                  >
                    UPG
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeVizTab === "battle") {
      return (
        <div className="rounded-lg p-3 text-xs font-mono text-slate-300" style={INNER_PANEL_STYLE}>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">combat snapshot</p>
          <p className="mt-1 text-slate-400">smoothing team pressure by player</p>
          <div className="mt-3 space-y-1">
            {allGamePlayers.map((player) => (
              <div key={player.name} className="flex items-center justify-between gap-3">
                <span className="text-slate-300">{player.name}</span>
                <span className="text-slate-500">
                  APM {player.apm} / EAPM {player.eapm} / EFF {player.effective.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeVizTab === "actions") {
      return (
        <div className="rounded-lg p-3 text-xs font-mono text-slate-300" style={INNER_PANEL_STYLE}>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">action mix</p>
          <p className="mt-1 text-slate-400">stacked input pressure and redundancy</p>
          <div className="mt-3 space-y-1">
            {allGamePlayers.map((player) => (
              <div key={player.name} className="flex items-center justify-between gap-3">
                <span className="text-slate-300">{player.name}</span>
                <span className="text-slate-500">
                  APM {player.apm} / REDUNDANCY {player.redundancy}%
                </span>
              </div>
            ))}
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
        <div className="space-y-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">unit production summary</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {allGamePlayers.map((player) => {
              const profile = getPlayerProductionProfile(player);

              return (
                <div key={player.name} className="rounded border p-2 text-xs font-mono" style={INNER_PANEL_STYLE}>
                  <div className="text-slate-300">{player.name}</div>
                  <div className="mt-1 text-slate-500">
                    TOTAL {profile.total} WORKER {profile.worker} ARMY {profile.army} TECH {profile.tech}
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
        <div className="space-y-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">resource spend summary</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {allGamePlayers.map((player) => (
              <div key={player.name} className="rounded border p-2 text-xs font-mono" style={INNER_PANEL_STYLE}>
                <div className="text-slate-300">{player.name}</div>
                <div className="mt-1 text-slate-500">
                  CMD {player.cmd.toLocaleString()} / ECMD {player.ecmd.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeVizTab === "production") {
      return (
        <div className="space-y-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">production event summary</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {allGamePlayers.map((player) => (
              <div key={player.name} className="rounded border p-2 text-xs font-mono" style={INNER_PANEL_STYLE}>
                <div className="text-slate-300">{player.name}</div>
                <div className="mt-1 text-slate-500">
                  PROD {player.production} / PLAY {game.playTime}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeVizTab === "tech") {
      return (
        <div data-testid="vault-tech-tree" className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {allGamePlayers.map((player) => {
              const techCount = getTechMetric(player.name, "tech");
              const upgradeCount = getTechMetric(player.name, "upgrade");
              const isFocused = techFocus?.playerName === player.name;

              return (
                <div key={player.name} className="rounded-lg p-3 text-xs font-mono" style={INNER_PANEL_STYLE}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-slate-200">{player.name}</span>
                    <span className="text-slate-500">{isFocused ? "FOCUSED" : "IDLE"}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      aria-pressed={techFocus?.playerName === player.name && techFocus.kind === "tech"}
                      aria-label={`${player.name} TECH ${techCount}`}
                      onClick={() => handleTechSummaryClick(player.name, "tech")}
                      className="rounded border px-3 py-1 transition-all"
                      style={{
                        backgroundColor: techFocus?.playerName === player.name && techFocus.kind === "tech" ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.04)",
                        borderColor: techFocus?.playerName === player.name && techFocus.kind === "tech" ? "rgba(34,211,238,0.35)" : "rgba(255,255,255,0.1)",
                        color: techFocus?.playerName === player.name && techFocus.kind === "tech" ? "#22d3ee" : "#cbd5e1"
                      }}
                    >
                      TECH {techCount}
                    </button>
                    <button
                      type="button"
                      aria-pressed={techFocus?.playerName === player.name && techFocus.kind === "upgrade"}
                      aria-label={`${player.name} UPG ${upgradeCount}`}
                      onClick={() => handleTechSummaryClick(player.name, "upgrade")}
                      className="rounded border px-3 py-1 transition-all"
                      style={{
                        backgroundColor: techFocus?.playerName === player.name && techFocus.kind === "upgrade" ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.04)",
                        borderColor: techFocus?.playerName === player.name && techFocus.kind === "upgrade" ? "rgba(34,211,238,0.35)" : "rgba(255,255,255,0.1)",
                        color: techFocus?.playerName === player.name && techFocus.kind === "upgrade" ? "#22d3ee" : "#cbd5e1"
                      }}
                    >
                      UPG {upgradeCount}
                    </button>
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
        <div className="space-y-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">battle summary</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {allGamePlayers.map((player) => (
              <div key={player.name} className="rounded border p-2 text-xs font-mono" style={INNER_PANEL_STYLE}>
                <div className="text-slate-300">{player.name}</div>
                <div className="mt-1 text-slate-500">
                  APM {player.apm} / EAPM {player.eapm} / EFF {player.effective.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeVizTab === "actions") {
      return (
        <div className="space-y-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">actions summary</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {allGamePlayers.map((player) => (
              <div key={player.name} className="rounded border p-2 text-xs font-mono" style={INNER_PANEL_STYLE}>
                <div className="text-slate-300">{player.name}</div>
                <div className="mt-1 text-slate-500">
                  APM {player.apm} / REDUNDANCY {player.redundancy}%
                </div>
              </div>
            ))}
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
        </div>
      </div>
    </div>
  );
}
