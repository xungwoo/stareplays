"use client";

import Link from "next/link";
import { useState } from "react";
import { RefreshCw, TrendingUp, Users } from "lucide-react";

import { RaceBadge, RaceGroup } from "@/components/shared/race-badge";
import type { RankingsPageModel } from "@/types/rankings";

const CARD_STYLE = { backgroundColor: "#0d1833", border: "1px solid rgba(34,211,238,0.1)" };

function WinRateBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: "#0a1428" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono" style={{ color }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

function RankingsTable({ model, currentUser }: { model: RankingsPageModel; currentUser: string }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-5 rounded-sm" style={{ backgroundColor: "#22d3ee" }} />
          <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-slate-200">Rankings_3v3</h2>
          <span className="text-[10px] font-mono text-slate-600">TEAM_SIZE: 3V3 | QUALIFIED_GAMES: 43 | ROWS: 6</span>
          <span className="rounded px-2 py-1 text-[10px] font-mono font-bold" style={{ backgroundColor: "rgba(34,211,238,0.08)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.18)" }}>
            CURRENT_USER: {currentUser}
          </span>
        </div>
        <Link
          href={`/rankings?currentUser=${encodeURIComponent(currentUser)}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 transition-all hover:text-slate-200"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <RefreshCw className="h-3 w-3" />
          REFRESH
        </Link>
      </div>

      <div className="rounded-xl overflow-hidden" style={CARD_STYLE}>
        <div
          className="grid px-4 py-3"
          style={{
            gridTemplateColumns: "60px 1fr 120px 120px 80px 120px 120px",
            backgroundColor: "#081428",
            borderBottom: "1px solid rgba(34,211,238,0.1)"
          }}
        >
          {["RANK", "USER", "WIN RATE ▼", "RECORD", "GAMES", "AVG APM (95P)", "AVG EAPM (95P)"].map((header) => (
            <span key={header} className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-600">
              {header}
            </span>
          ))}
        </div>

        {model.rankings.map((player, index) => (
          <div
            key={player.user}
            className="grid items-center px-4 py-3.5 transition-all hover:bg-slate-800/30"
            style={{
              gridTemplateColumns: "60px 1fr 120px 120px 80px 120px 120px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              backgroundColor: player.isCurrentUser ? "rgba(34,211,238,0.04)" : "transparent"
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="text-sm font-mono font-bold"
                style={{
                  color: index === 0 ? "#f59e0b" : index === 1 ? "#94a3b8" : index === 2 ? "#cd7f32" : "#475569"
                }}
              >
                #{player.rank}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <RaceBadge race={player.favoriteRace} size="md" />
              <span className="text-sm font-mono font-semibold" style={{ color: player.isCurrentUser ? "#22d3ee" : "#e2e8f0" }}>
                {player.user}
              </span>
              {player.isCurrentUser ? (
                <span
                  className="rounded px-1.5 py-0.5 text-[9px] font-mono font-bold"
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

            <WinRateBar pct={player.winRate} color={player.winRate >= 50 ? "#34d399" : "#f87171"} />

            <span className="text-xs font-mono text-slate-300">
              <span className="text-emerald-400">{player.wins}</span>
              <span className="text-slate-600">-</span>
              <span className="text-red-400">{player.losses}</span>
              <span className="text-slate-600">-{player.draws}</span>
            </span>

            <span className="text-sm font-mono text-slate-300">{player.games}</span>
            <div className="flex items-center gap-1">
              <span className="text-sm font-mono font-semibold text-cyan-300">{player.avgApm.toFixed(1)}</span>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-sm font-mono font-semibold text-blue-300">{player.avgEapm.toFixed(1)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Games", value: "43", icon: TrendingUp, color: "#22d3ee" },
          { label: "Total Players", value: "6", icon: Users, color: "#a78bfa" },
          { label: "Highest APM", value: "214.7", icon: TrendingUp, color: "#f59e0b" },
          { label: "Top Win Rate", value: "55.8%", icon: TrendingUp, color: "#34d399" }
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl p-4" style={CARD_STYLE}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-mono tracking-widest text-slate-500">{label}</span>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <span className="text-xl font-mono font-bold" style={{ color }}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RaceCompositionTable({ model, currentUser }: { model: RankingsPageModel; currentUser: string }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-5 rounded-sm" style={{ backgroundColor: "#22d3ee" }} />
          <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-slate-200">Race_Composition_WinRate (3v3)</h2>
          <span className="text-[10px] font-mono text-slate-600">
            TEAM_SIZE: 3V3 | QUALIFIED_GAMES: 48 | ROWS: {model.raceCompositions.length}
          </span>
        </div>
        <Link
          href={`/rankings?currentUser=${encodeURIComponent(currentUser)}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 transition-all hover:text-slate-200"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <RefreshCw className="h-3 w-3" />
          REFRESH
        </Link>
      </div>

      <div className="rounded-xl overflow-hidden" style={CARD_STYLE}>
        <div
          className="grid px-4 py-3"
          style={{
            gridTemplateColumns: "2fr 80px 1fr 1fr 80px 80px",
            backgroundColor: "#081428",
            borderBottom: "1px solid rgba(34,211,238,0.1)"
          }}
        >
          {["MATCHUP", "GAMES ▼", "TEAM_A WIN%", "TEAM_B WIN%", "A WINS", "B WINS"].map((header) => (
            <span key={header} className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-600">
              {header}
            </span>
          ))}
        </div>

        {model.raceCompositions.map((row, index) => (
          <div
            key={`${row.teamA.join("")}-${row.teamB.join("")}-${index}`}
            className="grid items-center px-4 py-3 transition-all hover:bg-slate-800/30"
            style={{
              gridTemplateColumns: "2fr 80px 1fr 1fr 80px 80px",
              borderBottom: "1px solid rgba(255,255,255,0.04)"
            }}
          >
            <div className="flex items-center gap-2">
              <RaceGroup races={row.teamA} />
              <span className="text-xs font-mono text-slate-600">vs</span>
              <RaceGroup races={row.teamB} />
            </div>

            <span className="text-sm font-mono font-bold text-slate-200">{row.games}</span>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#0a1428" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${row.teamAWinPct}%`,
                    backgroundColor: row.teamAWinPct > 50 ? "#22d3ee" : row.teamAWinPct === 50 ? "#f59e0b" : "#475569"
                  }}
                />
              </div>
              <span
                className="w-12 text-right text-xs font-mono font-semibold"
                style={{ color: row.teamAWinPct > 50 ? "#22d3ee" : row.teamAWinPct === 50 ? "#f59e0b" : "#64748b" }}
              >
                {row.teamAWinPct.toFixed(1)}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#0a1428" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${row.teamBWinPct}%`,
                    backgroundColor: row.teamBWinPct > 50 ? "#a78bfa" : row.teamBWinPct === 50 ? "#f59e0b" : "#475569"
                  }}
                />
              </div>
              <span
                className="w-12 text-right text-xs font-mono font-semibold"
                style={{ color: row.teamBWinPct > 50 ? "#a78bfa" : row.teamBWinPct === 50 ? "#f59e0b" : "#64748b" }}
              >
                {row.teamBWinPct.toFixed(1)}%
              </span>
            </div>

            <span className="text-sm font-mono font-bold" style={{ color: "#22d3ee" }}>
              {row.teamAWins}
            </span>
            <span className="text-sm font-mono font-bold text-slate-400">{row.teamBWins}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RankingsPage({ model }: { model: RankingsPageModel }) {
  const [activeTab, setActiveTab] = useState<"rankings" | "race_comp">("rankings");
  const currentUser = model.currentUser;

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-6 flex gap-2">
        {model.tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className="rounded-lg px-5 py-2 text-xs font-mono font-bold tracking-wider transition-all"
            style={{
              backgroundColor: activeTab === tab.id ? "rgba(34,211,238,0.12)" : "#0d1833",
              color: activeTab === tab.id ? "#22d3ee" : "#475569",
              border: `1px solid ${activeTab === tab.id ? "rgba(34,211,238,0.3)" : "rgba(255,255,255,0.08)"}`
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "rankings" ? <RankingsTable model={model} currentUser={currentUser} /> : <RaceCompositionTable model={model} currentUser={currentUser} />}
    </div>
  );
}
