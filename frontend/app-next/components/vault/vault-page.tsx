"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, RefreshCw } from "lucide-react";
import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { generateApmSeries } from "@/lib/fixtures/analyzer";
import { RaceBadge } from "@/components/shared/race-badge";
import { ResultBadge, StatusBadge } from "@/components/shared/status-badge";
import { getStartGridBoard } from "@/lib/utils/start-grid-board";
import type { VaultGame, VaultPlayer, VaultPageModel } from "@/types/vault";

const CARD_STYLE = { backgroundColor: "#0d1833", border: "1px solid rgba(34,211,238,0.1)" };
const PLAYER_COLORS: Record<string, string> = {
  "3x3_GG": "#22d3ee",
  "3x3_mh": "#f59e0b",
  "3x3_smwoo": "#34d399",
  "3x3_Kiyong": "#f87171",
  "3x3_pil": "#a78bfa",
  "3x3_syntax": "#fb923c"
};

function PlayerBoardCard({ player, result }: { player: VaultPlayer; result: "WINNER" | "LOSER" }) {
  const isWinner = result === "WINNER";

  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg p-3 transition-all"
      style={{
        backgroundColor: isWinner ? "rgba(16,185,129,0.04)" : "rgba(239,68,68,0.04)",
        border: `1px solid ${isWinner ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}`
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

function GameDetailExpand({ game }: { game: VaultGame }) {
  const apmData = useMemo(() => generateApmSeries(Number.parseInt(game.playTime.split(":")[0] ?? "0", 10) + 1), [game.playTime]);
  const allPlayers = [...game.winnerTeam, ...game.loserTeam].map((player) => player.name);
  const board = useMemo(() => getStartGridBoard(game), [game]);

  return (
    <div className="mt-2 rounded-xl p-5" style={{ backgroundColor: "#080e1f", border: "1px solid rgba(34,211,238,0.12)" }}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400">#{game.id}</span>
          <span className="text-sm font-mono font-semibold text-slate-200">{game.map}</span>
          <span className="text-xs font-mono text-slate-500">{game.startTime}</span>
        </div>

        <Link
          href="/analyzer"
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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div>
          <p className="mb-3 text-[10px] font-mono tracking-widest text-slate-500">SELECTED_GAME</p>

          <div className="my-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px_minmax(0,1fr)]">
            <div data-testid="vault-start-grid-left" className="flex flex-col gap-2">
              {board.leftColumn.map((entry) => (
                <PlayerBoardCard key={entry.player.name} player={entry.player} result={entry.result} />
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
                <PlayerBoardCard key={entry.player.name} player={entry.player} result={entry.result} />
              ))}
            </div>
          </div>

          {game.matchStory ? (
            <div
              className="mt-3 rounded-lg p-3"
              style={{ backgroundColor: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.1)" }}
            >
              <p className="mb-1 text-[10px] font-mono tracking-widest text-cyan-500">MATCH STORY</p>
              <p className="text-xs leading-relaxed text-slate-300">{game.matchStory}</p>
            </div>
          ) : null}
        </div>

        <div>
          <p className="mb-3 text-[10px] font-mono tracking-widest text-slate-500">APM TIMELINE</p>
          <div className="rounded-lg p-3" style={{ backgroundColor: "#0a1428", border: "1px solid rgba(255,255,255,0.05)" }}>
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
                  <Line key={name} type="monotone" dataKey={name} stroke={PLAYER_COLORS[name] || "#888"} dot={false} strokeWidth={1.5} />
                ))}
                <Legend
                  wrapperStyle={{ fontSize: 10, fontFamily: "JetBrains Mono", paddingTop: 8 }}
                  formatter={(value) => <span style={{ color: PLAYER_COLORS[String(value)] || "#888" }}>{String(value)}</span>}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function GameRow({ game, isExpanded, onToggle }: { game: VaultGame; isExpanded: boolean; onToggle: () => void }) {
  const isCurrentUserWinner = game.winnerTeam.some((player) => player.isCurrentUser);
  const primaryTeam = isCurrentUserWinner ? game.winnerTeam : game.loserTeam;
  const secondaryTeam = isCurrentUserWinner ? game.loserTeam : game.winnerTeam;

  return (
    <div className="border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
      <div
        className="grid cursor-pointer items-center gap-4 px-4 py-3 transition-all duration-200 hover:bg-slate-800/30"
        style={{ gridTemplateColumns: "50px 1fr 80px 2fr 2fr 100px 80px 1fr" }}
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

      {isExpanded ? (
        <div className="px-4 pb-4">
          <GameDetailExpand game={game} />
        </div>
      ) : null}
    </div>
  );
}

export function VaultPage({ model }: { model: VaultPageModel }) {
  const [expandedId, setExpandedId] = useState<number | null>(48);
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(model.games.length / pageSize));
  const pageGames = model.games.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-5 rounded-sm" style={{ backgroundColor: "#22d3ee" }} />
          <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-slate-200">Recent Games</h2>
        </div>

        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 transition-all hover:text-slate-200"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <RefreshCw className="h-3 w-3" />
          REFRESH
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={CARD_STYLE}>
        <div
          className="grid items-center gap-4 px-4 py-2.5"
          style={{
            gridTemplateColumns: "50px 1fr 80px 2fr 2fr 100px 80px 1fr",
            backgroundColor: "#081428",
            borderBottom: "1px solid rgba(34,211,238,0.1)"
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
            isExpanded={expandedId === game.id}
            onToggle={() => setExpandedId(expandedId === game.id ? null : game.id)}
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
    </div>
  );
}
