"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, LineChart, Line } from "recharts";
import { ChevronLeft, ChevronRight, RefreshCw, User } from "lucide-react";

import { RaceBadge } from "@/components/shared/race-badge";
import { ResultBadge, StatusBadge } from "@/components/shared/status-badge";
import { getOrderedGamePlayers } from "@/lib/utils/analyzer-player-order";
import { getStartGridBoard } from "@/lib/utils/start-grid-board";
import type { AnalyzerGameInsight, AnalyzerPageModel, TimelineEvent } from "@/types/analyzer";

const CARD_STYLE = { backgroundColor: "#0d1833", border: "1px solid rgba(34,211,238,0.1)" };
const PLAYER_COLORS: Record<string, string> = {
  "3x3_GG": "#22d3ee",
  "3x3_mh": "#f59e0b",
  "3x3_smwoo": "#34d399",
  "3x3_Kiyong": "#f87171",
  "3x3_pil": "#a78bfa",
  "3x3_syntax": "#fb923c"
};

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
    <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: isWinner ? "rgba(16,185,129,0.05)" : "rgba(239,68,68,0.05)", border: `1px solid ${isWinner ? "rgba(16,185,129,0.14)" : "rgba(239,68,68,0.14)"}` }}>
      <div className="flex items-center gap-2">
        <RaceBadge race={race} size="md" />
        <span data-testid="start-grid-player-name" className="text-sm font-mono font-semibold text-slate-200">
          {name}
        </span>
        {isCurrentUser ? <span className="text-[10px] font-mono text-cyan-400">[YOU]</span> : null}
      </div>
      <ResultBadge result={result} />
    </div>
  );
}

function ComparisonBar({
  label,
  loser,
  winner,
  maxVal,
  formatValue
}: {
  label: string;
  loser: number;
  winner: number;
  maxVal: number;
  formatValue?: (value: number) => string;
}) {
  const formatter = formatValue ?? ((value: number) => String(value));

  return (
    <div className="mb-4">
      <p className="mb-2 text-[10px] font-mono tracking-widest text-slate-500">{label}</p>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="w-12 text-right text-[10px] font-mono text-red-400">LOSER</span>
          <div className="relative h-5 flex-1 overflow-hidden rounded" style={{ backgroundColor: "#0a1428" }}>
            <div
              className="flex h-full items-center justify-end rounded pr-2"
              style={{ width: `${(loser / maxVal) * 100}%`, background: "linear-gradient(90deg, #7f1d1d, #ef4444)" }}
            >
              <span className="text-[10px] font-mono font-bold text-white">{formatter(loser)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-12 text-right text-[10px] font-mono text-emerald-400">WINNER</span>
          <div className="relative h-5 flex-1 overflow-hidden rounded" style={{ backgroundColor: "#0a1428" }}>
            <div
              className="flex h-full items-center justify-end rounded pr-2"
              style={{ width: `${(winner / maxVal) * 100}%`, background: "linear-gradient(90deg, #064e3b, #10b981)" }}
            >
              <span className="text-[10px] font-mono font-bold text-white">{formatter(winner)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchFlowTab({ insight }: { insight: AnalyzerGameInsight }) {
  const [eventPage, setEventPage] = useState(0);
  const pageSize = 12;
  const total = insight.timeline.length;
  const maxPages = Math.max(1, Math.ceil(total / pageSize));
  const pageEvents = insight.timeline.slice(eventPage * pageSize, eventPage * pageSize + pageSize);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-mono tracking-widest text-slate-500">KEY TIMELINE</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setEventPage((page) => Math.max(0, page - 1))} disabled={eventPage === 0} className="rounded p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30">
              <ChevronLeft className="h-3 w-3" />
            </button>
            <span className="text-[10px] font-mono text-slate-600">
              {eventPage * pageSize + 1}-{Math.min((eventPage + 1) * pageSize, total)} / {total}
            </span>
            <button
              type="button"
              onClick={() => setEventPage((page) => Math.min(maxPages - 1, page + 1))}
              disabled={eventPage === maxPages - 1}
              className="rounded p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          {pageEvents.map((event: TimelineEvent, index) => (
            <div
              key={`${event.time}-${event.player}-${index}`}
              className="flex items-center gap-2 rounded-lg px-3 py-2 transition-all"
              style={{
                backgroundColor: event.team === "WINNER" ? "rgba(16,185,129,0.04)" : "rgba(239,68,68,0.04)",
                border: `1px solid ${event.team === "WINNER" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)"}`
              }}
            >
              <span
                className="min-w-[42px] rounded px-1.5 py-0.5 text-center text-[10px] font-mono font-bold text-slate-400"
                style={{ backgroundColor: "#0a1428", color: "#94a3b8" }}
              >
                {event.time}
              </span>
              <span className="flex-1 truncate text-xs font-mono text-slate-200">{event.event}</span>
              <span className="text-[10px] font-mono text-slate-500">{event.player}</span>
              <span
                className="rounded px-1.5 py-0.5 text-[9px] font-mono font-bold"
                style={{
                  backgroundColor: event.type === "BUILDING" ? "rgba(96,165,250,0.15)" : "rgba(251,146,60,0.15)",
                  color: event.type === "BUILDING" ? "#93c5fd" : "#fdba74",
                  border: `1px solid ${event.type === "BUILDING" ? "rgba(96,165,250,0.3)" : "rgba(251,146,60,0.3)"}`
                }}
              >
                {event.type}
              </span>
              <ResultBadge result={event.team === "WINNER" ? "WINNER" : "LOSER"} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 text-[10px] font-mono tracking-widest text-slate-500">TEAM COMPARISON</p>
        <ComparisonBar label="KILLS" loser={insight.comparison.kills.loser} winner={insight.comparison.kills.winner} maxVal={Math.max(insight.comparison.kills.loser, insight.comparison.kills.winner, 1)} />
        <ComparisonBar label="WORKER PEAK" loser={insight.comparison.workerPeak.loser} winner={insight.comparison.workerPeak.winner} maxVal={Math.max(insight.comparison.workerPeak.loser, insight.comparison.workerPeak.winner, 1)} />
        <ComparisonBar
          label="TOTAL SPEND"
          loser={insight.comparison.totalSpend.loser}
          winner={insight.comparison.totalSpend.winner}
          maxVal={Math.max(insight.comparison.totalSpend.loser, insight.comparison.totalSpend.winner, 1)}
          formatValue={(value) => value.toLocaleString()}
        />
        <ComparisonBar label="TECH + UPGRADES" loser={insight.comparison.techUpg.loser} winner={insight.comparison.techUpg.winner} maxVal={Math.max(insight.comparison.techUpg.loser, insight.comparison.techUpg.winner, 1)} />
      </div>
    </div>
  );
}

function APMTab({ insight, game }: { insight: AnalyzerGameInsight; game: AnalyzerPageModel["selectedGame"] }) {
  const players = getOrderedGamePlayers(game).map((player) => player.name);

  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: "#0a1428", border: "1px solid rgba(255,255,255,0.05)" }}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={insight.apmSeries} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="time"
            tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono" }}
            tickLine={false}
            label={{ value: "min", position: "insideBottomRight", fill: "#475569", fontSize: 10 }}
          />
          <YAxis tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ backgroundColor: "#0d1833", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 8, fontSize: 11, fontFamily: "JetBrains Mono" }} labelStyle={{ color: "#94a3b8" }} />
          {players.map((name) => (
            <Line key={name} type="monotone" dataKey={name} stroke={PLAYER_COLORS[name] || "#888"} dot={false} strokeWidth={1.5} />
          ))}
          <Legend wrapperStyle={{ fontSize: 10, fontFamily: "JetBrains Mono" }} formatter={(value) => <span style={{ color: PLAYER_COLORS[String(value)] || "#888" }}>{String(value)}</span>} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ResourceTab({ insight }: { insight: AnalyzerGameInsight }) {
  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: "#0a1428", border: "1px solid rgba(255,255,255,0.05)" }}>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={insight.resourceSeries} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <defs>
            <linearGradient id="winnerGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="loserGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="time" tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono" }} tickLine={false} />
          <YAxis tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
          <Tooltip contentStyle={{ backgroundColor: "#0d1833", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 8, fontSize: 11, fontFamily: "JetBrains Mono" }} labelStyle={{ color: "#94a3b8" }} formatter={(value: number) => [value.toLocaleString(), ""]} />
          <Area type="monotone" dataKey="winner" name="WINNER" stroke="#10b981" strokeWidth={2} fill="url(#winnerGrad)" />
          <Area type="monotone" dataKey="loser" name="LOSER" stroke="#ef4444" strokeWidth={2} fill="url(#loserGrad)" />
          <Legend wrapperStyle={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function UnitProductionTab({ insight }: { insight: AnalyzerGameInsight }) {
  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: "#0a1428", border: "1px solid rgba(255,255,255,0.05)" }}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={insight.unitProductionSeries} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="time" tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono" }} tickLine={false} />
          <YAxis tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ backgroundColor: "#0d1833", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 8, fontSize: 11, fontFamily: "JetBrains Mono" }} labelStyle={{ color: "#94a3b8" }} />
          <Bar dataKey="winner" name="WINNER" fill="#10b981" radius={[2, 2, 0, 0]} opacity={0.8} />
          <Bar dataKey="loser" name="LOSER" fill="#ef4444" radius={[2, 2, 0, 0]} opacity={0.8} />
          <Legend wrapperStyle={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TechTab({ insight, game }: { insight: AnalyzerGameInsight; game: AnalyzerPageModel["selectedGame"] }) {
  const groupedEvents = insight.timeline
    .filter((event) => event.type === "UPGRADE" || event.type === "BUILDING")
    .reduce<Record<string, TimelineEvent[]>>((accumulator, event) => {
      accumulator[event.player] ??= [];
      accumulator[event.player].push(event);
      return accumulator;
    }, {});

  return (
    <div className="space-y-3">
      {Object.entries(groupedEvents).map(([player, events]) => (
        <div key={player}>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PLAYER_COLORS[player] || "#888" }} />
            <span className="text-xs font-mono font-semibold" style={{ color: PLAYER_COLORS[player] || "#888" }}>
              {player}
            </span>
            <ResultBadge result={game.winnerTeam.some((candidate) => candidate.name === player) ? "WINNER" : "LOSER"} />
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {events.map((event, index) => (
              <div
                key={`${player}-${event.time}-${index}`}
                className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-mono"
                style={{ backgroundColor: "#0a1428", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <span className="text-slate-500">{event.time}</span>
                <span className="text-slate-300">{event.event}</span>
                <span style={{ color: event.type === "UPGRADE" ? "#fdba74" : "#93c5fd" }}>{event.type}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

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
  const focused = allPlayers.find((player) => player.name === focusedPlayer);

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
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PLAYER_COLORS[player.name] || "#888" }} />
            <RaceBadge race={player.race} />
            <span className="flex-1 text-[11px] font-mono text-slate-300">{player.name}</span>
            {player.isCurrentUser ? <span className="text-[9px] font-mono text-cyan-500">YOU</span> : null}
            <ResultBadge result={game.winnerTeam.some((candidate) => candidate.name === player.name) ? "WINNER" : "LOSER"} />
          </button>
        ))}
      </div>

      {focused ? (
        <div className="space-y-2 rounded-lg p-3" style={{ backgroundColor: "#0a1428", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="mb-3 flex items-center gap-2">
            <RaceBadge race={focused.race} size="md" />
            <span className="text-sm font-mono font-bold" style={{ color: PLAYER_COLORS[focused.name] || "#22d3ee" }}>
              {focused.name}
            </span>
            <ResultBadge result={game.winnerTeam.some((candidate) => candidate.name === focused.name) ? "WINNER" : "LOSER"} size="md" />
          </div>

          {[
            ["APM", focused.apm],
            ["EAPM", focused.eapm],
            ["CMD", focused.cmd.toLocaleString()],
            ["ECMD", focused.ecmd.toLocaleString()],
            ["EFFECTIVE", `${focused.effective.toFixed(1)}%`],
            ["REDUNDANCY", `${focused.redundancy}%`],
            ["PRODUCTION", focused.production]
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between text-xs font-mono">
              <span className="text-slate-500">{label}</span>
              <span className="font-semibold text-slate-200">{value}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5 rounded-lg p-3" style={{ backgroundColor: "#0a1428", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="mb-2 text-[10px] font-mono text-slate-600">플레이어를 클릭하여 개인 통계를 확인하세요</p>
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
  const [selectedGameId, setSelectedGameId] = useState(model.selectedGame.id);
  const [activeTab, setActiveTab] = useState<"match_flow" | "apm" | "resource" | "unit_prod" | "tech">("match_flow");
  const [focusedPlayer, setFocusedPlayer] = useState<string | null>(null);
  const [selectorPage, setSelectorPage] = useState(0);

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

  const pageSize = 8;
  const selectorPages = Math.max(1, Math.ceil(model.games.length / pageSize));
  const selectorGames = useMemo(() => model.games.slice(selectorPage * pageSize, selectorPage * pageSize + pageSize), [model.games, selectorPage]);
  const startGridBoard = useMemo(() => getStartGridBoard(selectedGame), [selectedGame]);
  const refreshHref = `/analyzer?currentUser=${encodeURIComponent(model.currentUser)}&gameId=${selectedGame.id}`;

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
            <Link href={refreshHref} className="flex items-center gap-1 text-slate-500 hover:text-slate-300">
              <RefreshCw className="h-3 w-3" />
            </Link>
          </div>

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

        <div className="flex flex-col overflow-hidden rounded-xl lg:col-span-3" style={CARD_STYLE}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[10px] font-mono tracking-widest text-slate-500">GAME SUMMARY STRIP</p>
          </div>

          <div className="grid grid-cols-3 gap-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
            {[
              { label: "MAP", value: selectedGame.map },
              { label: "PLAY TIME", value: selectedGame.playTime },
              { label: "START", value: selectedGame.startTime }
            ].map(({ label, value }) => (
              <div key={label} className="px-4 py-2.5" style={{ backgroundColor: "#0d1833" }}>
                <p className="text-[10px] font-mono text-slate-600">{label}:</p>
                <p className="text-xs font-mono text-slate-300">{value}</p>
              </div>
            ))}
          </div>

          <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <p className="mb-1 text-[10px] font-mono text-cyan-500">MATCH_STORY:</p>
            <p className="text-xs leading-relaxed text-slate-300">{selectedGame.matchStory}</p>
          </div>

          <div className="grid flex-1 gap-3 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_260px_minmax(0,1fr)]">
            <div data-testid="analyzer-start-grid-left" className="flex flex-col gap-3">
              {startGridBoard.leftColumn.map((entry) => (
                <SummaryStripPlayer key={entry.player.name} name={entry.player.name} race={entry.player.race} result={entry.result} isCurrentUser={entry.player.isCurrentUser} />
              ))}
            </div>

            <div className="flex flex-col items-center justify-center gap-2 rounded-xl px-4 py-5 text-center" style={{ background: "radial-gradient(circle at center, rgba(255,255,255,0.08), rgba(255,255,255,0.02))", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="text-4xl font-mono font-bold text-slate-300">{selectedGame.matchup}</span>
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
                {selectedGame.playTime}
              </span>
            </div>

            <div data-testid="analyzer-start-grid-right" className="flex flex-col gap-3">
              {startGridBoard.rightColumn.map((entry) => (
                <SummaryStripPlayer key={entry.player.name} name={entry.player.name} race={entry.player.race} result={entry.result} isCurrentUser={entry.player.isCurrentUser} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
        <div className="overflow-hidden rounded-xl xl:col-span-3" style={CARD_STYLE}>
          <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="mb-3 text-[10px] font-mono tracking-widest text-slate-500">TIMELINE WORKSPACE</p>
            <div className="flex flex-wrap gap-1.5">
              {model.tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className="rounded px-3 py-1.5 text-[11px] font-mono font-semibold transition-all"
                  style={{
                    backgroundColor: activeTab === tab.id ? "rgba(34,211,238,0.15)" : "#0a1428",
                    color: activeTab === tab.id ? "#22d3ee" : "#64748b",
                    border: `1px solid ${activeTab === tab.id ? "rgba(34,211,238,0.3)" : "rgba(255,255,255,0.07)"}`
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            {activeTab === "match_flow" ? <MatchFlowTab insight={selectedInsight} /> : null}
            {activeTab === "apm" ? <APMTab insight={selectedInsight} game={selectedGame} /> : null}
            {activeTab === "resource" ? <ResourceTab insight={selectedInsight} /> : null}
            {activeTab === "unit_prod" ? <UnitProductionTab insight={selectedInsight} /> : null}
            {activeTab === "tech" ? <TechTab insight={selectedInsight} game={selectedGame} /> : null}
          </div>
        </div>

        <div className="xl:col-span-1">
          <PlayerDeepDive game={selectedGame} insight={selectedInsight} focusedPlayer={focusedPlayer} onSelect={setFocusedPlayer} />
        </div>
      </div>

      <div className="rounded-lg px-4 py-2.5" style={{ backgroundColor: "#0a1428", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-[10px] font-mono text-slate-500">
          REPLAY_ANALYZER_STATUS: <span className="text-cyan-400">{selectedGame.analyzerStatus}</span> | {selectedGame.matchStory}
        </p>
      </div>
    </div>
  );
}
