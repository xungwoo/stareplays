"use client";

import Link from "next/link";
import { type ChangeEvent, useRef, useState } from "react";
import { CheckCircle, ChevronDown, LoaderCircle, Upload } from "lucide-react";

import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { RaceBadge } from "@/components/shared/race-badge";
import { previewReplayUpload, submitReplayUpload } from "@/lib/api/actions";
import { buildApiUrl } from "@/lib/api/url";
import { buildCurrentUserSessionDocumentCookie } from "@/lib/utils/current-user-session";
import type {
  ApiPlayerRecord,
  ApiPlayerStatsResponse,
  ApiReplayPreviewResponse,
  ApiReplayUploadResponse,
  ApiUsersSuggestResponse
} from "@/types/api";
import type {
  DashboardActionStatus,
  DashboardPageModel,
  DashboardPlayerStats,
  DashboardPreviewSummary,
  DashboardUploadSummary
} from "@/types/dashboard";

const CARD = "rounded-xl p-5";
const CARD_STYLE = { backgroundColor: "#0d1833", border: "1px solid rgba(34,211,238,0.1)" };
const SECTION_LABEL = "text-[10px] font-mono font-semibold tracking-widest text-slate-500 uppercase mb-3";

function toNumber(value: unknown, fallback = 0): number {
  const candidate = Number(value);
  return Number.isFinite(candidate) ? candidate : fallback;
}

function getRaceLabel(race: string) {
  switch (race) {
    case "T":
      return "TERRAN";
    case "Z":
      return "ZERG";
    default:
      return "PROTOSS";
  }
}

function getRaceLetter(race: string) {
  const normalized = race.trim().toUpperCase();
  if (normalized.startsWith("T")) return "T";
  if (normalized.startsWith("Z")) return "Z";
  return "P";
}

function mapRecordEntries(recordMap: Record<string, ApiPlayerRecord> | undefined) {
  return Object.entries(recordMap ?? {})
    .sort((left, right) => toNumber(right[1]?.total) - toNumber(left[1]?.total))
    .slice(0, 3)
    .map(([label, record]) => ({
      label,
      record: `${toNumber(record.wins)}-${toNumber(record.losses)}`,
      winRate: toNumber(record.win_rate)
    }));
}

function createPlayerStatsModel(
  response: ApiPlayerStatsResponse,
  fallback: DashboardPlayerStats,
  fallbackName: string
): DashboardPlayerStats {
  const favoriteRace = getRaceLetter(response.favorite_race ?? fallback.favoriteRace);

  return {
    name: response.player_name?.trim() || fallbackName,
    favoriteRace,
    favoriteRaceLabel: getRaceLabel(favoriteRace),
    winRate: toNumber(response.win_rate, fallback.winRate),
    games: toNumber(response.total_games, fallback.games),
    wins: toNumber(response.wins, fallback.wins),
    losses: toNumber(response.losses, fallback.losses),
    draws: toNumber(response.draws, fallback.draws),
    avgApm: toNumber(response.average_apm, fallback.avgApm),
    avgEapm: toNumber(response.average_eapm, fallback.avgEapm),
    raceStats: mapRecordEntries(response.race_stats),
    matchupStats: mapRecordEntries(response.matchup_stats),
    mapStats: mapRecordEntries(response.map_stats)
  };
}

function computeCommonPlayers(result: ApiReplayPreviewResponse): string[] {
  const successItems = (result.results ?? []).filter((item) => item.ok && item.preview?.parsed_players?.length);
  if (!successItems.length) {
    return [];
  }

  const commonMap = new Map<string, string>();
  for (const name of successItems[0]?.preview?.parsed_players ?? []) {
    const trimmed = String(name ?? "").trim();
    if (trimmed) {
      commonMap.set(trimmed.toLowerCase(), trimmed);
    }
  }

  for (const item of successItems.slice(1)) {
    const seen = new Set((item.preview?.parsed_players ?? []).map((name) => String(name ?? "").trim().toLowerCase()).filter(Boolean));
    for (const key of [...commonMap.keys()]) {
      if (!seen.has(key)) {
        commonMap.delete(key);
      }
    }
  }

  return [...commonMap.values()].sort((left, right) => left.localeCompare(right));
}

function createPreviewSummary(result: ApiReplayPreviewResponse): DashboardPreviewSummary {
  return {
    totalFiles: toNumber(result.total_files, result.results?.length ?? 0),
    successCount: toNumber(result.success_count),
    failedCount: toNumber(result.failed_count),
    commonPlayers: computeCommonPlayers(result),
    items: (result.results ?? []).map((item, index) => ({
      filename: item.filename?.trim() || `replay_${index + 1}.rep`,
      ok: Boolean(item.ok),
      mapName: item.preview?.map_name?.trim() || "-",
      startTime: item.preview?.start_time?.trim() || "-",
      playerCount: toNumber(item.preview?.player_count),
      parsedPlayers: (item.preview?.parsed_players ?? []).map((name) => String(name).trim()).filter(Boolean),
      error: item.error?.trim() || null
    }))
  };
}

function extractUploadedGame(result: ApiReplayUploadResponse): { id: number | null; mapName: string | null } {
  if (result.game?.id) {
    return {
      id: toNumber(result.game.id),
      mapName: result.game.map_name?.trim() || null
    };
  }

  const latest = [...(result.results ?? [])]
    .reverse()
    .find((item) => item.ok && item.result?.game?.id);

  return {
    id: latest?.result?.game?.id ? toNumber(latest.result.game.id) : null,
    mapName: latest?.result?.game?.map_name?.trim() || null
  };
}

function createUploadSummary(result: ApiReplayUploadResponse, currentUser: string): DashboardUploadSummary {
  const uploaded = extractUploadedGame(result);
  const currentUserParam = encodeURIComponent(currentUser);

  return {
    uploadedGameId: uploaded.id,
    uploadedMapName: uploaded.mapName,
    vaultHref: `/vault?currentUser=${currentUserParam}`,
    analyzerHref: uploaded.id
      ? `/analyzer?currentUser=${currentUserParam}&gameId=${uploaded.id}`
      : `/analyzer?currentUser=${currentUserParam}`
  };
}

async function fetchBrowserApiJson<T>(path: string): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    headers: {
      accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    let message = `API request failed: ${path}`;

    try {
      const payload = (await response.json()) as { error?: unknown; message?: unknown };
      const errorMessage = payload.error ?? payload.message;
      if (typeof errorMessage === "string" && errorMessage.trim()) {
        message = errorMessage.trim();
      }
    } catch {
      // Keep the generic message above.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

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
  rows: DashboardPlayerStats["raceStats"];
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState(model.currentUser);
  const [currentUser, setCurrentUser] = useState(model.currentUser);
  const [previewState, setPreviewState] = useState<DashboardActionStatus>("idle");
  const [previewSummary, setPreviewSummary] = useState<DashboardPreviewSummary | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<DashboardActionStatus>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSummary, setUploadSummary] = useState<DashboardUploadSummary | null>(null);
  const [queryName, setQueryName] = useState(model.playerStats.name);
  const [queryState, setQueryState] = useState<DashboardActionStatus>("idle");
  const [queryError, setQueryError] = useState<string | null>(null);
  const [querySuggestions, setQuerySuggestions] = useState<string[]>(
    [...new Set([model.playerStats.name, ...model.uploadCandidates])].filter(Boolean)
  );
  const [playerStats, setPlayerStats] = useState(model.playerStats);
  const suggestionTimerRef = useRef<number | null>(null);
  const suggestionRequestRef = useRef(0);

  const selectedFile = selectedFiles[0] ?? null;
  const record = `${playerStats.wins}-${playerStats.losses}-${playerStats.draws}`;
  const selectedPlayerIsCommon = previewSummary ? previewSummary.commonPlayers.some((player) => player.toLowerCase() === selectedPlayer.trim().toLowerCase()) : false;
  const uploadReady = selectedFiles.length > 0 && previewState === "success" && selectedPlayerIsCommon;
  const selectablePlayers = previewSummary?.commonPlayers.length
    ? [...new Set([currentUser, ...previewSummary.commonPlayers].filter(Boolean))]
    : model.uploadCandidates;

  function persistCurrentUser(nextUser: string) {
    const normalized = nextUser.trim();
    setCurrentUser(normalized);
    if (typeof document !== "undefined" && normalized) {
      document.cookie = buildCurrentUserSessionDocumentCookie(normalized);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []);
    setSelectedFiles(nextFiles);
    setPreviewState("idle");
    setPreviewSummary(null);
    setPreviewError(null);
    setUploadState("idle");
    setUploadError(null);
    setUploadSummary(null);
  }

  function handlePlayerSelection(nextPlayer: string) {
    setSelectedPlayer(nextPlayer);
    if (nextPlayer.trim()) {
      persistCurrentUser(nextPlayer);
    }
  }

  async function handlePreview() {
    if (selectedFiles.length === 0) {
      return;
    }

    setPreviewState("submitting");
    setPreviewError(null);
    setUploadState("idle");
    setUploadError(null);
    setUploadSummary(null);

    try {
      const result = (await previewReplayUpload(selectedFiles, { fetchImpl: fetch })) as ApiReplayPreviewResponse;
      const summary = createPreviewSummary(result);
      setPreviewSummary(summary);
      setPreviewState("success");

      const preferredPlayer =
        summary.commonPlayers.find((player) => player.toLowerCase() === currentUser.trim().toLowerCase()) ??
        summary.commonPlayers.find((player) => player.toLowerCase() === selectedPlayer.trim().toLowerCase()) ??
        (summary.commonPlayers.length === 1 ? summary.commonPlayers[0] : "");

      setSelectedPlayer(preferredPlayer);
      if (preferredPlayer) {
        persistCurrentUser(preferredPlayer);
      }
    } catch (error) {
      setPreviewState("error");
      setPreviewError(error instanceof Error ? error.message : "preview failed");
    }
  }

  async function handleUpload() {
    if (!uploadReady) {
      return;
    }

    setUploadState("submitting");
    setUploadError(null);

    try {
      const result = (await submitReplayUpload(selectedFiles, selectedPlayer, { fetchImpl: fetch })) as ApiReplayUploadResponse;
      setUploadSummary(createUploadSummary(result, selectedPlayer));
      setUploadState("success");
      persistCurrentUser(selectedPlayer);
    } catch (error) {
      setUploadState("error");
      setUploadError(error instanceof Error ? error.message : "upload failed");
    }
  }

  async function handleQueryNameChange(nextName: string) {
    setQueryName(nextName);

    const normalized = nextName.trim();
    if (suggestionTimerRef.current) {
      window.clearTimeout(suggestionTimerRef.current);
      suggestionTimerRef.current = null;
    }

    if (!normalized) {
      suggestionRequestRef.current += 1;
      setQuerySuggestions([...new Set([model.playerStats.name, ...model.uploadCandidates])].filter(Boolean));
      return;
    }

    const requestId = suggestionRequestRef.current + 1;
    suggestionRequestRef.current = requestId;

    suggestionTimerRef.current = window.setTimeout(async () => {
      try {
        const result = await fetchBrowserApiJson<ApiUsersSuggestResponse>(
          `/api/v1/users/suggest?q=${encodeURIComponent(normalized)}&limit=5`
        );
        if (suggestionRequestRef.current !== requestId) {
          return;
        }
        setQuerySuggestions(result.users?.length ? result.users : [normalized]);
      } catch {
        if (suggestionRequestRef.current !== requestId) {
          return;
        }
        setQuerySuggestions((previous) => (previous.includes(normalized) ? previous : [normalized, ...previous].slice(0, 5)));
      }
    }, 180);
  }

  async function handleQuery() {
    const normalized = queryName.trim();
    if (!normalized) {
      return;
    }

    setQueryState("submitting");
    setQueryError(null);

    try {
      const result = await fetchBrowserApiJson<ApiPlayerStatsResponse>(
        `/api/v1/players/${encodeURIComponent(normalized)}/stats`
      );
      setPlayerStats(createPlayerStatsModel(result, model.playerStats, normalized));
      setQueryState("success");
      persistCurrentUser(normalized);
      setSelectedPlayer(normalized);
    } catch (error) {
      setQueryState("error");
      setQueryError(error instanceof Error ? error.message : "query failed");
    }
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
                border: `2px dashed ${selectedFiles.length > 0 ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.1)"}`,
                backgroundColor: selectedFiles.length > 0 ? "rgba(34,211,238,0.04)" : "rgba(255,255,255,0.02)",
                padding: "2rem 1rem"
              }}
            >
              <div className="rounded-full p-3" style={{ backgroundColor: "rgba(34,211,238,0.1)" }}>
                <Upload className="h-6 w-6 text-cyan-400" />
              </div>
              {selectedFile ? (
                <div className="text-center">
                  <p className="text-sm font-mono text-cyan-300">{selectedFile.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {(selectedFiles.reduce((total, file) => total + file.size, 0) / 1024).toFixed(1)} KB
                    {selectedFiles.length > 1 ? ` • ${selectedFiles.length} files` : ""}
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-slate-400">리플레이 파일을 드래그하거나</p>
                  <p className="mt-1 text-xs font-mono text-slate-600">클릭하여 선택 (.rep)</p>
                </div>
              )}
              <input id="replay-file" type="file" accept=".rep" multiple className="hidden" onChange={handleFileChange} />
            </label>

            <div className="mt-4">
              <p className={SECTION_LABEL}>플레이어 선택 (Simple Login)</p>
              <div className="relative">
                <select
                  value={selectedPlayer}
                  onChange={(event) => handlePlayerSelection(event.target.value)}
                  className="w-full appearance-none rounded-lg px-4 py-2.5 text-sm font-mono pr-10 focus:outline-none transition-all"
                  style={{ backgroundColor: "#0a1428", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}
                  aria-label="플레이어 선택"
                >
                  <option value="">{model.uploadPlaceholder}</option>
                  {selectablePlayers.map((candidate) => (
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
                  {currentUser}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePreview}
              disabled={selectedFiles.length === 0 || previewState === "submitting"}
              className="mt-4 w-full py-3 rounded-lg text-sm font-mono font-bold tracking-widest transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: selectedFiles.length > 0 ? "linear-gradient(90deg, #0891b2, #1d4ed8)" : "#1e293b",
                color: selectedFiles.length > 0 ? "#e0f7ff" : "#475569",
                border: selectedFiles.length > 0 ? "1px solid rgba(34,211,238,0.3)" : "1px solid rgba(255,255,255,0.05)"
              }}
            >
              {previewState === "submitting" ? "ANALYZING..." : "ANALYZE_REPLAY"}
            </button>

            {previewSummary ? (
              <div
                className="mt-3 rounded-lg px-4 py-3"
                style={{ backgroundColor: "#0a1428", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <div className="flex items-center gap-2 text-xs font-mono text-emerald-300">
                  <CheckCircle className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                  <span>ANALYSIS COMPLETED</span>
                </div>
                <p className="mt-2 text-[11px] font-mono text-slate-400">
                  common players: {previewSummary.commonPlayers.length ? previewSummary.commonPlayers.join(", ") : "none"}
                </p>
              </div>
            ) : (
              <div
                className="mt-3 rounded-lg px-4 py-3 flex items-center gap-2"
                style={{ backgroundColor: "#0a1428", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                {previewState === "idle" ? <span className="h-2 w-2 rounded-full bg-slate-600" aria-hidden="true" /> : null}
                {previewState === "submitting" ? <LoaderCircle className="h-4 w-4 animate-spin text-yellow-400" aria-hidden="true" /> : null}
                {previewState === "error" ? <span className="h-2 w-2 rounded-full bg-red-400" aria-hidden="true" /> : null}
                <span className="text-xs font-mono text-slate-500">
                  {previewState === "idle" ? "READY" : null}
                  {previewState === "submitting" ? "ANALYZING REPLAY..." : null}
                  {previewState === "error" ? `PREVIEW_FAIL: ${previewError}` : null}
                </span>
              </div>
            )}

            {previewSummary ? (
              <button
                type="button"
                onClick={handleUpload}
                disabled={!uploadReady || uploadState === "submitting"}
                className="mt-3 w-full py-3 rounded-lg text-sm font-mono font-bold tracking-widest transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: uploadReady ? "linear-gradient(90deg, #0f766e, #0e7490)" : "#1e293b",
                  color: uploadReady ? "#ecfeff" : "#475569",
                  border: uploadReady ? "1px solid rgba(45,212,191,0.3)" : "1px solid rgba(255,255,255,0.05)"
                }}
              >
                {uploadState === "submitting" ? "UPLOADING..." : "UPLOAD_WITH_SELECTED_USER"}
              </button>
            ) : null}

            {uploadState === "error" ? (
              <ErrorState
                title="Upload Failed"
                description={uploadError ?? "upload failed"}
                className="mt-3 rounded-lg"
                style={{ backgroundColor: "#0a1428", border: "1px solid rgba(239,68,68,0.18)" }}
              />
            ) : null}

            {uploadSummary ? (
              <div
                className="mt-3 rounded-lg px-4 py-3"
                style={{ backgroundColor: "#0a1428", border: "1px solid rgba(16,185,129,0.18)" }}
              >
                <div className="flex items-center gap-2 text-xs font-mono text-emerald-300">
                  <CheckCircle className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                  <span>UPLOAD COMPLETE</span>
                </div>
                <p className="mt-2 text-[11px] font-mono text-slate-400">
                  {uploadSummary.uploadedGameId
                    ? `game #${uploadSummary.uploadedGameId}${uploadSummary.uploadedMapName ? ` • ${uploadSummary.uploadedMapName}` : ""}`
                    : "Batch upload completed"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={uploadSummary.vaultHref}
                    className="rounded border px-3 py-2 text-[11px] font-mono font-bold text-cyan-200"
                    style={{ borderColor: "rgba(34,211,238,0.24)", backgroundColor: "rgba(34,211,238,0.06)" }}
                  >
                    Open Replay Vault
                  </Link>
                  <Link
                    href={uploadSummary.analyzerHref}
                    className="rounded border px-3 py-2 text-[11px] font-mono font-bold text-cyan-200"
                    style={{ borderColor: "rgba(34,211,238,0.24)", backgroundColor: "rgba(34,211,238,0.06)" }}
                  >
                    Open Analyzer
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <div
            className="rounded-xl p-4"
            style={{ background: "linear-gradient(135deg, rgba(34,211,238,0.06), rgba(96,165,250,0.06))", border: "1px solid rgba(34,211,238,0.1)" }}
          >
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
                onChange={(event) => {
                  void handleQueryNameChange(event.target.value);
                }}
                list="dashboard-player-suggestions"
                className="flex-1 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none transition-all"
                style={{ backgroundColor: "#0a1428", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }}
                placeholder="플레이어 이름 입력..."
                aria-label="플레이어 이름 입력"
              />
              <datalist id="dashboard-player-suggestions">
                {querySuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion}>
                    {suggestion}
                  </option>
                ))}
              </datalist>
              <button
                type="button"
                onClick={() => {
                  void handleQuery();
                }}
                className="px-6 py-2.5 rounded-lg text-sm font-mono font-bold tracking-wider transition-all"
                style={{ background: "linear-gradient(90deg, #0891b2, #1d4ed8)", color: "#e0f7ff", border: "1px solid rgba(34,211,238,0.3)" }}
              >
                QUERY
              </button>
            </div>
          </div>

          {queryState === "submitting" ? (
            <LoadingState
              title="QUERYING PLAYER..."
              className="rounded-xl"
              style={{ backgroundColor: "#0d1833", border: "1px solid rgba(34,211,238,0.1)" }}
            />
          ) : queryState === "error" ? (
            <ErrorState
              title="Query Failed"
              description={queryError ?? "failed to query player"}
              className="rounded-xl"
              style={{ backgroundColor: "#0d1833", border: "1px solid rgba(239,68,68,0.18)" }}
            />
          ) : (
            <>
              <div className={CARD} style={CARD_STYLE}>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] text-slate-500 font-mono tracking-widest mb-1">PLAYER</p>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xl font-bold" style={{ color: "#22d3ee" }}>
                        {playerStats.name}
                      </span>
                      <RaceBadge race={playerStats.favoriteRace} size="md" />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-mono tracking-widest mb-1">FAVORITE RACE</p>
                    <span className="text-lg font-bold font-mono text-amber-400">{playerStats.favoriteRaceLabel}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Win Rate" value={`${playerStats.winRate.toFixed(1)}%`} />
                  <StatCard label="Games" value={String(playerStats.games)} />
                  <StatCard label="Record" value={record} />
                  <StatCard
                    label="Avg APM / EAPM"
                    value={`${Math.round(playerStats.avgApm)}`}
                    sub={`EAPM: ${playerStats.avgEapm.toFixed(1)}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <DashboardStatsTable title="Race Stats" leadingLabel="RACE" rows={playerStats.raceStats} />
                <DashboardStatsTable title="Matchup Stats" leadingLabel="VS" rows={playerStats.matchupStats} />
                <DashboardStatsTable title="Map Stats" leadingLabel="MAP" rows={playerStats.mapStats} />
              </div>

              <div className={CARD} style={CARD_STYLE}>
                <p className={SECTION_LABEL}>Win Rate Progress</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="mb-1.5 flex justify-between text-xs font-mono">
                      <span className="text-emerald-400">WIN {playerStats.wins}</span>
                      <span className="text-red-400">LOSS {playerStats.losses}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full" style={{ backgroundColor: "#0a1428" }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${playerStats.winRate}%`, background: "linear-gradient(90deg, #10b981, #22d3ee)" }}
                      />
                    </div>
                    <p className="mt-1 text-center text-[10px] font-mono text-slate-600">
                      {playerStats.winRate.toFixed(1)}% ({playerStats.games} games)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-3xl font-bold" style={{ color: "#22d3ee" }}>
                      {playerStats.winRate.toFixed(1)}%
                    </p>
                    <p className="text-[10px] font-mono text-slate-500">WIN RATE</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
