"use client";

import { User } from "lucide-react";

import { RaceBadge } from "@/components/shared/race-badge";
import { ResultBadge } from "@/components/shared/status-badge";
import { CYAN_PANEL_STYLE, INNER_PANEL_STRONG_STYLE } from "@/lib/constants/ui-styles";
import { getOrderedGamePlayers } from "@/lib/utils/analyzer-player-order";
import { getPlayerColor } from "@/lib/utils/player-colors";
import type { AnalyzerGameInsight, AnalyzerPageModel } from "@/types/analyzer";

import { samePlayer } from "./analyzer-tabs";

const CARD_STYLE = CYAN_PANEL_STYLE;

export function AnalyzerPlayerDeepDive({
  game,
  insight,
  focusedPlayer,
  onClearSelection,
  onSelectPlayer
}: {
  game: AnalyzerPageModel["selectedGame"];
  insight: AnalyzerGameInsight;
  focusedPlayer: string | null;
  onClearSelection: () => void;
  onSelectPlayer: (name: string) => void;
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
          onClick={onClearSelection}
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
            onClick={() => onSelectPlayer(player.name)}
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
