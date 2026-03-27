"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

import { RaceBadge } from "@/components/shared/race-badge";
import { ResultBadge, StatusBadge } from "@/components/shared/status-badge";
import type { VaultGame, VaultPlayer } from "@/types/vault";

function resolveTeamSemantics(game: VaultGame) {
  const winnerHasCurrentUser = game.winnerTeam.some((player) => player.isCurrentUser);
  const loserHasCurrentUser = game.loserTeam.some((player) => player.isCurrentUser);

  if (winnerHasCurrentUser && !loserHasCurrentUser) {
    return {
      ourTeam: game.winnerTeam,
      enemyTeam: game.loserTeam,
      ourResult: "WINNER" as const,
      enemyResult: "LOSER" as const
    };
  }

  if (loserHasCurrentUser && !winnerHasCurrentUser) {
    return {
      ourTeam: game.loserTeam,
      enemyTeam: game.winnerTeam,
      ourResult: "LOSER" as const,
      enemyResult: "WINNER" as const
    };
  }

  return {
    ourTeam: game.winnerTeam,
    enemyTeam: game.loserTeam,
    ourResult: "WINNER" as const,
    enemyResult: "LOSER" as const
  };
}

function TeamCell({
  label,
  result,
  players
}: {
  label: "OUR_TEAM" | "ENEMY_TEAM";
  result: "WINNER" | "LOSER";
  players: VaultPlayer[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-mono tracking-widest text-slate-500">{label}</p>
      <ResultBadge result={result} size="sm" />
      {players.map((player) => (
        <div key={player.name} className="flex items-center gap-1 text-[11px] font-mono">
          <RaceBadge race={player.race} />
          <span className={player.isCurrentUser ? "text-cyan-300" : "text-slate-400"}>{player.name}</span>
          {player.isCurrentUser ? <span className="text-[9px] text-cyan-500">YOU</span> : null}
          <span className="ml-auto text-slate-600">
            A:{player.apm} E:{player.eapm}
          </span>
        </div>
      ))}
    </div>
  );
}

export function VaultGameRow({
  game,
  isExpanded,
  onToggle
}: {
  game: VaultGame;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { ourTeam, enemyTeam, ourResult, enemyResult } = resolveTeamSemantics(game);

  return (
    <tr
      data-testid={`vault-game-row-${game.id}`}
      className="border-b transition-colors hover:bg-slate-800/30"
      style={{
        borderColor: "rgba(255,255,255,0.05)",
        backgroundColor: isExpanded ? "rgba(34,211,238,0.06)" : "transparent"
      }}
      onClick={onToggle}
    >
      <td className="px-4 py-3 align-top text-slate-500">
        <span className="text-xs font-mono text-slate-500">#{game.id}</span>
      </td>
      <td className="px-4 py-3 align-top">
        <span className="truncate text-xs font-mono text-slate-300">{game.map}</span>
      </td>
      <td className="px-4 py-3 align-top text-slate-400">
        <span className="text-xs font-mono">{game.matchup}</span>
      </td>
      <td className="px-4 py-3 align-top">
        <TeamCell label="OUR_TEAM" result={ourResult} players={ourTeam} />
      </td>
      <td className="px-4 py-3 align-top">
        <TeamCell label="ENEMY_TEAM" result={enemyResult} players={enemyTeam} />
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex justify-center">
          <StatusBadge status={game.analyzerStatus} />
        </div>
      </td>
      <td className="px-4 py-3 align-top text-center text-slate-400">
        <span className="text-xs font-mono">{game.playTime}</span>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-mono text-slate-500">{game.startTime}</span>
          {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-600" /> : <ChevronDown className="h-4 w-4 text-slate-600" />}
        </div>
      </td>
    </tr>
  );
}
