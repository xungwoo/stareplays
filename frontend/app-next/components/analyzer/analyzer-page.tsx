"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, User } from "lucide-react";

import { AnalyzerTabs, samePlayer, type LegacyTabId } from "@/components/analyzer/analyzer-tabs";
import { AnalyzerSummaryStrip } from "@/components/analyzer/analyzer-summary-strip";
import { RaceBadge } from "@/components/shared/race-badge";
import { ResultBadge, StatusBadge } from "@/components/shared/status-badge";
import { reanalyzeAnalyzerGame } from "@/lib/api/actions";
import { CYAN_PANEL_STYLE, INNER_PANEL_STRONG_STYLE } from "@/lib/constants/ui-styles";
import { getOrderedGamePlayers } from "@/lib/utils/analyzer-player-order";
import { getPlayerColor } from "@/lib/utils/player-colors";
import type { AnalyzerGameInsight, AnalyzerPageModel } from "@/types/analyzer";

const CARD_STYLE = CYAN_PANEL_STYLE;

function PlayerDeepDive({
  game,
  insight,
  focusedPlayer,
  onSelect
}: {
  game: AnalyzerPageModel["selectedGame"];
  insight: AnalyzerGameInsight;
  focusedPlayer: string | null;
  onSelect: (name: string | null) => void;
}) {
  const allPlayers = getOrderedGamePlayers(game);
  const focused = allPlayers.find((player) => samePlayer(player.name, focusedPlayer));
  const focusedTechEvents = focused
    ? insight.timeline.filter((event) => samePlayer(event.player, focused.name) && (event.type === "UPGRADE" || event.type === "BUILDING"))
    : [];

  return (
    <div className="flex h-full flex-col gap-4 rounded-xl p-4" style={CARD_STYLE}>
      <p className="text-[10px] font-mono tracking-widest text-slate-500">PLAYER DEEP DIVE</p>

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-all"
          style={{
            backgroundColor: !focusedPlayer ? "rgba(34,211,238,0.1)" : "#0a1428",
            border: `1px solid ${!focusedPlayer ? "rgba(34,211,238,0.3)" : "rgba(255,255,255,0.05)"}`
          }}
        >
          <User className="h-3 w-3 text-cyan-400" />
          <span className="text-[10px] font-mono text-slate-300">ALL PLAYERS</span>
        </button>

        {allPlayers.map((player) => (
          <button
            key={player.name}
            type="button"
            onClick={() => onSelect(focusedPlayer === player.name ? null : player.name)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-all"
            style={{
              backgroundColor: focusedPlayer === player.name ? "rgba(34,211,238,0.08)" : "#0a1428",
              border: `1px solid ${focusedPlayer === player.name ? "rgba(34,211,238,0.2)" : "rgba(255,255,255,0.05)"}`
            }}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getPlayerColor(player.name) }} />
            <RaceBadge race={player.race} />
            <span className="flex-1 text-[11px] font-mono text-slate-300">{player.name}</span>
            {player.isCurrentUser ? <span className="text-[9px] font-mono text-cyan-500">YOU</span> : null}
            <ResultBadge result={game.winnerTeam.some((candidate) => candidate.name === player.name) ? "WINNER" : "LOSER"} />
          </button>
        ))}
      </div>

      {focused ? (
        <div className="space-y-2 rounded-lg p-3" style={INNER_PANEL_STRONG_STYLE}>
          <div className="mb-3 flex items-center gap-2">
            <RaceBadge race={focused.race} size="md" />
            <span className="text-sm font-mono font-bold" style={{ color: getPlayerColor(focused.name) }}>
              {focused.name}
            </span>
            <ResultBadge result={game.winnerTeam.some((candidate) => candidate.name === focused.name) ? "WINNER" : "LOSER"} size="md" />
          </div>

          {[
            ["APM", focused.apm],
            ["EAPM", focused.eapm],
            ["CMD", focused.cmd.toLocaleString()],
            ["ECMD", focused.ecmd.toLocaleString()],
            ["SPEND", `${focused.cmd.toLocaleString()} / ${focused.ecmd.toLocaleString()}`],
            ["EFFECTIVE", `${focused.effective.toFixed(1)}%`],
            ["REDUNDANCY", `${focused.redundancy}%`],
            ["PRODUCTION", focused.production],
            ["TECH", focusedTechEvents.length]
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between text-xs font-mono">
              <span className="text-slate-500">{label}</span>
              <span className="font-semibold text-slate-200">{value}</span>
            </div>
          ))}

          <div className="border-t border-white/5 pt-2">
            <p className="mb-1 text-[10px] font-mono tracking-widest text-slate-500">PLAYER READ</p>
            <p className="text-[11px] font-mono leading-relaxed text-slate-400">
              {focused.name} shows the shared player focus state used across timeline, APM, economy, production, tech, and combat views.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 rounded-lg p-3" style={INNER_PANEL_STRONG_STYLE}>
          <p className="mb-2 text-[11px] font-mono text-slate-200">All Players</p>
          <p className="text-[10px] font-mono text-slate-500">No player selected. Click any player id in the 3x3 board, timeline, or tables to focus that player. Click the same player again to clear selection.</p>
          {game.keyPlayer ? (
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-500">Key Player</span>
              <span style={{ color: "#34d399" }}>{game.keyPlayer}</span>
            </div>
          ) : null}
          {game.worstPlayer ? (
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-500">Worst Impact</span>
              <span style={{ color: "#f87171" }}>{game.worstPlayer}</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function AnalyzerPage({ model }: { model: AnalyzerPageModel }) {
  const routeSelectedGameId = model.selectedGameId ?? model.selectedGame.id;
  const [selectedGameId, setSelectedGameId] = useState(routeSelectedGameId);
  const [activeTab, setActiveTab] = useState<LegacyTabId>("match-flow");
  const [focusedPlayer, setFocusedPlayer] = useState<string | null>(null);
  const [apmHiddenPlayers, setApmHiddenPlayers] = useState<Record<string, boolean>>({});
  const [selectorPage, setSelectorPage] = useState(0);
  const [reanalyzeState, setReanalyzeState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [reanalyzeMessage, setReanalyzeMessage] = useState<string | null>(null);
  const [statusRefreshState, setStatusRefreshState] = useState<"idle" | "loading" | "error">("idle");
  const [statusRefreshMessage, setStatusRefreshMessage] = useState<string | null>(null);
  const [statusOverride, setStatusOverride] = useState<string | null>(null);
  const reanalyzeRequestIdRef = useRef(0);
  const pageSize = 10;

  useEffect(() => {
    setSelectedGameId(routeSelectedGameId);

    const selectedIndex = model.games.findIndex((game) => game.id === routeSelectedGameId);
    if (selectedIndex >= 0) {
      setSelectorPage(Math.floor(selectedIndex / pageSize));
    }
  }, [model.games, routeSelectedGameId]);

  const selectedGame = model.games.find((game) => game.id === selectedGameId) ?? model.selectedGame;
  const selectedInsight = model.insightsByGameId[selectedGame.id] ?? {
    players: model.players,
    timeline: model.timeline,
    comparison: model.comparison,
    apmSeries: model.apmSeries,
    resourceSeries: model.resourceSeries,
    unitProductionSeries: model.unitProductionSeries,
    keyPlayer: selectedGame.keyPlayer,
    worstPlayer: selectedGame.worstPlayer
  };

  const selectorPages = Math.max(1, Math.ceil(model.games.length / pageSize));
  const selectorGames = useMemo(() => model.games.slice(selectorPage * pageSize, selectorPage * pageSize + pageSize), [model.games, selectorPage]);
  const refreshHref = `/analyzer?currentUser=${encodeURIComponent(model.currentUser)}&gameId=${selectedGame.id}`;

  useEffect(() => {
    reanalyzeRequestIdRef.current += 1;
    setReanalyzeState("idle");
    setReanalyzeMessage(null);
    setStatusRefreshState("idle");
    setStatusRefreshMessage(null);
    setStatusOverride(null);
    setApmHiddenPlayers({});
  }, [selectedGameId]);

  useEffect(() => {
    if (!focusedPlayer) {
      return;
    }

    const players = getOrderedGamePlayers(selectedGame);
    if (!players.some((player) => samePlayer(player.name, focusedPlayer))) {
      setFocusedPlayer(null);
    }
  }, [focusedPlayer, selectedGame]);

  function handleSelectPlayer(name: string | null) {
    const nextName = name?.trim() || null;
    const shouldClear = !nextName || samePlayer(focusedPlayer, nextName);
    const value = shouldClear ? null : nextName;
    setFocusedPlayer(value);

    if (!value) {
      setApmHiddenPlayers({});
    }
  }

  function handleToggleApmPlayer(name: string) {
    const key = name.trim().toLowerCase();
    setApmHiddenPlayers((current) => ({
      ...current,
      [key]: !current[key]
    }));
  }

  async function handleReanalyzeSelectedGame() {
    if (reanalyzeState === "submitting") {
      return;
    }

    const requestGameId = selectedGame.id;
    const requestId = reanalyzeRequestIdRef.current + 1;
    reanalyzeRequestIdRef.current = requestId;
    setReanalyzeState("submitting");
    setReanalyzeMessage(null);

    try {
      const response = await reanalyzeAnalyzerGame(requestGameId, { fetchImpl: fetch });

      if (reanalyzeRequestIdRef.current !== requestId) {
        return;
      }

      const message = response?.message?.trim() || `reanalyze queued for game #${requestGameId}`;
      setReanalyzeMessage(message);
      setReanalyzeState("success");
    } catch (error) {
      if (reanalyzeRequestIdRef.current !== requestId) {
        return;
      }

      setReanalyzeMessage(error instanceof Error ? error.message : "reanalyze failed");
      setReanalyzeState("error");
    }
  }

  async function handleRefreshAnalyzerStatus() {
    setStatusRefreshState("loading");
    setStatusRefreshMessage("REFRESHING_ANALYZER_STATUS...");

    try {
      const response = await fetch(`/api/v1/games/${selectedGame.id}/analyzer`, {
        headers: {
          accept: "application/json"
        },
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`status refresh failed for game #${selectedGame.id}`);
      }

      const payload = (await response.json()) as { status?: string };
      setStatusRefreshState("idle");
      setStatusRefreshMessage(null);
      const refreshedStatus = payload.status?.trim();
      if (refreshedStatus) {
        setStatusOverride(refreshedStatus.toUpperCase());
      }
    } catch (error) {
      setStatusRefreshState("error");
      setStatusRefreshMessage(error instanceof Error ? `ERROR_REFRESH_ANALYZER_STATUS: ${error.message}` : "ERROR_REFRESH_ANALYZER_STATUS");
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-6">
      <div className="rounded-xl px-5 py-4" style={CARD_STYLE}>
        <div className="flex items-center gap-3">
          <h1 className="text-base font-mono font-bold text-slate-200">한 게임의 흐름과 플레이어별 분석을 함께 보는 상세 분석 화면</h1>
          <span className="rounded px-2 py-1 text-[10px] font-mono font-bold" style={{ backgroundColor: "rgba(34,211,238,0.08)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.18)" }}>
            CURRENT_USER: {model.currentUser}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">경기 선택, 요약 확인, 플레이어 전환, 타임라인 워크스페이스와 이벤트 인스펙터를 한 화면에서 이어갑니다.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="overflow-hidden rounded-xl lg:col-span-2" style={CARD_STYLE}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[10px] font-mono tracking-widest text-slate-500">GAME SELECTOR</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleReanalyzeSelectedGame();
                }}
                disabled={reanalyzeState === "submitting"}
                className="rounded px-3 py-1.5 text-[10px] font-mono font-bold tracking-widest text-cyan-200 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.18)" }}
              >
                {reanalyzeState === "submitting" ? "REANALYZING..." : "REANALYZE SELECTED GAME"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleRefreshAnalyzerStatus();
                }}
                className="rounded px-3 py-1.5 text-[10px] font-mono font-bold tracking-widest text-slate-300 transition-all"
                style={{ backgroundColor: "#0a1428", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                REFRESH ANALYZER STATUS
              </button>
              <Link
                href={refreshHref}
                aria-label="Refresh selected game"
                className="flex items-center gap-1 text-slate-500 hover:text-slate-300"
              >
                <RefreshCw className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {reanalyzeMessage ? (
            <div
              className="flex items-center gap-2 px-4 py-2"
              style={{
                backgroundColor: reanalyzeState === "error" ? "rgba(239,68,68,0.05)" : "rgba(16,185,129,0.05)",
                borderBottom: "1px solid rgba(255,255,255,0.05)"
              }}
              aria-live="polite"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: reanalyzeState === "error" ? "#f87171" : "#34d399" }}
                aria-hidden="true"
              />
              <p className={`text-[11px] font-mono ${reanalyzeState === "error" ? "text-red-300" : "text-emerald-300"}`}>
                {reanalyzeState === "error" ? "REANALYZE FAILED:" : "REANALYZE QUEUED:"} {reanalyzeMessage}
              </p>
            </div>
          ) : null}

          <div className="max-h-[340px] overflow-y-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", backgroundColor: "#081428" }}>
                  {["ID", "MAP", "TYPE", "ANALYZER", "TIME", "START"].map((header) => (
                    <th key={header} className="px-3 py-2 text-left text-[10px] tracking-widest text-slate-600">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectorGames.map((game) => (
                  <tr
                    key={game.id}
                    onClick={() => {
                      setSelectedGameId(game.id);
                    }}
                    className="cursor-pointer transition-all"
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      backgroundColor: selectedGameId === game.id ? "rgba(34,211,238,0.07)" : "transparent"
                    }}
                  >
                    <td className="px-3 py-2.5 text-slate-500">#{game.id}</td>
                    <td className="max-w-[100px] truncate px-3 py-2.5 text-slate-300">{game.map.slice(0, 12)}…</td>
                    <td className="px-3 py-2.5 text-slate-400">{game.matchup}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={game.analyzerStatus} />
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">{game.playTime}</td>
                    <td className="px-3 py-2.5 text-[10px] text-slate-500">{game.startTime.split(" ")[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <button
              type="button"
              onClick={() => setSelectorPage((page) => Math.max(0, page - 1))}
              disabled={selectorPage === 0}
              className="rounded px-3 py-1 text-[10px] font-mono text-slate-500 hover:text-slate-300 disabled:opacity-30"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}
            >
              Prev
            </button>
            <span className="text-[10px] font-mono text-slate-600">
              PAGE {selectorPage + 1}/{selectorPages}
            </span>
            <button
              type="button"
              onClick={() => setSelectorPage((page) => Math.min(selectorPages - 1, page + 1))}
              disabled={selectorPage === selectorPages - 1}
              className="rounded px-3 py-1 text-[10px] font-mono text-slate-500 hover:text-slate-300 disabled:opacity-30"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}
            >
              Next
            </button>
          </div>
        </div>

        <AnalyzerSummaryStrip game={selectedGame} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
        <AnalyzerTabs
          activeTab={activeTab}
          game={selectedGame}
          focusedPlayer={focusedPlayer}
          hiddenApmPlayers={apmHiddenPlayers}
          insight={selectedInsight}
          matchFlowResetKey={`${selectedGame.id}-${activeTab}`}
          onActiveTabChange={setActiveTab}
          onSelectPlayer={handleSelectPlayer}
          onToggleApmPlayer={handleToggleApmPlayer}
        />

        <div className="xl:col-span-1">
          <PlayerDeepDive game={selectedGame} insight={selectedInsight} focusedPlayer={focusedPlayer} onSelect={handleSelectPlayer} />
        </div>
      </div>

      <div className="rounded-lg px-4 py-2.5" style={INNER_PANEL_STRONG_STYLE}>
        <p className="text-[10px] font-mono text-slate-500">
          REPLAY_ANALYZER_STATUS: <span className="text-cyan-400">{statusOverride ?? selectedGame.analyzerStatus}</span> | {selectedGame.matchStory}
        </p>
        {statusRefreshMessage ? (
          <p className={`mt-2 text-[10px] font-mono ${statusRefreshState === "error" ? "text-red-300" : "text-slate-400"}`}>{statusRefreshMessage}</p>
        ) : null}
      </div>
    </div>
  );
}
