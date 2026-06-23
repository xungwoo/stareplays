"use client";

import { RaceBadge } from "@/components/shared/race-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { displayPlayerName } from "@/lib/utils/player-display";
import type { VaultGame, VaultPlayer } from "@/types/vault";

type VaultResultBadge = "WINNER" | "LOSER" | "DRAW" | "INVALID";

const RESULT_BADGE_STYLES: Record<VaultResultBadge, { backgroundColor: string; color: string; border: string }> = {
  WINNER: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    color: "#6ee7b7",
    border: "1px solid rgba(16, 185, 129, 0.4)"
  },
  LOSER: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    color: "#fca5a5",
    border: "1px solid rgba(239, 68, 68, 0.4)"
  },
  DRAW: {
    backgroundColor: "rgba(148, 163, 184, 0.2)",
    color: "#cbd5e1",
    border: "1px solid rgba(148, 163, 184, 0.35)"
  },
  INVALID: {
    backgroundColor: "rgba(100, 116, 139, 0.2)",
    color: "#94a3b8",
    border: "1px solid rgba(100, 116, 139, 0.4)"
  }
};

function teamResultBadge(result: VaultResultBadge) {
  return (
    <span
      className="inline-flex items-center rounded font-bold font-mono tracking-wide uppercase text-[10px] px-1.5 py-0.5"
      style={RESULT_BADGE_STYLES[result]}
    >
      {result}
    </span>
  );
}

function parsePlayTimeSeconds(playTime: string) {
  const [minutesPart = "0", secondsPart = "0"] = playTime.trim().split(":");
  const minutes = Number(minutesPart);
  const seconds = Number(secondsPart);

  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }

  return Math.max(0, minutes) * 60 + Math.max(0, seconds);
}

function isLegacyInvalidGame(game: VaultGame) {
  const playTimeSeconds = parsePlayTimeSeconds(game.playTime);
  return playTimeSeconds != null && playTimeSeconds > 0 && playTimeSeconds <= 120;
}

function resolveTeamSemantics(game: VaultGame) {
  if (isLegacyInvalidGame(game)) {
    return {
      ourTeam: game.winnerTeam,
      enemyTeam: game.loserTeam,
      ourResult: "INVALID" as const,
      enemyResult: "INVALID" as const
    };
  }

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
  result,
  players
}: {
  result: VaultResultBadge;
  players: VaultPlayer[];
}) {
  return (
    <div className="flex flex-col gap-1">
      {teamResultBadge(result)}
      {players.map((player) => (
        <div key={player.name} className="flex items-center gap-1 text-[11px] font-mono">
          <RaceBadge race={player.race} />
          <span className={player.isCurrentUser ? "text-cyan-300" : "text-slate-400"} title={player.name}>{displayPlayerName(player.name)}</span>
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
  onToggle,
  rowRef
}: {
  game: VaultGame;
  isExpanded: boolean;
  onToggle: () => void;
  rowRef?: (node: HTMLTableRowElement | null) => void;
}) {
  const { ourTeam, enemyTeam, ourResult, enemyResult } = resolveTeamSemantics(game);

  return (
    <tr
      ref={rowRef}
      data-game-id={game.id}
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
        <TeamCell result={ourResult} players={ourTeam} />
      </td>
      <td className="px-4 py-3 align-top">
        <TeamCell result={enemyResult} players={enemyTeam} />
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
        <span className="text-xs font-mono text-slate-500">{game.startTime}</span>
      </td>
    </tr>
  );
}
