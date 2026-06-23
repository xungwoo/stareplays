"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ResultBadge } from "@/components/shared/status-badge";
import { CYAN_PANEL_STYLE, INNER_PANEL_STYLE } from "@/lib/constants/ui-styles";
import { getOrderedGamePlayers } from "@/lib/utils/analyzer-player-order";
import { getPlayerColor } from "@/lib/utils/player-colors";
import { displayPlayerName } from "@/lib/utils/player-display";
import type { AnalyzerGameInsight, AnalyzerPageModel, TimelineEvent } from "@/types/analyzer";

const CARD_STYLE = CYAN_PANEL_STYLE;

export type LegacyTabId = "match-flow" | "economy" | "apm" | "production" | "tech" | "combat";

const LEGACY_TABS: Array<{ id: LegacyTabId; label: string }> = [
  { id: "match-flow", label: "Match Flow" },
  { id: "economy", label: "Economy" },
  { id: "apm", label: "APM" },
  { id: "production", label: "Production" },
  { id: "tech", label: "Tech" },
  { id: "combat", label: "Combat" }
];

export function samePlayer(left: string | null | undefined, right: string | null | undefined) {
  return String(left ?? "").trim().toLowerCase() === String(right ?? "").trim().toLowerCase();
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
          <div className="relative h-5 flex-1 overflow-hidden rounded" style={{ backgroundColor: INNER_PANEL_STYLE.backgroundColor }}>
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
          <div className="relative h-5 flex-1 overflow-hidden rounded" style={{ backgroundColor: INNER_PANEL_STYLE.backgroundColor }}>
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

function MatchFlowTab({
  insight,
  selectedPlayer,
  onSelect,
  resetKey
}: {
  insight: AnalyzerGameInsight;
  selectedPlayer: string | null;
  onSelect: (name: string) => void;
  resetKey: string;
}) {
  const [eventPage, setEventPage] = useState(0);
  const pageSize = 12;
  const total = insight.timeline.length;
  const maxPages = Math.max(1, Math.ceil(total / pageSize));
  const pageEvents = insight.timeline.slice(eventPage * pageSize, eventPage * pageSize + pageSize);

  useEffect(() => {
    setEventPage(0);
  }, [resetKey]);

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
            <button
              key={`${event.time}-${event.player}-${index}`}
              type="button"
              aria-label={`${event.event} ${event.player}`}
              onClick={() => onSelect(event.player)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 transition-all"
              style={{
                backgroundColor: samePlayer(selectedPlayer, event.player) ? "rgba(34,211,238,0.08)" : event.team === "WINNER" ? "rgba(16,185,129,0.04)" : "rgba(239,68,68,0.04)",
                border: `1px solid ${event.team === "WINNER" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)"}`
              }}
            >
              <span className="min-w-[42px] rounded px-1.5 py-0.5 text-center text-[10px] font-mono font-bold text-slate-400" style={{ backgroundColor: "#0a1428", color: "#94a3b8" }}>
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
            </button>
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

function APMTab({
  insight,
  game,
  focusedPlayer,
  hiddenPlayers,
  onTogglePlayer,
  onSelect
}: {
  insight: AnalyzerGameInsight;
  game: AnalyzerPageModel["selectedGame"];
  focusedPlayer: string | null;
  hiddenPlayers: Record<string, boolean>;
  onTogglePlayer: (name: string) => void;
  onSelect: (name: string) => void;
}) {
  const players = getOrderedGamePlayers(game).map((player) => player.name);
  const visiblePlayers = focusedPlayer
    ? players.filter((name) => samePlayer(name, focusedPlayer))
    : players.filter((name) => !hiddenPlayers[name.trim().toLowerCase()]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {players.map((name) => {
          const hidden = !!hiddenPlayers[name.trim().toLowerCase()];

          return (
            <button
              key={name}
              type="button"
              onClick={() => {
                if (focusedPlayer) {
                  onSelect(name);
                  return;
                }

                onTogglePlayer(name);
              }}
              className="rounded px-2 py-1 text-[10px] font-mono font-semibold transition-all"
              style={{
                backgroundColor: hidden ? "rgba(239,68,68,0.08)" : "rgba(34,211,238,0.08)",
                color: hidden ? "#fca5a5" : "#67e8f9",
                border: `1px solid ${hidden ? "rgba(248,113,113,0.22)" : "rgba(34,211,238,0.18)"}`
              }}
            >
              {hidden ? "SHOW" : "HIDE"} {displayPlayerName(name)}
            </button>
          );
        })}
      </div>

      <div className="rounded-lg p-3" style={INNER_PANEL_STYLE}>
        {visiblePlayers.length > 0 ? (
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
              {visiblePlayers.map((name) => (
                <Line key={name} type="monotone" dataKey={name} stroke={getPlayerColor(name)} dot={false} strokeWidth={1.5} />
              ))}
              <Legend wrapperStyle={{ fontSize: 10, fontFamily: "JetBrains Mono" }} formatter={(value) => <span style={{ color: getPlayerColor(String(value)) }}>{String(value)}</span>} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-[11px] font-mono text-slate-500">NO_TIMELINE_DATA</div>
        )}
      </div>
    </div>
  );
}

function EconomyTab({
  game,
  focusedPlayer,
  onSelect
}: {
  game: AnalyzerPageModel["selectedGame"];
  focusedPlayer: string | null;
  onSelect: (name: string) => void;
}) {
  const players = getOrderedGamePlayers(game);
  const selected = players.find((player) => samePlayer(player.name, focusedPlayer));

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="overflow-hidden rounded-lg" style={INNER_PANEL_STYLE}>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              {["PLAYER", "APM", "EAPM", "PRODUCTION"].map((header) => (
                <th key={header} className="px-3 py-2 text-left text-[10px] tracking-widest text-slate-500">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.name} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => onSelect(player.name)} className="text-left text-cyan-300 hover:text-cyan-200">
                    {displayPlayerName(player.name)}
                  </button>
                </td>
                <td className="px-3 py-2 text-slate-300">{player.apm}</td>
                <td className="px-3 py-2 text-slate-300">{player.eapm}</td>
                <td className="px-3 py-2 text-slate-300">{player.production}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg p-3 text-xs font-mono" style={INNER_PANEL_STYLE}>
        <p className="mb-2 text-[10px] tracking-widest text-slate-500">SELECTED PLAYER SPEND CURVE</p>
        {selected ? (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">PLAYER</span>
              <span className="text-slate-200">{displayPlayerName(selected.name)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">INPUT EFFICIENCY</span>
              <span className="text-slate-200">{selected.effective.toFixed(1)}%</span>
            </div>
            <div className="text-slate-400">Economy detail follows the shared player selection just like legacy.</div>
          </div>
        ) : (
          <div className="text-slate-500">Select a player from any table, timeline, or 3x3 board.</div>
        )}
      </div>
    </div>
  );
}

function ProductionTab({
  game,
  focusedPlayer,
  onSelect
}: {
  game: AnalyzerPageModel["selectedGame"];
  focusedPlayer: string | null;
  onSelect: (name: string) => void;
}) {
  const players = getOrderedGamePlayers(game);
  const selected = players.find((player) => samePlayer(player.name, focusedPlayer));

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-lg p-3 text-xs font-mono" style={INNER_PANEL_STYLE}>
        <p className="mb-2 text-[10px] tracking-widest text-slate-500">PRODUCTION PROFILE</p>
        {selected ? (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">PLAYER</span>
              <span className="text-slate-200">{displayPlayerName(selected.name)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">PRODUCTION</span>
              <span className="text-slate-200">{selected.production}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">CMD</span>
              <span className="text-slate-200">{selected.cmd.toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <div className="text-slate-500">No player selected. Choose a player to inspect production profile.</div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg" style={INNER_PANEL_STYLE}>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              {["PLAYER", "PRODUCTION", "CMD", "ECMD"].map((header) => (
                <th key={header} className="px-3 py-2 text-left text-[10px] tracking-widest text-slate-500">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.name} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => onSelect(player.name)} className="text-left text-cyan-300 hover:text-cyan-200">
                    {displayPlayerName(player.name)}
                  </button>
                </td>
                <td className="px-3 py-2 text-slate-300">{player.production}</td>
                <td className="px-3 py-2 text-slate-300">{player.cmd.toLocaleString()}</td>
                <td className="px-3 py-2 text-slate-300">{player.ecmd.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TechTab({
  insight,
  game,
  focusedPlayer,
  onSelect
}: {
  insight: AnalyzerGameInsight;
  game: AnalyzerPageModel["selectedGame"];
  focusedPlayer: string | null;
  onSelect: (name: string) => void;
}) {
  const techEvents = insight.timeline.filter((event) => event.type === "UPGRADE" || event.type === "BUILDING");
  const selectedEvents = focusedPlayer ? techEvents.filter((event) => samePlayer(event.player, focusedPlayer)) : [];
  const summaryByPlayer = getOrderedGamePlayers(game).map((player) => ({
    player,
    total: techEvents.filter((event) => samePlayer(event.player, player.name)).length
  }));

  return (
    <div className="space-y-3">
      <div className="rounded-lg p-3" style={INNER_PANEL_STYLE}>
        <p className="mb-2 text-[10px] font-mono tracking-widest text-slate-500">SELECTED PLAYER TECH EVENTS</p>
        {focusedPlayer ? (
          selectedEvents.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedEvents.map((event, index) => (
                <button
                  key={`${event.player}-${event.time}-${index}`}
                  type="button"
                  onClick={() => onSelect(event.player)}
                  className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-mono"
                  style={{ backgroundColor: "#081428", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <span className="text-slate-500">{event.time}</span>
                  <span className="text-slate-300">{event.event}</span>
                  <span style={{ color: event.type === "UPGRADE" ? "#fdba74" : "#93c5fd" }}>{event.type}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-[10px] font-mono text-slate-500">NO_BUILD_ORDER_EVENTS</div>
          )
        ) : (
          <div className="text-[10px] font-mono text-slate-500">Select a player from any table, timeline, or 3x3 board.</div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg" style={INNER_PANEL_STYLE}>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              {["PLAYER", "TECH + UPGRADE", "SIDE"].map((header) => (
                <th key={header} className="px-3 py-2 text-left text-[10px] tracking-widest text-slate-500">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summaryByPlayer.map(({ player, total }) => (
              <tr key={player.name} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => onSelect(player.name)} className="text-left text-cyan-300 hover:text-cyan-200">
                    {displayPlayerName(player.name)}
                  </button>
                </td>
                <td className="px-3 py-2 text-slate-300">{total}</td>
                <td className="px-3 py-2">
                  <ResultBadge result={game.winnerTeam.some((candidate) => candidate.name === player.name) ? "WINNER" : "LOSER"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CombatTab({
  game,
  focusedPlayer,
  onSelect
}: {
  game: AnalyzerPageModel["selectedGame"];
  focusedPlayer: string | null;
  onSelect: (name: string) => void;
}) {
  const players = getOrderedGamePlayers(game);
  const selected = players.find((player) => samePlayer(player.name, focusedPlayer));

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-lg p-3 text-xs font-mono" style={INNER_PANEL_STYLE}>
        <p className="mb-2 text-[10px] tracking-widest text-slate-500">SELECTED PLAYER COMBAT SNAPSHOT</p>
        {selected ? (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">PLAYER</span>
              <span className="text-slate-200">{displayPlayerName(selected.name)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">APM / EAPM</span>
              <span className="text-slate-200">
                {selected.apm} / {selected.eapm}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">REDUNDANCY</span>
              <span className="text-slate-200">{selected.redundancy}%</span>
            </div>
          </div>
        ) : (
          <div className="text-slate-500">Select a player from any table, timeline, or 3x3 board.</div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg" style={INNER_PANEL_STYLE}>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              {["PLAYER", "APM", "EAPM", "REDUNDANCY"].map((header) => (
                <th key={header} className="px-3 py-2 text-left text-[10px] tracking-widest text-slate-500">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.name} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => onSelect(player.name)} className="text-left text-cyan-300 hover:text-cyan-200">
                    {displayPlayerName(player.name)}
                  </button>
                </td>
                <td className="px-3 py-2 text-slate-300">{player.apm}</td>
                <td className="px-3 py-2 text-slate-300">{player.eapm}</td>
                <td className="px-3 py-2 text-slate-300">{player.redundancy}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AnalyzerTabs({
  activeTab,
  game,
  insight,
  focusedPlayer,
  hiddenApmPlayers,
  matchFlowResetKey,
  onActiveTabChange,
  onSelectPlayer,
  onToggleApmPlayer
}: {
  activeTab: LegacyTabId;
  game: AnalyzerPageModel["selectedGame"];
  insight: AnalyzerGameInsight;
  focusedPlayer: string | null;
  hiddenApmPlayers: Record<string, boolean>;
  matchFlowResetKey: string;
  onActiveTabChange: (tab: LegacyTabId) => void;
  onSelectPlayer: (name: string | null) => void;
  onToggleApmPlayer: (name: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl xl:col-span-3" style={CARD_STYLE}>
      <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="mb-3 text-[10px] font-mono tracking-widest text-slate-500">TIMELINE WORKSPACE</p>
        <div className="flex flex-wrap gap-1.5">
          {LEGACY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onActiveTabChange(tab.id)}
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
        {activeTab === "match-flow" ? (
          <MatchFlowTab key={matchFlowResetKey} insight={insight} selectedPlayer={focusedPlayer} onSelect={(name) => onSelectPlayer(name)} resetKey={matchFlowResetKey} />
        ) : null}
        {activeTab === "economy" ? <EconomyTab game={game} focusedPlayer={focusedPlayer} onSelect={(name) => onSelectPlayer(name)} /> : null}
        {activeTab === "apm" ? (
          <APMTab
            insight={insight}
            game={game}
            focusedPlayer={focusedPlayer}
            hiddenPlayers={hiddenApmPlayers}
            onTogglePlayer={onToggleApmPlayer}
            onSelect={(name) => onSelectPlayer(name)}
          />
        ) : null}
        {activeTab === "production" ? <ProductionTab game={game} focusedPlayer={focusedPlayer} onSelect={(name) => onSelectPlayer(name)} /> : null}
        {activeTab === "tech" ? <TechTab insight={insight} game={game} focusedPlayer={focusedPlayer} onSelect={(name) => onSelectPlayer(name)} /> : null}
        {activeTab === "combat" ? <CombatTab game={game} focusedPlayer={focusedPlayer} onSelect={(name) => onSelectPlayer(name)} /> : null}
      </div>
    </div>
  );
}
