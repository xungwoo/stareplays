"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, ArrowDown, ArrowUp, ArrowUpDown, BrainCircuit, Gauge, Swords, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { PlayerBadge, PlayerBadgeGroup } from "@/components/shared/player-badge";
import { RaceBadge, RaceCompositionBadges } from "@/components/shared/race-badge";
import { MetricHelp } from "@/components/shared/metric-help";
import type { TeamAnalysisInsightCard, TeamAnalysisPageModel, TeamAnalysisPlayer, TeamAnalysisPlayerPentagon } from "@/types/team-analysis";
import type { RaceCode } from "@/types/common";

const surfaceStyle = {
  background: "linear-gradient(180deg, rgba(30,41,59,0.94), rgba(25,34,52,0.9))",
  border: "1px solid rgba(148,163,184,0.18)",
  boxShadow: "0 14px 38px rgba(15,23,42,0.18)"
};

const subtleSurfaceStyle = {
  background: "linear-gradient(135deg, rgba(30,41,59,0.72), rgba(25,34,52,0.64))",
  border: "1px solid rgba(148,163,184,0.16)"
};

const chartColors = ["#67becf", "#9d8bcb", "#65be96", "#daa555", "#da7070", "#7da4d6"];
const metricAccents = {
  cyan: {
    border: "#67becf",
    tile: "rgba(103,190,207,0.14)",
    text: "#bae6f0",
    glow: "rgba(103,190,207,0.14)"
  },
  violet: {
    border: "#9d8bcb",
    tile: "rgba(157,139,203,0.14)",
    text: "#d8cff0",
    glow: "rgba(157,139,203,0.14)"
  },
  emerald: {
    border: "#65be96",
    tile: "rgba(101,190,150,0.14)",
    text: "#b7ebd0",
    glow: "rgba(101,190,150,0.14)"
  },
  amber: {
    border: "#daa555",
    tile: "rgba(218,165,85,0.14)",
    text: "#f0d4a6",
    glow: "rgba(218,165,85,0.14)"
  },
  rose: {
    border: "#da7070",
    tile: "rgba(218,112,112,0.14)",
    text: "#efb8b8",
    glow: "rgba(218,112,112,0.14)"
  }
} as const;

type MetricAccent = keyof typeof metricAccents;

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

const raceOrder: RaceCode[] = ["P", "T", "Z"];

function winRateTone(winRate: number): MetricAccent {
  if (winRate >= 70) return "emerald";
  if (winRate >= 55) return "cyan";
  if (winRate >= 40) return "amber";
  return "rose";
}

function Badge({ children, accent = "cyan" }: { children: React.ReactNode; accent?: MetricAccent }) {
  const tone = metricAccents[accent];

  return (
    <span
      className="inline-flex items-center rounded px-2 py-1 text-xs font-semibold"
      style={{
        backgroundColor: tone.tile,
        color: tone.text,
        border: `1px solid ${tone.border}4d`
      }}
    >
      {children}
    </span>
  );
}

function InsightCard({ card }: { card: TeamAnalysisInsightCard }) {
  const tone = metricAccents[card.tone];

  return (
    <article
      className="rounded-lg p-3"
      style={{
        ...subtleSurfaceStyle,
        borderColor: `${tone.border}66`,
        boxShadow: `inset 0 1px 0 ${tone.glow}`
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <Badge accent={card.tone}>{card.label}</Badge>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tone.border }} />
      </div>
      <h3 className="mt-3 text-sm font-semibold leading-5 text-slate-50">{card.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{card.body}</p>
    </article>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "cyan"
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
  icon: typeof Activity;
  accent?: MetricAccent;
}) {
  const tone = metricAccents[accent];

  return (
    <div
      className="rounded-lg p-4"
      style={{
        ...surfaceStyle,
        borderTop: `3px solid ${tone.border}`,
        boxShadow: `0 18px 55px rgba(2,6,23,0.28), inset 0 1px 0 ${tone.glow}`
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-300">{label}</p>
          <p className="mt-1.5 min-w-0 text-2xl font-semibold tracking-normal text-slate-50">{value}</p>
        </div>
        <div className="rounded-md p-2" style={{ backgroundColor: tone.tile, color: tone.text }}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-2 truncate text-xs font-medium text-slate-400">{hint}</p>
    </div>
  );
}

function Panel({
  title,
  description,
  accent = "cyan",
  help,
  children
}: {
  title: string;
  description: string;
  accent?: MetricAccent;
  help?: string;
  children: React.ReactNode;
}) {
  const tone = metricAccents[accent];

  return (
    <section className="rounded-lg p-4" style={{ ...surfaceStyle, borderColor: `${tone.border}3d` }}>
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 h-1 w-12 rounded-full" style={{ backgroundColor: tone.border }} />
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-50">{title}</h2>
            {help ? <MetricHelp label={title} description={help} /> : null}
          </div>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function pentagonPoint(index: number, value: number, radius = 72, center = 86) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 5;
  const scaledRadius = radius * Math.max(0, Math.min(value, 100)) / 100;

  return {
    x: center + Math.cos(angle) * scaledRadius,
    y: center + Math.sin(angle) * scaledRadius
  };
}

function PentagonChart({ chart, selectedPlayerName, showInlineLegend = false }: { chart: TeamAnalysisPlayerPentagon; selectedPlayerName: string | null; showInlineLegend?: boolean }) {
  const axes = chart.axes.length > 0 ? chart.axes : chart.players[0]?.axes.map((axis) => axis.label) ?? [];
  const gridLevels = [20, 40, 60, 80, 100];
  const visiblePlayers = selectedPlayerName ? chart.players.filter((player) => player.name === selectedPlayerName) : chart.players;
  const teamDiffRows = showInlineLegend && chart.players.length === 2
    ? axes.map((axis) => {
        const left = chart.players[0]?.axes.find((candidate) => candidate.label === axis);
        const right = chart.players[1]?.axes.find((candidate) => candidate.label === axis);
        if (left?.rawValue == null || right?.rawValue == null) return null;
        const leftValue = left.rawValue;
        const rightValue = right.rawValue;
        const winner = leftValue >= rightValue ? chart.players[0] : chart.players[1];
        const winnerValue = Math.max(leftValue, rightValue);
        const loserValue = Math.min(leftValue, rightValue);
        const diffPercent = winnerValue > 0 ? ((winnerValue - loserValue) / winnerValue) * 100 : 0;

        return {
          axis,
          winner,
          diffPercent,
          left,
          right
        };
      }).filter((row): row is NonNullable<typeof row> => row != null)
    : [];

  return (
    <article className="rounded-lg p-3" style={subtleSurfaceStyle}>
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-slate-50">{chart.title}</h3>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{chart.description}</p>
      </div>
      {showInlineLegend ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {chart.players.map((player) => (
            <span
              key={player.name}
              className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold"
              style={{ borderColor: `${player.color}99`, backgroundColor: `${player.color}18`, color: player.color }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: player.color }} />
              {player.name}
            </span>
          ))}
        </div>
      ) : null}
      <svg viewBox="0 0 172 172" role="img" aria-label={chart.title} data-testid="player-radar-chart" className="h-[230px] w-full">
          {gridLevels.map((level) => {
            const points = axes.map((_, index) => pentagonPoint(index, level)).map((point) => `${point.x},${point.y}`).join(" ");

            return <polygon key={level} points={points} fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="1" />;
          })}
          {axes.map((axis, index) => {
            const point = pentagonPoint(index, 100);
            const labelPoint = pentagonPoint(index, 116);

            return (
              <g key={axis}>
                <line x1="86" y1="86" x2={point.x} y2={point.y} stroke="rgba(148,163,184,0.22)" strokeWidth="1" />
                <text x={labelPoint.x} y={labelPoint.y} textAnchor="middle" dominantBaseline="middle" className="fill-slate-300 text-[9px] font-semibold">
                  {axis}
                </text>
              </g>
            );
          })}
          {visiblePlayers.map((player) => {
            const points = player.axes.map((axis, index) => pentagonPoint(index, axis.value)).map((point) => `${point.x},${point.y}`).join(" ");

            return (
              <polygon
                key={player.name}
                data-testid="player-radar-polygon"
                points={points}
                fill={`${player.color}24`}
                stroke={player.color}
                strokeWidth="2"
                opacity="0.72"
              />
            );
          })}
      </svg>
      {teamDiffRows.length > 0 ? (
        <div className="mt-2 grid gap-1.5 text-[11px] text-slate-300 sm:grid-cols-2">
          {teamDiffRows.map((row) => (
            <div key={row.axis} className="flex min-w-0 items-center justify-between gap-2 rounded border border-slate-700/70 bg-slate-950/25 px-2 py-1">
              <span className="truncate font-semibold text-slate-200">{row.axis}</span>
              <span className="truncate text-right">
                <span style={{ color: row.winner.color }}>{row.winner.name}</span>
                <span className="text-slate-500"> +</span>
                <span>{row.diffPercent.toFixed(1)}%</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function PlayerPentagonSection({ charts, leadingChart }: { charts: TeamAnalysisPlayerPentagon[]; leadingChart?: TeamAnalysisPlayerPentagon | null }) {
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null);
  const legendPlayers = charts[0]?.players ?? [];

  if (charts.length === 0 && !leadingChart) return null;

  return (
    <Panel
      title="선수 역량 오각형"
      description={leadingChart ? "팀 비교, 종족 역량, 리플레이 피지컬을 0-100 비교형 지표로 압축했습니다." : "승부 감각, 종족 역량, 리플레이 피지컬을 0-100 비교형 지표로 압축했습니다."}
      accent="violet"
      help="분당 유닛생산과 자원 소모량은 GameDetail build order 기반 season_analysis 값입니다. 생산은 경기 길이로 보정했고, 값이 있는 경기만 평균에 포함하므로 보조 지표로 해석합니다."
    >
      <div className="mb-3 grid grid-cols-3 gap-1.5 sm:grid-cols-7">
        <button
          type="button"
          onClick={() => setSelectedPlayerName(null)}
          className={`inline-flex min-w-0 items-center justify-center rounded-md border px-1.5 py-1 text-[11px] font-semibold transition ${
            selectedPlayerName === null
              ? "border-violet-300/70 bg-violet-300/15 text-violet-50"
              : "border-slate-700 bg-slate-950/40 text-slate-300 hover:border-violet-300/40"
          }`}
        >
          전체 선수 보기
        </button>
        {legendPlayers.map((player) => {
          const active = selectedPlayerName === player.name;

          return (
            <button
              key={player.name}
              type="button"
              onClick={() => setSelectedPlayerName(player.name)}
              aria-label={`${player.name} 선택`}
              className="inline-flex min-w-0 items-center justify-center gap-1 rounded-md border px-1.5 py-1 text-[11px] font-semibold transition hover:bg-slate-900/70"
              style={{
                backgroundColor: active ? `${player.color}22` : "rgba(2,6,23,0.38)",
                borderColor: active ? `${player.color}cc` : "rgba(51,65,85,0.9)",
                color: active ? player.color : "#cbd5e1"
              }}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: player.color }} />
              <span className="truncate">{player.name}</span>
            </button>
          );
        })}
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        {leadingChart ? <PentagonChart chart={leadingChart} selectedPlayerName={null} showInlineLegend /> : null}
        {charts.map((chart) => (
          <PentagonChart key={chart.title} chart={chart} selectedPlayerName={selectedPlayerName} />
        ))}
      </div>
    </Panel>
  );
}

function SeasonScopeSelector({ model }: { model: TeamAnalysisPageModel }) {
  const options = model.scope?.options ?? [];
  if (options.length === 0) return null;

  return (
    <nav aria-label="팀 분석 시즌 선택" className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Link
          key={option.href}
          href={option.href}
          className={`rounded-md border px-3 py-1.5 text-sm font-semibold transition ${
            option.selected
              ? "border-cyan-300/70 bg-cyan-300/15 text-cyan-50"
              : "border-slate-700 bg-slate-950/40 text-slate-300 hover:border-cyan-300/50 hover:text-slate-50"
          }`}
          aria-current={option.selected ? "page" : undefined}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}

function RatingChart({ model }: { model: TeamAnalysisPageModel }) {
  const rows = model.chartData.ratingComparison.slice(0, 8);

  return (
    <Panel
      title="평점 모델 원점수"
      description="Bradley-Terry와 TrueSkill을 5분위 점수로 바꾸지 않고 실제 점수 추이를 나눠서 표시합니다."
      accent="violet"
      help="Bradley-Terry와 TrueSkill은 단위가 다르므로 같은 축에 섞지 않고, 각 모델의 실제 점수와 순위를 함께 봅니다."
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-cyan-300/20 bg-slate-950/30 p-3" data-testid="bt-rating-line-chart">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-cyan-100">Bradley-Terry</h3>
            <span className="text-xs text-slate-500">원점수</span>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer minWidth={260} minHeight={220}>
              <LineChart data={rows} margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#cbd5e1", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={46} domain={["dataMin - 20", "dataMax + 20"]} />
                <Tooltip
                  cursor={{ stroke: "rgba(103,190,207,0.35)" }}
                  formatter={(value) => [value, "BT"]}
                  contentStyle={{ backgroundColor: "#020617", border: "1px solid rgba(103,190,207,0.45)", borderRadius: 8, color: "#f8fafc" }}
                />
                <Line type="monotone" dataKey="bradleyTerry" stroke="#67becf" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} name="BT" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-lg border border-violet-300/20 bg-slate-950/30 p-3" data-testid="trueskill-rating-line-chart">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-violet-100">TrueSkill</h3>
            <span className="text-xs text-slate-500">원점수</span>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer minWidth={260} minHeight={220}>
              <LineChart data={rows} margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.16)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#cbd5e1", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={40} domain={["dataMin - 1", "dataMax + 1"]} />
                <Tooltip
                  cursor={{ stroke: "rgba(157,139,203,0.35)" }}
                  formatter={(value) => [value, "TrueSkill"]}
                  contentStyle={{ backgroundColor: "#020617", border: "1px solid rgba(157,139,203,0.45)", borderRadius: 8, color: "#f8fafc" }}
                />
                <Line type="monotone" dataKey="trueSkill" stroke="#9d8bcb" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} name="TrueSkill" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function RaceCompositionChart({ model }: { model: TeamAnalysisPageModel }) {
  return (
    <Panel
      title="종족 조합"
      description="3인 종족 조합별 승률과 표본 수를 비교합니다."
      accent="emerald"
      help="표본 기준을 통과하지 못한 조합은 최강 조합 판단에서 제외하고 참고 기록으로만 봅니다."
    >
      <div className="h-[320px] w-full">
        <ResponsiveContainer minWidth={320} minHeight={320}>
          <BarChart data={model.chartData.raceComposition.slice(0, 8)} layout="vertical" margin={{ left: 16 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.18)" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: "#cbd5e1", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="composition" tick={{ fill: "#e2e8f0", fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              cursor={{ fill: "rgba(52,211,153,0.12)" }}
              formatter={(value) => [`${value}%`, "승률"]}
              contentStyle={{ backgroundColor: "#020617", border: "1px solid rgba(52,211,153,0.45)", borderRadius: 8, color: "#f8fafc" }}
            />
            <Bar dataKey="winRate" name="승률" radius={[0, 4, 4, 0]}>
              {model.chartData.raceComposition.map((_, index) => (
                <Cell key={`race-cell-${index}`} fill={chartColors[index % chartColors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function PlayerInsightCard({ player }: { player: TeamAnalysisPlayer }) {
  const winTone = winRateTone(player.winRate);

  return (
    <article className="rounded-lg p-4" style={{ ...subtleSurfaceStyle, borderColor: `${metricAccents[winTone].border}33` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <PlayerBadge name={player.name} />
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge accent={winTone}>{player.wins}-{player.losses}</Badge>
            <Badge accent="violet">TS #{player.trueSkillRank}</Badge>
          </div>
        </div>
        <div className="rounded-md px-2 py-1 text-sm font-bold" style={{ backgroundColor: metricAccents[winTone].tile, color: metricAccents[winTone].text }}>
          {formatPercent(player.winRate)}
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-slate-400">APM 순위</dt>
          <dd className="mt-1 font-semibold text-slate-100">#{player.apmRank} / {player.averageApm}</dd>
        </div>
        <div>
          <dt className="text-slate-400">BT 순위</dt>
          <dd className="mt-1 font-semibold text-cyan-100">#{player.bradleyTerryRank} / {player.bradleyTerry}</dd>
        </div>
        <div>
          <dt className="text-slate-400">강점</dt>
          <dd className="mt-1"><Badge accent="emerald">{player.strength}</Badge></dd>
        </div>
        <div>
          <dt className="text-slate-400">약점</dt>
          <dd className="mt-1"><Badge accent="amber">{player.weakness}</Badge></dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        {(player.bestPartners.length ? player.bestPartners : ["NO_DATA"]).map((partner) => (
          <Badge key={partner} accent="cyan">{partner}</Badge>
        ))}
      </div>
      <div className="mt-4 rounded-md border border-slate-700/70 bg-slate-950/35 p-3">
        <p className="text-xs font-bold text-slate-100">AI 훈련 피드백</p>
        <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-300">
          {player.trainingFeedback.map((feedback) => (
            <li key={feedback} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" aria-hidden="true" />
              <span>{feedback}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

type PlayerSortKey = "name" | "record" | "winRate" | "apm" | "unitProduction" | "bradleyTerry" | "trueSkill" | "strength" | "weakness" | "raceP" | "raceT" | "raceZ";
type SortDirection = "asc" | "desc";

const playerMatrixHeaders: Array<{ key: PlayerSortKey; label: string; race?: RaceCode; align?: "left" | "center" }> = [
  { key: "name", label: "선수" },
  { key: "record", label: "전적" },
  { key: "winRate", label: "승률" },
  { key: "apm", label: "APM" },
  { key: "bradleyTerry", label: "BT" },
  { key: "trueSkill", label: "TrueSkill" },
  { key: "strength", label: "강점" },
  { key: "weakness", label: "약점" }
];

const seasonPlayerMatrixHeaders: Array<{ key: PlayerSortKey; label: string; race?: RaceCode; align?: "left" | "center" }> = [
  { key: "name", label: "선수" },
  { key: "winRate", label: "승률" },
  { key: "apm", label: "APM" },
  { key: "unitProduction", label: "분당 유닛생산" },
  { key: "raceP", label: "P전적", race: "P" },
  { key: "raceT", label: "T전적", race: "T" },
  { key: "raceZ", label: "Z전적", race: "Z" },
  { key: "strength", label: "강점" },
  { key: "weakness", label: "약점" }
];

function compareNumber(left: number, right: number, direction: SortDirection) {
  return direction === "asc" ? left - right : right - left;
}

function compareText(left: string, right: string, direction: SortDirection) {
  const result = left.localeCompare(right, "ko");
  return direction === "asc" ? result : -result;
}

function extractPercentValue(value: string): number {
  const match = value.match(/(\d+(?:\.\d+)?)%/);
  return match ? Number(match[1]) : 0;
}

function raceStatFor(player: TeamAnalysisPlayer, race: RaceCode) {
  return player.raceStats.find((stat) => stat.race === race) ?? { race, games: 0, wins: 0, losses: 0, winRate: 0, qualified: false };
}

function raceRecordLabel(player: TeamAnalysisPlayer, race: RaceCode) {
  const stat = raceStatFor(player, race);
  return `${stat.wins}-${stat.losses} / ${formatPercent(stat.winRate)}`;
}

function comparePlayers(left: TeamAnalysisPlayer, right: TeamAnalysisPlayer, key: PlayerSortKey, direction: SortDirection) {
  switch (key) {
    case "name":
      return compareText(left.name, right.name, direction);
    case "record": {
      const winDiff = compareNumber(left.wins, right.wins, direction);
      return winDiff || compareNumber(left.games, right.games, direction) || compareText(left.name, right.name, "asc");
    }
    case "winRate":
      return compareNumber(left.winRate, right.winRate, direction) || compareText(left.name, right.name, "asc");
    case "apm":
      return compareNumber(left.averageApm, right.averageApm, direction) || compareText(left.name, right.name, "asc");
    case "unitProduction":
      return compareNumber(left.unitProduction, right.unitProduction, direction) || compareText(left.name, right.name, "asc");
    case "bradleyTerry":
      return compareNumber(left.bradleyTerry, right.bradleyTerry, direction) || compareText(left.name, right.name, "asc");
    case "trueSkill":
      return compareNumber(left.trueSkill, right.trueSkill, direction) || compareText(left.name, right.name, "asc");
    case "strength":
      return compareNumber(extractPercentValue(left.strength), extractPercentValue(right.strength), direction) || compareText(left.name, right.name, "asc");
    case "weakness":
      return compareNumber(extractPercentValue(left.weakness), extractPercentValue(right.weakness), direction) || compareText(left.name, right.name, "asc");
    case "raceP":
      return compareNumber(raceStatFor(left, "P").winRate, raceStatFor(right, "P").winRate, direction) || compareNumber(raceStatFor(left, "P").games, raceStatFor(right, "P").games, direction) || compareText(left.name, right.name, "asc");
    case "raceT":
      return compareNumber(raceStatFor(left, "T").winRate, raceStatFor(right, "T").winRate, direction) || compareNumber(raceStatFor(left, "T").games, raceStatFor(right, "T").games, direction) || compareText(left.name, right.name, "asc");
    case "raceZ":
      return compareNumber(raceStatFor(left, "Z").winRate, raceStatFor(right, "Z").winRate, direction) || compareNumber(raceStatFor(left, "Z").games, raceStatFor(right, "Z").games, direction) || compareText(left.name, right.name, "asc");
  }
}

function PlayerMatrix({ players, variant = "all" }: { players: TeamAnalysisPlayer[]; variant?: "all" | "season" }) {
  const [sort, setSort] = useState<{ key: PlayerSortKey; direction: SortDirection }>({
    key: variant === "season" ? "winRate" : "trueSkill",
    direction: "desc"
  });
  const headers = variant === "season" ? seasonPlayerMatrixHeaders : playerMatrixHeaders;

  const sortedPlayers = useMemo(() => {
    return [...players].sort((left, right) => comparePlayers(left, right, sort.key, sort.direction));
  }, [players, sort]);

  function toggleSort(key: PlayerSortKey) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc"
    }));
  }

  function renderHeaderLabel(header: (typeof playerMatrixHeaders)[number]) {
    if (!header.race) return <span>{header.label}</span>;

    return (
      <span className="inline-flex items-center gap-1.5">
        <RaceBadge race={header.race} />
        <span>전적</span>
      </span>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-600/70">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-950 text-xs uppercase text-slate-300">
          <tr>
            {headers.map((header) => {
              const active = sort.key === header.key;
              const Icon = !active ? ArrowUpDown : sort.direction === "desc" ? ArrowDown : ArrowUp;

              return (
                <th key={header.key} aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"} className="px-3 py-3 font-medium">
                  <button
                    type="button"
                    onClick={() => toggleSort(header.key)}
                    className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-left font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-50"
                    aria-label={`${header.label} 정렬`}
                  >
                    {renderHeaderLabel(header)}
                    <Icon className="h-3 w-3" aria-hidden="true" />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {sortedPlayers.map((player) => (
            <tr key={player.name} data-testid="team-analysis-player-row" className="bg-slate-950/40 transition-colors hover:bg-slate-800/70">
              <td className="px-3 py-3"><PlayerBadge name={player.name} /></td>
              {variant === "all" ? <td className="px-3 py-3 text-slate-400">{player.wins}-{player.losses}</td> : null}
              <td className="px-3 py-3"><Badge accent={winRateTone(player.winRate)}>{formatPercent(player.winRate)}</Badge></td>
              <td className="px-3 py-3 text-slate-400">#{player.apmRank} / {player.averageApm}</td>
              {variant === "all" ? (
                <>
                  <td className="px-3 py-3 text-cyan-200">#{player.bradleyTerryRank} / {player.bradleyTerry}</td>
                  <td className="px-3 py-3 text-violet-200">#{player.trueSkillRank} / {player.trueSkill}</td>
                </>
              ) : (
                <>
                  <td className="px-3 py-3 text-slate-300">{player.unitProduction}</td>
                  <td className="px-3 py-3 text-xs text-slate-300">{raceRecordLabel(player, "P")}</td>
                  <td className="px-3 py-3 text-xs text-slate-300">{raceRecordLabel(player, "T")}</td>
                  <td className="px-3 py-3 text-xs text-slate-300">{raceRecordLabel(player, "Z")}</td>
                </>
              )}
              <td className="px-3 py-3 text-xs text-slate-300">{player.strength}</td>
              <td className="px-3 py-3 text-xs text-slate-300">{player.weakness}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchTeamCell({ players }: { players: TeamAnalysisPageModel["recentMatches"][number]["winnerTeam"] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {players.map((player) => (
        <div key={`${player.name}-${player.race}`} className="flex items-center gap-2">
          <RaceBadge race={player.race} randomSelected={player.randomSelected} />
          <PlayerBadge name={player.name} compact />
          <span className="text-[11px] text-slate-500">APM {player.apm}</span>
        </div>
      ))}
    </div>
  );
}

function SeasonMatchRawTable({ model }: { model: TeamAnalysisPageModel }) {
  return (
    <Panel
      title="경기 전적 Raw"
      description="선택 시즌에 포함된 경기별 승패, 맵, 팀 구성, 종족, APM을 그대로 확인합니다."
      accent="cyan"
      help="이 표는 분석 모델 결과가 아니라 업로드된 리플레이 목록에서 정규화한 경기 단위 원천 전적입니다."
    >
      <div className="overflow-x-auto rounded-lg border border-slate-700/70">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="bg-slate-950/80 text-xs uppercase text-slate-300">
            <tr>
              <th className="px-3 py-2 font-medium">게임</th>
              <th className="px-3 py-2 font-medium">시간</th>
              <th className="px-3 py-2 font-medium">맵</th>
              <th className="px-3 py-2 font-medium">승리팀</th>
              <th className="px-3 py-2 font-medium">패배팀</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {model.recentMatches.map((match) => (
              <tr key={match.id} className="bg-slate-950/35 align-top transition-colors hover:bg-slate-800/70">
                <td className="px-3 py-3 font-mono text-xs text-slate-300">#{match.id}</td>
                <td className="px-3 py-3 text-xs text-slate-400">{match.startTime}</td>
                <td className="px-3 py-3 text-xs text-slate-300">{match.map}</td>
                <td className="px-3 py-3">
                  <MatchTeamCell players={match.winnerTeam} />
                </td>
                <td className="px-3 py-3">
                  <MatchTeamCell players={match.loserTeam} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function LineupPerformancePanel({ model }: { model: TeamAnalysisPageModel }) {
  const isAllSeasons = model.scope?.isAllSeasons ?? true;

  return (
    <Panel
      title="조합별 성적"
      description={isAllSeasons ? "전체 시즌 기준 관측된 3인 조합과 듀오 궁합입니다." : "선택 시즌 기준 종족 조합별 승률과 표본 수입니다."}
      accent="amber"
    >
      {isAllSeasons ? (
        <div className="space-y-3">
          {model.lineups.slice(0, 7).map((lineup) => (
            <div
              key={lineup.players.join("-")}
              data-testid="lineup-performance-row"
              className="grid items-center gap-3 rounded-lg p-3 transition-colors hover:bg-slate-800/70 xl:grid-cols-[minmax(260px,1fr)_auto_auto]"
              style={subtleSurfaceStyle}
            >
              <div className="min-w-0">
                <PlayerBadgeGroup names={lineup.players} compact />
              </div>
              <div className="flex items-center gap-2">
                <RaceCompositionBadges composition={lineup.composition} />
                <Badge accent={winRateTone(lineup.winRate)}>{lineup.wins}-{lineup.losses} / {formatPercent(lineup.winRate)}</Badge>
              </div>
              <span className="justify-self-start text-xs font-semibold text-slate-300 xl:justify-self-end">평균 APM {lineup.averageApm}</span>
            </div>
          ))}
          <div className="pt-2">
            <h3 className="mb-2 text-sm font-semibold text-slate-100">듀오 궁합</h3>
            <div className="grid gap-2">
              {model.insights.duos.slice(0, 5).map((duo) => (
                <div key={duo.players.join("-")} className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-xs" style={subtleSurfaceStyle}>
                  <PlayerBadgeGroup names={duo.players} compact />
                  <Badge accent={winRateTone(duo.winRate)}>{duo.wins}-{duo.losses} / {formatPercent(duo.winRate)}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          {model.raceCompositions.slice(0, 10).map((composition) => (
            <div key={composition.composition} className="rounded-lg p-3" style={subtleSurfaceStyle}>
              <div className="flex items-center justify-between gap-3">
                <RaceCompositionBadges composition={composition.composition} />
                <Badge accent={winRateTone(composition.winRate)}>{composition.wins}-{composition.losses} / {formatPercent(composition.winRate)}</Badge>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                <span>{composition.note}</span>
                <span>{composition.games}경기</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function TeamAnalysisPage({ model }: { model: TeamAnalysisPageModel }) {
  const scopeLabel = model.scope?.isAllSeasons ? "전체 시즌" : model.scope?.selectedSeasonLabel ?? "최신 시즌";
  const isAllSeasons = model.scope?.isAllSeasons ?? true;
  const seasonPentagons = model.chartData.playerPentagons.filter((chart) => chart.title !== "승부 감각 오각형");

  return (
    <div
      className="min-h-screen px-4 py-5 text-slate-100 sm:px-6"
      style={{
        background: "linear-gradient(180deg, #151c2b 0%, #111827 100%)"
      }}
    >
      <div className="mx-auto max-w-[1500px]">
        <section className="mb-4 overflow-hidden rounded-lg border border-slate-500/20 bg-slate-800/60 p-4 shadow-xl shadow-slate-950/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                <BrainCircuit className="h-4 w-4" />
                무료 UI 베이스: shadcn/ui charts + Tremor blocks 패턴
              </div>
              <h1 className="text-3xl font-semibold tracking-normal text-white">3x3 팀 전적 인텔리전스</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                {scopeLabel} 기준으로 3x3 플레이어의 팀 매치업, 선수 강점과 약점, 종족별 승률, 조합 궁합, Bradley-Terry, TrueSkill을 분석합니다.
              </p>
            </div>
            <div className="grid min-w-[320px] grid-cols-2 gap-3">
              <MetricCard label="경기" value={String(model.summary.gamesAnalyzed)} hint="분석에 사용한 3x3 팀 경기" icon={Swords} accent="cyan" />
              <MetricCard label="선수" value={String(model.summary.playersTracked)} hint="3x3 접두어 플레이어" icon={Users} accent="emerald" />
            </div>
          </div>
          <div className="mt-4 border-t border-slate-700/70 pt-4">
            <SeasonScopeSelector model={model} />
          </div>
        </section>

        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="MVP" value={model.summary.topPlayer} hint="보수적 TrueSkill 기준 1위" icon={BrainCircuit} accent="emerald" />
          <MetricCard label="최강 종족" value={model.summary.strongestComposition} hint="최소 표본을 통과한 종족 조합만 반영" icon={Gauge} accent="amber" />
          <MetricCard
            label={isAllSeasons ? "최강 조합" : "현재 팀 전적"}
            value={<span className="block truncate text-lg leading-8">{isAllSeasons ? model.summary.strongestLineup.value : model.summary.currentTeamRecord.value}</span>}
            hint={isAllSeasons ? model.summary.strongestLineup.hint : model.summary.currentTeamRecord.hint}
            icon={Activity}
            accent="cyan"
          />
          <MetricCard
            label="최약 종족"
            value={(
              <span className="inline-flex min-w-0 items-center gap-2">
                <RaceBadge race={model.summary.weakestRace.race} size="md" />
                <span className="truncate">{model.summary.weakestRace.value}</span>
              </span>
            )}
            hint={model.summary.weakestRace.hint}
            icon={Gauge}
            accent="rose"
          />
        </div>

        {/* 전체 시즌과 개별 시즌은 같은 라우트 안의 별도 뷰 계약이다. 변경 전 docs/team-analysis-view-contract.md를 함께 갱신한다. */}
        {isAllSeasons ? (
          <>
            <div className="mb-4">
              <PlayerPentagonSection charts={model.chartData.playerPentagons} />
            </div>

            <div className="mb-4">
              <Panel title="핵심 인사이트" description="BEST 조합, 최악의 조합, 랜덤 성향, 듀오 궁합을 해설형 카드로 요약합니다." accent="cyan">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {model.insights.cards.map((card) => (
                    <InsightCard key={card.id} card={card} />
                  ))}
                </div>
              </Panel>
            </div>

            <div className="mb-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <RatingChart model={model} />
              <RaceCompositionChart model={model} />
            </div>

            <div className="mb-4 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
              <Panel
                title="선수 역량 매트릭스"
                description="선수별 승패, 승률, APM 순위, 종족 강점과 모델 순위를 비교합니다."
                accent="cyan"
                help="APM/EAPM과 effective command 필드는 replay parser가 선수별로 저장한 Player 지표만 사용합니다."
              >
                <PlayerMatrix players={model.players} />
              </Panel>

              <LineupPerformancePanel model={model} />
            </div>

            <div>
              <Panel title="선수 강점 / 약점 카드" description="스카우팅과 조합 교체 판단에 필요한 선수별 요약 리포트입니다." accent="emerald">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {model.players.slice(0, 6).map((player) => (
                    <PlayerInsightCard key={player.name} player={player} />
                  ))}
                </div>
              </Panel>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4">
              <PlayerPentagonSection charts={seasonPentagons} leadingChart={model.chartData.teamPentagon} />
            </div>

            <div className="mb-4">
              <Panel
                title="선수 역량 매트릭스"
                description="선택 시즌에서는 선수별 승패, 승률, APM, 종족 강점과 약점이 가장 중요한 판단 기준입니다."
                accent="cyan"
                help="APM/EAPM과 effective command 필드는 replay parser가 선수별로 저장한 Player 지표만 사용합니다."
              >
                <PlayerMatrix players={model.players} variant="season" />
              </Panel>
            </div>

            <div className="mb-4">
              <LineupPerformancePanel model={model} />
            </div>

            <div className="mb-4">
              <SeasonMatchRawTable model={model} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
