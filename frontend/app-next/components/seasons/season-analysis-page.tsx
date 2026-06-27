"use client";

import Link from "next/link";
import { Activity, CalendarDays, ListOrdered, Swords, Trophy, UsersRound } from "lucide-react";
import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { PlayerBadge } from "@/components/shared/player-badge";
import { RaceBadge } from "@/components/shared/race-badge";
import { MetricHelp } from "@/components/shared/metric-help";
import type { SeasonAnalysisPageModel, SeasonGameRecordPlayer } from "@/lib/adapters/season-analysis";

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function StatCard({ label, value, hint, icon: Icon }: { label: string; value: string; hint: string; icon: typeof Trophy }) {
  return (
    <div className="rounded-lg border border-slate-700/80 bg-slate-900/70 p-3 shadow-sm shadow-slate-950/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
        </div>
        <div className="rounded-md bg-cyan-300/10 p-2 text-cyan-100">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-2 truncate text-xs text-slate-400">{hint}</p>
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-700/80 bg-slate-900/70 p-4 shadow-sm shadow-slate-950/20">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

function SeasonSelector({ model }: { model: SeasonAnalysisPageModel }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/seasons"
        className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
          model.selectedSeasonLabel == null
            ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-50"
            : "border-slate-700 bg-slate-950/40 text-slate-300 hover:border-cyan-300/40"
        }`}
      >
        전체 시즌
      </Link>
      {model.availableSeasons.map((season) => (
        <Link
          key={season.label}
          href={`/seasons/${encodeURIComponent(season.label)}`}
          className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
            model.selectedSeasonLabel === season.label
              ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-50"
              : "border-slate-700 bg-slate-950/40 text-slate-300 hover:border-cyan-300/40"
          }`}
        >
          {season.label}
        </Link>
      ))}
    </div>
  );
}

function TrendChart({
  model,
  selectedPlayerName,
  onSelectPlayer
}: {
  model: SeasonAnalysisPageModel;
  selectedPlayerName: string | null;
  onSelectPlayer: (name: string | null) => void;
}) {
  const visibleSeries = selectedPlayerName ? model.trendSeries.filter((series) => series.name === selectedPlayerName) : model.trendSeries;

  return (
    <Panel title="플레이어 누적 승률 추이" description="경기 진행 순서에 따라 누적 승률이 어떻게 변했는지 보여줍니다.">
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelectPlayer(null)}
          className={`rounded border px-2 py-1 text-xs font-semibold transition ${
            selectedPlayerName == null
              ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-50"
              : "border-slate-700 bg-slate-950/40 text-slate-300 hover:border-cyan-300/40"
          }`}
        >
          전체
        </button>
        {model.trendSeries.map((series) => {
          const active = selectedPlayerName === series.name;
          return (
            <button
              key={series.name}
              type="button"
              onClick={() => onSelectPlayer(active ? null : series.name)}
              className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-semibold transition ${
                active
                  ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-50"
                  : "border-slate-700 bg-slate-950/40 text-slate-300 hover:border-cyan-300/40"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: series.color }} />
              {series.name}
            </button>
          );
        })}
      </div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer minWidth={320} minHeight={300}>
          <LineChart data={model.trendPoints} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.18)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#cbd5e1", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: "#cbd5e1", fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
            <Tooltip
              cursor={{ stroke: "rgba(103,190,207,0.35)" }}
              formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
              contentStyle={{ backgroundColor: "#020617", border: "1px solid rgba(103,190,207,0.45)", borderRadius: 8, color: "#f8fafc" }}
            />
            {visibleSeries.map((series) => (
              <Line
                key={series.name}
                type="monotone"
                dataKey={series.name}
                stroke={series.color}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {visibleSeries.map((series) => (
          <span key={series.name} className="inline-flex items-center gap-1.5 rounded border bg-slate-950/60 px-2 py-1 text-xs font-semibold" style={{ borderColor: `${series.color}66`, color: series.color }}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: series.color }} />
            {series.name}
          </span>
        ))}
      </div>
    </Panel>
  );
}

function HeaderWithHelp({ label, help }: { label: string; help: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{label}</span>
      <MetricHelp label={label} description={help} />
    </span>
  );
}

function PlayerStandings({ model }: { model: SeasonAnalysisPageModel }) {
  return (
    <Panel title="플레이어별 누적 전적" description="선수별 승패, 승률, 평균 APM/EAPM과 안정 지표 기반 MVP 점수를 봅니다.">
      <div className="overflow-hidden rounded-lg border border-slate-700/80">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-950 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-3 py-3">선수</th>
              <th className="px-3 py-3">경기</th>
              <th className="px-3 py-3">승패</th>
              <th className="px-3 py-3"><HeaderWithHelp label="승률" help="선택 시즌 범위의 공식 3x3 경기 승수 / 경기 수입니다." /></th>
              <th className="px-3 py-3"><HeaderWithHelp label="APM" help="Player.apm 필드의 경기별 평균입니다. 랭킹의 95P APM과는 다른 시즌 범위 평균입니다." /></th>
              <th className="px-3 py-3"><HeaderWithHelp label="EAPM" help="Player.eapm 필드의 경기별 평균입니다." /></th>
              <th className="px-3 py-3"><HeaderWithHelp label="MVP" help="승률, 승수, 평균 EAPM, 평균 APM만 반영한 안정 지표 점수입니다. analyzer 보조 지표는 반영하지 않습니다." /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {model.playerStandings.map((player) => (
              <tr key={player.name} className="bg-slate-950/30 transition hover:bg-slate-800/70">
                <td className="px-3 py-3"><PlayerBadge name={player.name} /></td>
                <td className="px-3 py-3 text-slate-300">{player.games}</td>
                <td className="px-3 py-3 text-slate-300">{player.wins}-{player.losses}</td>
                <td className="px-3 py-3 font-semibold text-cyan-100">{formatPercent(player.winRate)}</td>
                <td className="px-3 py-3 text-slate-300">{player.averageApm}</td>
                <td className="px-3 py-3 text-slate-300">{player.averageEapm}</td>
                <td className="px-3 py-3 font-semibold text-cyan-100">{player.mvpScore.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function GameRecords({ model }: { model: SeasonAnalysisPageModel }) {
  return (
    <Panel title="전체 게임 전적" description="선택 범위의 모든 시즌 게임을 시간순으로 확인합니다.">
      <div className="max-h-[520px] overflow-auto rounded-lg border border-slate-700/80">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-950 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-3 py-3">#</th>
              <th className="px-3 py-3">시즌</th>
              <th className="px-3 py-3">일시</th>
              <th className="px-3 py-3">승리팀</th>
              <th className="px-3 py-3">패배팀</th>
              <th className="px-3 py-3">맵</th>
              <th className="px-3 py-3">시간</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {model.gameRecords.map((game, index) => (
              <tr key={game.id} className="bg-slate-950/30 transition hover:bg-slate-800/70">
                <td className="px-3 py-3 text-slate-500">{index + 1}</td>
                <td className="px-3 py-3 font-semibold text-cyan-100">{game.seasonLabel}</td>
                <td className="px-3 py-3 text-slate-400">{game.startTime}</td>
                <td className="px-3 py-3"><SeasonTeamPlayers players={game.winnerPlayers} /></td>
                <td className="px-3 py-3"><SeasonTeamPlayers players={game.loserPlayers} /></td>
                <td className="px-3 py-3 text-slate-400">{game.mapName}</td>
                <td className="px-3 py-3 text-slate-400">{game.durationMinutes}분</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function SeasonTeamPlayers({ players }: { players: SeasonGameRecordPlayer[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {players.map((player) => (
        <span key={player.name} className="inline-flex items-center gap-1 rounded-md bg-slate-800/70 px-1.5 py-1 text-xs font-semibold text-slate-100">
          <RaceBadge race={player.race} randomSelected={player.isRandomSelected} />
          <span>{player.name}</span>
        </span>
      ))}
    </span>
  );
}

function SeasonComparison({ model }: { model: SeasonAnalysisPageModel }) {
  return (
    <Panel title="시즌별 비교" description="시즌별 경기 수, 팀 승률, MVP를 비교합니다.">
      <div className="grid gap-2">
        {model.seasonSummaries.map((season) => (
          <Link
            key={season.label}
            href={`/seasons/${encodeURIComponent(season.label)}`}
            className="rounded-lg border border-slate-700/70 bg-slate-950/40 p-3 transition hover:border-cyan-300/50 hover:bg-slate-800/70"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{season.label}</p>
                <p className="mt-1 text-xs text-slate-400">{season.games}경기 / {season.playerCount}명</p>
              </div>
              <div className="text-right text-xs">
                <p className="font-semibold text-emerald-100">1팀 {formatPercent(season.teamOneWinRate)}</p>
                <p className="mt-1 font-semibold text-violet-100">2팀 {formatPercent(season.teamTwoWinRate)}</p>
              </div>
            </div>
            <div className="mt-2 flex justify-between gap-3 text-xs text-slate-400">
              <span>MVP {season.mvp.name} ({season.mvp.score.toFixed(1)})</span>
              <span>최고승률 {season.bestWinRatePlayer}</span>
            </div>
          </Link>
        ))}
      </div>
    </Panel>
  );
}

export function SeasonAnalysisPage({ model }: { model: SeasonAnalysisPageModel }) {
  const title = model.selectedSeasonLabel ? `${model.selectedSeasonLabel} 전적 분석` : "전체 시즌 전적 분석";
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-[#111827] px-4 py-5 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <section className="mb-4 rounded-lg border border-slate-700/70 bg-slate-800/70 p-4 shadow-xl shadow-slate-950/10">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                <CalendarDays className="h-4 w-4" />
                시즌제 3x3 아카이브
              </div>
              <h1 className="text-3xl font-semibold tracking-normal text-white">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                전체 전적, 플레이어별 누적 승패, 승률 변화 추이를 같은 기준으로 확인합니다.
              </p>
            </div>
            <div className="grid min-w-[520px] grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="경기" value={String(model.summary.totalGames)} hint="선택 범위 게임" icon={Swords} />
              <StatCard label="시즌" value={String(model.summary.totalSeasons)} hint="집계 시즌 수" icon={CalendarDays} />
              <StatCard label="선수" value={String(model.summary.totalPlayers)} hint="3x3 플레이어" icon={UsersRound} />
              <StatCard label="MVP" value={model.summary.mvp} hint="종합 지표 기준" icon={Trophy} />
            </div>
          </div>
          <div className="mt-4">
            <SeasonSelector model={model} />
          </div>
        </section>

        <div className="mb-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <TrendChart model={model} selectedPlayerName={selectedPlayerName} onSelectPlayer={setSelectedPlayerName} />
          <SeasonComparison model={model} />
        </div>

        <div className="mb-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <PlayerStandings model={model} />
          <Panel title="요약 포인트" description="선택된 범위에서 바로 확인할 만한 핵심 결과입니다.">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3">
                <div className="flex items-center gap-2 text-cyan-100">
                  <Activity className="h-4 w-4" />
                  <p className="text-xs font-semibold">최고 승률</p>
                </div>
                <p className="mt-2 text-xl font-semibold text-white">{model.summary.bestWinRatePlayer}</p>
                <p className="mt-1 text-xs text-slate-300">동률이면 경기 수가 많은 선수를 우선합니다.</p>
              </div>
              <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3">
                <div className="flex items-center gap-2 text-emerald-100">
                  <ListOrdered className="h-4 w-4" />
                  <p className="text-xs font-semibold">최근 시즌</p>
                </div>
                <p className="mt-2 text-xl font-semibold text-white">{model.summary.latestSeason}</p>
                <p className="mt-1 text-xs text-slate-300">전체 시즌 보기에서 가장 마지막 시즌입니다.</p>
              </div>
            </div>
          </Panel>
        </div>

        <GameRecords model={model} />
      </div>
    </main>
  );
}
