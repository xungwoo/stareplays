"use client";

import Link from "next/link";
import { RefreshCw, TrendingUp, Users } from "lucide-react";

import { Panel } from "@/components/shared/panel";
import { PlayerBadge } from "@/components/shared/player-badge";
import { RaceBadge, RaceGroup } from "@/components/shared/race-badge";
import { SectionAccent } from "@/components/shared/section-accent";
import { CYAN_PANEL_STYLE, CYAN_SECTION_DIVIDER_STYLE, INNER_PANEL_STYLE } from "@/lib/constants/ui-styles";
import { displayPlayerName } from "@/lib/utils/player-display";
import type { RaceRankingRow, RankingRow, RaceCompositionRow, RankingsPageModel } from "@/types/rankings";

const CARD_STYLE = CYAN_PANEL_STYLE;

export type RankingsSortBy = "win_rate" | "avg_apm" | "avg_eapm";
export type RaceSortBy = "games" | "team_a_win_rate";

export type RankingsPageViewModel = RankingsPageModel & {
  rankingsError?: string;
  raceCompositionsError?: string;
};

function WinRateBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: INNER_PANEL_STYLE.backgroundColor }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono" style={{ color }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

function compareNames(left: string, right: string) {
  return left.trim().localeCompare(right.trim());
}

export function formatArrow(isActive: boolean, isDescending: boolean) {
  if (!isActive) return "↕";
  return isDescending ? "▼" : "▲";
}

export function sortRankings(rows: RankingRow[], sortBy: RankingsSortBy, sortDesc: boolean) {
  const dir = sortDesc ? -1 : 1;

  return [...rows]
    .sort((left, right) => {
      if (sortBy === "avg_apm") {
        const diff = (left.avgApm - right.avgApm) * dir;
        if (diff !== 0) return diff;
        return compareNames(left.user, right.user);
      }

      if (sortBy === "avg_eapm") {
        const diff = (left.avgEapm - right.avgEapm) * dir;
        if (diff !== 0) return diff;
        return compareNames(left.user, right.user);
      }

      const winRateDiff = (left.winRate - right.winRate) * dir;
      if (winRateDiff !== 0) return winRateDiff;

      const winsDiff = (left.wins - right.wins) * dir;
      if (winsDiff !== 0) return winsDiff;

      const gamesDiff = (left.games - right.games) * dir;
      if (gamesDiff !== 0) return gamesDiff;

      return compareNames(left.user, right.user);
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function sortRaceCompositions(rows: RaceCompositionRow[], sortBy: RaceSortBy, sortDesc: boolean) {
  const dir = sortDesc ? -1 : 1;

  return [...rows].sort((left, right) => {
    if (sortBy === "team_a_win_rate") {
      const diff = (left.teamAWinPct - right.teamAWinPct) * dir;
      if (diff !== 0) return diff;

      const gamesDiff = (left.games - right.games) * dir;
      if (gamesDiff !== 0) return gamesDiff;
    } else {
      const diff = (left.games - right.games) * dir;
      if (diff !== 0) return diff;

      const winRateDiff = (left.teamAWinPct - right.teamAWinPct) * dir;
      if (winRateDiff !== 0) return winRateDiff;
    }

    const leftMatchup = `${left.teamA.join("")}-${left.teamB.join("")}`;
    const rightMatchup = `${right.teamA.join("")}-${right.teamB.join("")}`;
    return leftMatchup.localeCompare(rightMatchup);
  });
}

export function RankingsTable({
  model,
  currentUser,
  sortBy,
  sortDesc,
  onSortChange
}: {
  model: RankingsPageViewModel;
  currentUser: string;
  sortBy: RankingsSortBy;
  sortDesc: boolean;
  onSortChange: (sortBy: RankingsSortBy) => void;
}) {
  const sortedRankings = sortRankings(model.rankings, sortBy, sortDesc);
  const rankingsError = model.rankingsError?.trim();
  const qualifiedGames = Math.max(...model.rankings.map((row) => row.games), 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SectionAccent />
          <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-slate-200">Rankings_3v3</h2>
          <span className="text-[10px] font-mono text-slate-600">TEAM_SIZE: 3V3 | QUALIFIED_GAMES: {qualifiedGames} | ROWS: {sortedRankings.length}</span>
          <span className="rounded px-2 py-1 text-[10px] font-mono font-bold" style={{ backgroundColor: "rgba(34,211,238,0.08)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.18)" }}>
            CURRENT_USER: {displayPlayerName(currentUser)}
          </span>
        </div>
        <Link
          href={`/rankings?currentUser=${encodeURIComponent(currentUser)}`}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-400 transition-all hover:text-slate-200"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <RefreshCw className="h-3 w-3" />
          REFRESH
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl" style={CARD_STYLE}>
        <div
          className="grid px-4 py-3"
          style={{
            gridTemplateColumns: "60px 1fr 120px 120px 80px 120px 120px",
            backgroundColor: "#081428",
            ...CYAN_SECTION_DIVIDER_STYLE
          }}
        >
          <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-600">RANK</span>
          <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-600">USER</span>
          <button type="button" onClick={() => onSortChange("win_rate")} className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-600">
            WIN RATE {formatArrow(sortBy === "win_rate", sortDesc)}
          </button>
          <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-600">RECORD</span>
          <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-600">GAMES</span>
          <button type="button" onClick={() => onSortChange("avg_apm")} className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-600">
            AVG APM (95P) {formatArrow(sortBy === "avg_apm", sortDesc)}
          </button>
          <button type="button" onClick={() => onSortChange("avg_eapm")} className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-600">
            AVG EAPM (95P) {formatArrow(sortBy === "avg_eapm", sortDesc)}
          </button>
        </div>

        {rankingsError ? (
          <div className="px-4 py-6 text-center text-[11px] font-mono" style={{ color: "#8a2f2f" }}>
            ERROR_LOAD_RANKINGS: {rankingsError}
          </div>
        ) : sortedRankings.length === 0 ? (
          <div className="px-4 py-6 text-center text-[11px] font-mono" style={{ color: "#4A4F59" }}>
            NO_3V3_RANKINGS
          </div>
        ) : (
          sortedRankings.map((player) => (
            <div
              key={player.user}
              className="grid items-center px-4 py-3.5 transition-all hover:bg-slate-800/30"
              style={{
                gridTemplateColumns: "60px 1fr 120px 120px 80px 120px 120px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                backgroundColor: player.isCurrentUser ? "rgba(255,255,255,0.4)" : "transparent"
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-sm font-mono font-bold"
                  style={{
                    color: player.rank === 1 ? "#f59e0b" : player.rank === 2 ? "#94a3b8" : player.rank === 3 ? "#cd7f32" : "#475569"
                  }}
                >
                  #{player.rank}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <RaceBadge race={player.favoriteRace} size="md" />
                <PlayerBadge name={displayPlayerName(player.user)} compact />
                {player.isCurrentUser ? (
                  <span className="rounded px-1.5 py-0.5 text-[9px] font-mono font-bold" style={{ backgroundColor: "rgba(34,211,238,0.15)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)" }}>
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
          ))
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {model.summary.map(({ label, value, accent }) => {
          const Icon = label === "Total Players" ? Users : TrendingUp;
          const color = accent === "violet" ? "#a78bfa" : accent === "amber" ? "#f59e0b" : accent === "emerald" ? "#34d399" : "#22d3ee";

          return (
          <Panel key={label} variant="cyan" className="rounded-xl p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-mono tracking-widest text-slate-500">{label}</span>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <span className="text-xl font-mono font-bold" style={{ color }}>
              {value}
            </span>
          </Panel>
          );
        })}
      </div>
    </div>
  );
}

export function RaceCompositionTable({
  model,
  currentUser,
  sortBy,
  sortDesc,
  onSortChange
}: {
  model: RankingsPageViewModel;
  currentUser: string;
  sortBy: RaceSortBy;
  sortDesc: boolean;
  onSortChange: (sortBy: RaceSortBy) => void;
}) {
  const raceCompositionsError = model.raceCompositionsError?.trim();
  const sortedRaceCompositions = raceCompositionsError ? [] : sortRaceCompositions(model.raceCompositions, sortBy, sortDesc);
  const raceGames = sortedRaceCompositions.reduce((max, row) => Math.max(max, row.games), 0);
  const raceMeta = raceCompositionsError ? `ERROR_LOAD_ANALYZER: ${raceCompositionsError}` : `TEAM_SIZE: 3v3 | MAX_MATCHUP_GAMES: ${raceGames} | ROWS: ${sortedRaceCompositions.length}`;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SectionAccent />
          <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-slate-200">Race_Composition_WinRate (3v3)</h2>
          <span className="text-[10px] font-mono text-slate-600">{raceMeta}</span>
        </div>
        <Link
          href={`/rankings?currentUser=${encodeURIComponent(currentUser)}`}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-400 transition-all hover:text-slate-200"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <RefreshCw className="h-3 w-3" />
          REFRESH
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl" style={CARD_STYLE}>
        <div
          className="grid px-4 py-3"
          style={{
            gridTemplateColumns: "2fr 80px 1fr 1fr 80px 80px",
            backgroundColor: "#081428",
            ...CYAN_SECTION_DIVIDER_STYLE
          }}
        >
          <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-600">MATCHUP</span>
          <button type="button" onClick={() => onSortChange("games")} className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-600">
            GAMES {formatArrow(sortBy === "games", sortDesc)}
          </button>
          <button type="button" onClick={() => onSortChange("team_a_win_rate")} className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-600">
            TEAM_A WIN% {formatArrow(sortBy === "team_a_win_rate", sortDesc)}
          </button>
          <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-600">TEAM_B WIN%</span>
          <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-600">A WINS</span>
          <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-600">B WINS</span>
        </div>

        {sortedRaceCompositions.length === 0 ? (
          <div className="px-4 py-6 text-center text-[11px] font-mono" style={{ color: "#4A4F59" }}>
            NO_MATCHUP_DATA
          </div>
        ) : (
          sortedRaceCompositions.map((row, index) => (
            <div
              key={`${row.teamA.join("")}-${row.teamB.join("")}-${index}`}
              className="grid items-center px-4 py-3 transition-all hover:bg-slate-800/30"
              style={{ gridTemplateColumns: "2fr 80px 1fr 1fr 80px 80px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              <div className="flex items-center gap-2">
                <RaceGroup races={row.teamA} />
                <span className="text-xs font-mono text-slate-600">vs</span>
                <RaceGroup races={row.teamB} />
              </div>

              <span className="text-sm font-mono font-bold text-slate-200">{row.games}</span>

              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: INNER_PANEL_STYLE.backgroundColor }}>
                  <div className="h-full rounded-full" style={{ width: `${row.teamAWinPct}%`, backgroundColor: row.teamAWinPct > 50 ? "#22d3ee" : row.teamAWinPct === 50 ? "#f59e0b" : "#475569" }} />
                </div>
                <span className="w-12 text-right text-xs font-mono font-semibold" style={{ color: row.teamAWinPct > 50 ? "#22d3ee" : row.teamAWinPct === 50 ? "#f59e0b" : "#64748b" }}>
                  {row.teamAWinPct.toFixed(1)}%
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: INNER_PANEL_STYLE.backgroundColor }}>
                  <div className="h-full rounded-full" style={{ width: `${row.teamBWinPct}%`, backgroundColor: row.teamBWinPct > 50 ? "#a78bfa" : row.teamBWinPct === 50 ? "#f59e0b" : "#475569" }} />
                </div>
                <span className="w-12 text-right text-xs font-mono font-semibold" style={{ color: row.teamBWinPct > 50 ? "#a78bfa" : row.teamBWinPct === 50 ? "#f59e0b" : "#64748b" }}>
                  {row.teamBWinPct.toFixed(1)}%
                </span>
              </div>

              <span className="text-sm font-mono font-bold" style={{ color: "#22d3ee" }}>
                {row.teamAWins}
              </span>
              <span className="text-sm font-mono font-bold text-slate-400">{row.teamBWins}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RaceRankingPanel({ race, rows }: { race: RaceRankingRow["race"]; rows: RaceRankingRow[] }) {
  const title = race === "R" ? "RANDOM_RANKINGS" : `${race}_RANKINGS`;

  return (
    <div className="overflow-hidden rounded-xl" style={CARD_STYLE}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ backgroundColor: "#081428", ...CYAN_SECTION_DIVIDER_STYLE }}>
        {race === "R" ? (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded font-mono text-xs font-bold" style={{ backgroundColor: "rgba(34, 211, 238, 0.16)", color: "#67e8f9", border: "1px solid rgba(34, 211, 238, 0.35)" }}>R</span>
        ) : (
          <RaceBadge race={race} size="md" />
        )}
        <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-300">{title}</h3>
      </div>
      <div className="grid px-4 py-2" style={{ gridTemplateColumns: "44px minmax(92px,1fr) 132px 78px", backgroundColor: "rgba(8,20,40,0.72)" }}>
        <span className="text-[10px] font-mono font-semibold uppercase text-slate-600">R</span>
        <span className="text-[10px] font-mono font-semibold uppercase text-slate-600">USER</span>
        <span className="text-[10px] font-mono font-semibold uppercase text-slate-600">전체 성적</span>
        <span className="text-[10px] font-mono font-semibold uppercase text-slate-600">승률</span>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-5 text-center text-[11px] font-mono" style={{ color: "#4A4F59" }}>
          NO_{race}_DATA
        </div>
      ) : (
        rows.map((row) => (
          <div key={`${row.race}-${row.user}`} className="grid items-center px-4 py-3 hover:bg-slate-800/30" style={{ gridTemplateColumns: "44px minmax(92px,1fr) 132px 78px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <span className="text-xs font-mono font-bold text-slate-500">#{row.rank}</span>
            <div className="flex items-center gap-2">
              <PlayerBadge name={displayPlayerName(row.user)} compact />
            </div>
            <span className="text-xs font-mono text-slate-300">
              <span className="text-emerald-300">{row.wins}승</span>
              <span className="text-slate-500"> </span>
              <span className="text-rose-300">{row.losses}패</span>
              <span className="text-slate-500"> ({row.games}경기)</span>
            </span>
            <span className="text-xs font-mono font-semibold" style={{ color: row.winRate >= 50 ? "#34d399" : "#f87171" }}>{row.winRate.toFixed(1)}%</span>
          </div>
        ))
      )}
    </div>
  );
}

export function RaceRankingsTable({ model, currentUser }: { model: RankingsPageViewModel; currentUser: string }) {
  const rowsByRace = {
    P: model.raceRankings.filter((row) => row.race === "P"),
    T: model.raceRankings.filter((row) => row.race === "T"),
    Z: model.raceRankings.filter((row) => row.race === "Z"),
    R: model.raceRankings.filter((row) => row.race === "R")
  };
  const totalRows = model.raceRankings.length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SectionAccent />
          <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-slate-200">Race_Rankings</h2>
          <span className="text-[10px] font-mono text-slate-600">RACES: P/T/Z/RANDOM | ROWS: {totalRows}</span>
        </div>
        <Link
          href={`/rankings?currentUser=${encodeURIComponent(currentUser)}`}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-400 transition-all hover:text-slate-200"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <RefreshCw className="h-3 w-3" />
          REFRESH
        </Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <RaceRankingPanel race="P" rows={rowsByRace.P} />
        <RaceRankingPanel race="T" rows={rowsByRace.T} />
        <RaceRankingPanel race="Z" rows={rowsByRace.Z} />
        <RaceRankingPanel race="R" rows={rowsByRace.R} />
      </div>
    </div>
  );
}
