"use client";

import { RaceBadge } from "@/components/shared/race-badge";
import { ResultBadge } from "@/components/shared/status-badge";
import { CYAN_PANEL_STYLE, INNER_PANEL_STRONG_STYLE } from "@/lib/constants/ui-styles";
import { displayPlayerName } from "@/lib/utils/player-display";
import { getStartGridBoard } from "@/lib/utils/start-grid-board";
import type { AnalyzerPageModel } from "@/types/analyzer";

const CARD_STYLE = CYAN_PANEL_STYLE;

function SummaryStripPlayer({
  name,
  race,
  result,
  isCurrentUser
}: {
  name: string;
  race: "P" | "T" | "Z";
  result: "WINNER" | "LOSER";
  isCurrentUser?: boolean;
}) {
  const isWinner = result === "WINNER";

  return (
    <div
      className="flex items-center justify-between rounded-xl px-4 py-3"
      style={{
        backgroundColor: isWinner ? "rgba(16,185,129,0.05)" : "rgba(239,68,68,0.05)",
        border: `1px solid ${isWinner ? "rgba(16,185,129,0.14)" : "rgba(239,68,68,0.14)"}`
      }}
    >
      <div className="flex items-center gap-2">
        <RaceBadge race={race} size="md" />
        <span data-testid="start-grid-player-name" className="text-sm font-mono font-semibold text-slate-200">
          {displayPlayerName(name)}
        </span>
        {isCurrentUser ? <span className="text-[10px] font-mono text-cyan-400">[YOU]</span> : null}
      </div>
      <ResultBadge result={result} />
    </div>
  );
}

export function AnalyzerSummaryStrip({ game }: { game: AnalyzerPageModel["selectedGame"] }) {
  const startGridBoard = getStartGridBoard(game);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl lg:col-span-3" style={CARD_STYLE}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-[10px] font-mono tracking-widest text-slate-500">GAME SUMMARY STRIP</p>
      </div>

      <div className="grid grid-cols-3 gap-px" style={{ backgroundColor: "rgba(226,232,240,0.08)" }}>
        {[
          { label: "MAP", value: game.map },
          { label: "PLAY TIME", value: game.playTime },
          { label: "START", value: game.startTime }
        ].map(({ label, value }) => (
          <div key={label} className="px-4 py-2.5" style={INNER_PANEL_STRONG_STYLE}>
            <p className="text-[10px] font-mono text-slate-600">{label}:</p>
            <p className="text-xs font-mono text-slate-300">{value}</p>
          </div>
        ))}
      </div>

      <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <p className="mb-1 text-[10px] font-mono text-cyan-500">MATCH_STORY:</p>
        <p className="text-xs leading-relaxed text-slate-300">{game.matchStory}</p>
      </div>

      <div className="grid flex-1 gap-3 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_260px_minmax(0,1fr)]">
        <div data-testid="analyzer-start-grid-left" className="flex flex-col gap-3">
          {startGridBoard.leftColumn.map((entry) => (
            <SummaryStripPlayer key={entry.player.name} name={entry.player.name} race={entry.player.race} result={entry.result} isCurrentUser={entry.player.isCurrentUser} />
          ))}
        </div>

        <div
          className="flex flex-col items-center justify-center gap-2 rounded-xl px-4 py-5 text-center"
          style={{ background: "radial-gradient(circle at center, rgba(255,255,255,0.08), rgba(255,255,255,0.02))", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span className="text-4xl font-mono font-bold text-slate-300">{game.matchup}</span>
          <div className="flex items-center gap-1.5">
            {startGridBoard.leftColumn.map((entry) => (
              <RaceBadge key={`summary-left-${entry.player.name}`} race={entry.player.race} size="md" />
            ))}
            <span className="mx-1 text-xs font-mono text-slate-600">vs</span>
            {startGridBoard.rightColumn.map((entry) => (
              <RaceBadge key={`summary-right-${entry.player.name}`} race={entry.player.race} size="md" />
            ))}
          </div>
          <span className="text-xs font-mono text-slate-500">PLAY TIME</span>
          <span className="text-xl font-mono font-bold" style={{ color: "#22d3ee" }}>
            {game.playTime}
          </span>
        </div>

        <div data-testid="analyzer-start-grid-right" className="flex flex-col gap-3">
          {startGridBoard.rightColumn.map((entry) => (
            <SummaryStripPlayer key={entry.player.name} name={entry.player.name} race={entry.player.race} result={entry.result} isCurrentUser={entry.player.isCurrentUser} />
          ))}
        </div>
      </div>
    </div>
  );
}
