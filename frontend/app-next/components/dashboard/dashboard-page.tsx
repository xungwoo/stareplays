"use client";

import { type ChangeEvent, useState } from "react";
import { CheckCircle, ChevronDown, Upload } from "lucide-react";

import { RaceBadge } from "@/components/shared/race-badge";
import type { DashboardPageModel } from "@/types/dashboard";

const CARD = "rounded-xl p-5";
const CARD_STYLE = { backgroundColor: "#0d1833", border: "1px solid rgba(34,211,238,0.1)" };
const SECTION_LABEL = "text-[10px] font-mono font-semibold tracking-widest text-slate-500 uppercase mb-3";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-1"
      style={{ backgroundColor: "#0a1428", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{label}</span>
      <span className="text-lg font-bold font-mono" style={{ color: "#22d3ee" }}>
        {value}
      </span>
      {sub ? <span className="text-xs text-slate-500 font-mono">{sub}</span> : null}
    </div>
  );
}

function DashboardStatsTable({
  title,
  leadingLabel,
  rows
}: {
  title: string;
  leadingLabel: string;
  rows: DashboardPageModel["playerStats"]["raceStats"];
}) {
  return (
    <section className={CARD} style={CARD_STYLE}>
      <p className={SECTION_LABEL}>{title}</p>
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-slate-600 text-[10px]">
            <th className="text-left pb-2">{leadingLabel}</th>
            <th className="text-right pb-2">W-L</th>
            <th className="text-right pb-2">WIN%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((row) => (
            <tr key={row.label} className="hover:bg-slate-800/40">
              <td className="py-2 text-slate-300">{row.label}</td>
              <td className="py-2 text-right text-slate-400">{row.record}</td>
              <td className="py-2 text-right" style={{ color: row.winRate >= 50 ? "#34d399" : "#f87171" }}>
                {row.winRate.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function DashboardPage({ model }: { model: DashboardPageModel }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [uploadStatus, setUploadStatus] = useState<"idle" | "analyzing" | "done">("idle");
  const [queryName, setQueryName] = useState(model.playerStats.name);
  const [showStats, setShowStats] = useState(true);
  const stats = model.playerStats;
  const record = `${stats.wins}-${stats.losses}-${stats.draws}`;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setUploadStatus("idle");
  }

  function handleAnalyze() {
    if (!selectedFile) {
      return;
    }

    setUploadStatus("analyzing");
    window.setTimeout(() => {
      setUploadStatus("done");
    }, 2000);
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2 flex flex-col gap-4" aria-label="Replay Upload Workspace">
        <div className={CARD} style={CARD_STYLE}>
          <p className={SECTION_LABEL}>Replay Upload</p>

          <label
            htmlFor="replay-file"
            className="flex flex-col items-center justify-center gap-3 rounded-lg cursor-pointer transition-all duration-200"
            style={{
              border: `2px dashed ${selectedFile ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.1)"}`,
              backgroundColor: selectedFile ? "rgba(34,211,238,0.04)" : "rgba(255,255,255,0.02)",
              padding: "2rem 1rem"
            }}
          >
            <div className="rounded-full p-3" style={{ backgroundColor: "rgba(34,211,238,0.1)" }}>
              <Upload className="h-6 w-6 text-cyan-400" />
            </div>
            {selectedFile ? (
              <div className="text-center">
                <p className="text-sm font-mono text-cyan-300">{selectedFile.name}</p>
                <p className="mt-1 text-xs text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-slate-400">리플레이 파일을 드래그하거나</p>
                <p className="mt-1 text-xs font-mono text-slate-600">클릭하여 선택 (.rep)</p>
              </div>
            )}
            <input id="replay-file" type="file" accept=".rep" className="hidden" onChange={handleFileChange} />
          </label>

          <div className="mt-4">
            <p className={SECTION_LABEL}>플레이어 선택 (Simple Login)</p>
            <div className="relative">
              <select
                value={selectedPlayer}
                onChange={(event) => setSelectedPlayer(event.target.value)}
                className="w-full appearance-none rounded-lg px-4 py-2.5 text-sm font-mono pr-10 focus:outline-none transition-all"
                style={{ backgroundColor: "#0a1428", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}
                aria-label="플레이어 선택"
              >
                <option value="">{model.uploadPlaceholder}</option>
                {model.uploadCandidates.map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {candidate}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-500" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-600">CURRENT_USER:</span>
              <span
                className="rounded px-2 py-0.5 text-[10px] font-mono font-bold"
                style={{ backgroundColor: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.2)" }}
              >
                {model.currentUser}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!selectedFile}
            className="mt-4 w-full py-3 rounded-lg text-sm font-mono font-bold tracking-widest transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: selectedFile ? "linear-gradient(90deg, #0891b2, #1d4ed8)" : "#1e293b",
              color: selectedFile ? "#e0f7ff" : "#475569",
              border: selectedFile ? "1px solid rgba(34,211,238,0.3)" : "1px solid rgba(255,255,255,0.05)"
            }}
          >
            {uploadStatus === "analyzing" ? "분석 중..." : uploadStatus === "done" ? "✓ 업로드 완료" : "ANALYZE_REPLAY"}
          </button>

          <div
            className="mt-3 rounded-lg px-4 py-3 flex items-center gap-2"
            style={{ backgroundColor: "#0a1428", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            {uploadStatus === "idle" ? <span className="h-2 w-2 rounded-full bg-slate-600" aria-hidden="true" /> : null}
            {uploadStatus === "analyzing" ? <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" aria-hidden="true" /> : null}
            {uploadStatus === "done" ? <CheckCircle className="h-4 w-4 text-emerald-400" aria-hidden="true" /> : null}
            <span className="text-xs font-mono text-slate-500">
              {uploadStatus === "idle" ? "READY" : null}
              {uploadStatus === "analyzing" ? "ANALYZING REPLAY..." : null}
              {uploadStatus === "done" ? "UPLOAD COMPLETE — 게임 목록에서 확인하세요" : null}
            </span>
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ background: "linear-gradient(135deg, rgba(34,211,238,0.06), rgba(96,165,250,0.06))", border: "1px solid rgba(34,211,238,0.1)" }}>
          <p className="text-[10px] font-mono font-semibold text-cyan-500 tracking-widest mb-3">HOW TO USE</p>
          <ul className="space-y-2">
            {model.quickTips.map((tip, index) => (
              <li key={tip} className="flex items-start gap-2 text-xs text-slate-400">
                <span className="font-mono text-cyan-500 mt-0.5">{index + 1}.</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="lg:col-span-3 flex flex-col gap-4" aria-label="Player Statistics Workspace">
        <div className={CARD} style={CARD_STYLE}>
          <p className={SECTION_LABEL}>Player Stats Query</p>
          <div className="flex gap-2">
            <input
              value={queryName}
              onChange={(event) => setQueryName(event.target.value)}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none transition-all"
              style={{ backgroundColor: "#0a1428", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }}
              placeholder="플레이어 이름 입력..."
              aria-label="플레이어 이름 입력"
            />
            <button
              type="button"
              onClick={() => setShowStats(true)}
              className="px-6 py-2.5 rounded-lg text-sm font-mono font-bold tracking-wider transition-all"
              style={{ background: "linear-gradient(90deg, #0891b2, #1d4ed8)", color: "#e0f7ff", border: "1px solid rgba(34,211,238,0.3)" }}
            >
              QUERY
            </button>
          </div>
        </div>

        {showStats ? (
          <>
        <div className={CARD} style={CARD_STYLE}>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] text-slate-500 font-mono tracking-widest mb-1">PLAYER</p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xl font-bold" style={{ color: "#22d3ee" }}>
                  {stats.name}
                </span>
                <RaceBadge race={stats.favoriteRace} size="md" />
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 font-mono tracking-widest mb-1">FAVORITE RACE</p>
              <span className="text-lg font-bold font-mono text-amber-400">{stats.favoriteRaceLabel}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
            <StatCard label="Games" value={String(stats.games)} />
            <StatCard label="Record" value={record} />
            <StatCard label="Avg APM / EAPM" value={`${Math.round(stats.avgApm)}`} sub={`EAPM: ${stats.avgEapm.toFixed(1)}`} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <DashboardStatsTable title="Race Stats" leadingLabel="RACE" rows={stats.raceStats} />
          <DashboardStatsTable title="Matchup Stats" leadingLabel="VS" rows={stats.matchupStats} />
          <DashboardStatsTable title="Map Stats" leadingLabel="MAP" rows={stats.mapStats} />
        </div>

        <div className={CARD} style={CARD_STYLE}>
          <p className={SECTION_LABEL}>Win Rate Progress</p>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="mb-1.5 flex justify-between text-xs font-mono">
                <span className="text-emerald-400">WIN {stats.wins}</span>
                <span className="text-red-400">LOSS {stats.losses}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full" style={{ backgroundColor: "#0a1428" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${stats.winRate}%`, background: "linear-gradient(90deg, #10b981, #22d3ee)" }}
                />
              </div>
              <p className="mt-1 text-center text-[10px] font-mono text-slate-600">
                {stats.winRate.toFixed(1)}% ({stats.games} games)
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-3xl font-bold" style={{ color: "#22d3ee" }}>
                {stats.winRate.toFixed(1)}%
              </p>
              <p className="text-[10px] font-mono text-slate-500">WIN RATE</p>
            </div>
          </div>
        </div>
          </>
        ) : null}
      </div>
      </div>
    </div>
  );
}
