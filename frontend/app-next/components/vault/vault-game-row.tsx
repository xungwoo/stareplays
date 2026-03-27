"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

import { RaceBadge } from "@/components/shared/race-badge";
import { ResultBadge, StatusBadge } from "@/components/shared/status-badge";
import type { VaultGame } from "@/types/vault";

export function VaultGameRow({
  game,
  isExpanded,
  onToggle
}: {
  game: VaultGame;
  isExpanded: boolean;
  onToggle: () => void;
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
