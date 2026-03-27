"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheckCircle, ChevronDown, LoaderCircle, Upload } from "lucide-react";

import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { RaceBadge } from "@/components/shared/race-badge";
import { CURRENT_USER_CHANGE_EVENT } from "@/components/shell/current-user-chip";
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card";
import { DashboardStatsTable } from "@/components/dashboard/dashboard-stats-table";
import { previewReplayUpload, submitReplayUpload } from "@/lib/api/actions";
import { CYAN_PANEL_STYLE, INNER_PANEL_STRONG_STYLE, INNER_PANEL_STYLE } from "@/lib/constants/ui-styles";
import { buildApiUrl } from "@/lib/api/url";
import { buildCurrentUserSessionDocumentCookie } from "@/lib/utils/current-user-session";
import { formatStartTime } from "@/lib/utils/format";
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

function formatPreviewItemLine(item: DashboardPreviewSummary["items"][number]): string {
  const base = item.ok ? `OK ${item.filename}` : `FAIL ${item.filename}`;

  if (!item.ok) {
    return `${base} - ${item.error ?? "parse failed"}`;
  }

  return `${base} - map: ${item.mapName} - start: ${formatStartTime(item.startTime)} - players(${item.playerCount}): ${
    item.parsedPlayers.length ? item.parsedPlayers.join(", ") : "none"
  }`;
}

function formatPreviewTerminal(summary: DashboardPreviewSummary | null, statusMessage: string): string {
  if (!summary) {
    return statusMessage;
  }

  return [
    statusMessage,
    `files: ${summary.totalFiles}, success: ${summary.successCount}, fail: ${summary.failedCount}`,
    `common players: ${summary.commonPlayers.length ? summary.commonPlayers.join(", ") : "none"}`,
    ...summary.items.map((item) => formatPreviewItemLine(item))
  ].join("\n");
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

export function DashboardPage({ model }: { model: DashboardPageModel }) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingCommonPlayers, setPendingCommonPlayers] = useState<string[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [currentUser, setCurrentUser] = useState(model.currentUser);
  const [previewState, setPreviewState] = useState<DashboardActionStatus>("idle");
  const [previewSummary, setPreviewSummary] = useState<DashboardPreviewSummary | null>(null);
  const [uploadState, setUploadState] = useState<DashboardActionStatus>("idle");
  const [uploadStatusMessage, setUploadStatusMessage] = useState("READY");
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
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
  const selectablePlayers = previewSummary
    ? previewSummary.commonPlayers
    : [...new Set([selectedPlayer, ...model.uploadCandidates].filter(Boolean))];
  const uploadReady = pendingFiles.length > 0;

  function persistCurrentUser(nextUser: string, options?: { refresh?: boolean }) {
    const normalized = nextUser.trim();
    setCurrentUser(normalized);
    if (typeof window !== "undefined") {
      if (normalized) {
        window.localStorage.setItem("stareplays_current_user", normalized);
      } else {
        window.localStorage.removeItem("stareplays_current_user");
      }
    }
    if (typeof document !== "undefined" && normalized) {
      document.cookie = buildCurrentUserSessionDocumentCookie(normalized);
    }
    if (typeof window !== "undefined" && normalized) {
      window.dispatchEvent(new CustomEvent(CURRENT_USER_CHANGE_EVENT, { detail: normalized }));
    }
    if (normalized) {
      router.replace(`${pathname || "/"}?currentUser=${encodeURIComponent(normalized)}`);
      if (options?.refresh) {
        router.refresh();
      }
    }
  }

  useEffect(() => {
    if (currentUser.trim() || typeof window === "undefined") {
      return;
    }

    const restoredUser = String(window.localStorage.getItem("stareplays_current_user") || "").trim();
    if (!restoredUser) {
      return;
    }

    setQueryName(restoredUser);
    setSelectedPlayer(restoredUser);
    persistCurrentUser(restoredUser, { refresh: true });
  }, [currentUser]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []);
    setSelectedFiles(nextFiles);
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
    setUploadState("idle");
    setUploadErrorMessage(null);
    setUploadSummary(null);
    setUploadStatusMessage(`ANALYZING ${selectedFiles.length} FILE(S)...`);

    try {
      const result = (await previewReplayUpload(selectedFiles, { fetchImpl: fetch })) as ApiReplayPreviewResponse;
      const summary = createPreviewSummary(result);
      setPreviewSummary(summary);
      setPreviewState("success");
      setPendingFiles(selectedFiles);
      setPendingCommonPlayers(summary.commonPlayers);
      setUploadStatusMessage(`ANALYZE_OK: ${summary.successCount}/${summary.totalFiles} files`);

      const normalizedCurrentUser = currentUser.trim().toLowerCase();
      const matchedCurrentUser = normalizedCurrentUser
        ? summary.commonPlayers.find((player) => player.trim().toLowerCase() === normalizedCurrentUser)
        : null;

      if (matchedCurrentUser) {
        setSelectedPlayer(matchedCurrentUser);
      } else if (!currentUser.trim() && summary.commonPlayers.length === 1) {
        const preferredPlayer = summary.commonPlayers[0];
        setSelectedPlayer(preferredPlayer);
        persistCurrentUser(preferredPlayer);
      } else {
        setSelectedPlayer("");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "preview failed";
      setPreviewState("error");
      setUploadStatusMessage(`ANALYZE_FAIL: ${message}`);
    }
  }

  async function handleUpload() {
    const normalizedCurrentUser = currentUser.trim();

    if (!normalizedCurrentUser) {
      setUploadState("error");
      setUploadErrorMessage("select user first (simple login)");
      setUploadStatusMessage("UPLOAD_FAIL: select user first (simple login)");
      return;
    }

    if (pendingFiles.length === 0) {
      setUploadState("error");
      setUploadErrorMessage("analyze replay first");
      setUploadStatusMessage("UPLOAD_FAIL: analyze replay first");
      return;
    }

    if (pendingCommonPlayers.length === 0) {
      setUploadState("error");
      setUploadErrorMessage("no common participant across analyzed files");
      setUploadStatusMessage("UPLOAD_FAIL: no common participant across analyzed files");
      return;
    }

    const isCurrentUserCommon = pendingCommonPlayers.some(
      (player) => player.trim().toLowerCase() === normalizedCurrentUser.toLowerCase()
    );

    if (!isCurrentUserCommon) {
      setUploadState("error");
      setUploadErrorMessage(`'${normalizedCurrentUser}' is not a common participant in current analyzed files`);
      setUploadStatusMessage(`UPLOAD_FAIL: '${normalizedCurrentUser}' is not a common participant in current analyzed files`);
      return;
    }

    setUploadState("submitting");
    setUploadErrorMessage(null);
    setUploadSummary(null);
    setUploadStatusMessage(`UPLOADING ${pendingFiles.length} FILE(S) AS ${normalizedCurrentUser}...`);

    try {
      const result = (await submitReplayUpload(pendingFiles, normalizedCurrentUser, { fetchImpl: fetch })) as ApiReplayUploadResponse;
      setUploadSummary(createUploadSummary(result, normalizedCurrentUser));
      setUploadState("success");
      setUploadErrorMessage(null);
      setUploadStatusMessage("UPLOAD_DONE: check terminal log");
      persistCurrentUser(normalizedCurrentUser, { refresh: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "upload failed";
      setUploadState("error");
      setUploadErrorMessage(message);
      setUploadStatusMessage(`UPLOAD_FAIL: ${message}`);
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
    persistCurrentUser(normalized, { refresh: true });
    setSelectedPlayer(normalized);

    try {
      const result = await fetchBrowserApiJson<ApiPlayerStatsResponse>(
        `/api/v1/players/${encodeURIComponent(normalized)}/stats`
      );
      setPlayerStats(createPlayerStatsModel(result, model.playerStats, normalized));
      setQueryState("success");
    } catch (error) {
      setQueryState("error");
      setQueryError(error instanceof Error ? error.message : "query failed");
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-4" aria-label="Replay Upload Workspace">
          <div className="rounded-xl p-5" style={CYAN_PANEL_STYLE}>
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

            <div
              className="mt-3 rounded-lg px-4 py-3"
              style={INNER_PANEL_STYLE}
            >
              {previewSummary ? (
                <div className="space-y-2 text-[11px] font-mono text-slate-300">
                  <div className="flex items-center gap-2 text-xs font-mono text-emerald-300">
                    <CheckCircle className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    <span>Analysis Completed</span>
                  </div>
                  <p className="text-slate-500">
                    files: {previewSummary.totalFiles}, success: {previewSummary.successCount}, fail: {previewSummary.failedCount}
                  </p>
                  <p className="text-slate-400">
                    common players: {previewSummary.commonPlayers.length ? previewSummary.commonPlayers.join(", ") : "none"}
                  </p>
                  <div className="space-y-2">
                    {previewSummary.items.map((item) => (
                      <div key={`${item.filename}-${item.startTime}`} className={item.ok ? "space-y-1 text-slate-300" : "space-y-1 text-red-300"}>
                        <div className="flex items-center gap-2">
                          <span>{item.ok ? "OK" : "FAIL"}</span>
                          <span>{item.filename}</span>
                        </div>
                        {item.ok ? (
                          <>
                            <p>
                              map: <span>{item.mapName}</span>
                            </p>
                            <p>
                              start: <span>{formatStartTime(item.startTime)}</span>
                            </p>
                            <p>
                              players({item.playerCount}):{" "}
                              <span>{item.parsedPlayers.length ? item.parsedPlayers.join(", ") : "none"}</span>
                            </p>
                          </>
                        ) : (
                          <p>
                            reason: <span>{item.error ?? "parse failed"}</span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                  {previewState === "submitting" ? <LoaderCircle className="h-4 w-4 animate-spin text-yellow-400" aria-hidden="true" /> : null}
                  <span>{previewState === "submitting" ? "ANALYZING REPLAY..." : "NO_PREVIEW"}</span>
                </div>
              )}
            </div>

            <pre
              className="mt-3 overflow-auto rounded-lg px-4 py-3 text-[11px] font-mono whitespace-pre-wrap"
              style={INNER_PANEL_STYLE}
            >
              <span>{formatPreviewTerminal(previewSummary, uploadStatusMessage)}</span>
            </pre>

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

            {uploadState === "error" && uploadErrorMessage ? (
              <p className="mt-2 text-[11px] font-mono text-red-300">{uploadErrorMessage}</p>
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
          <div className="rounded-xl p-5" style={CYAN_PANEL_STYLE}>
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
              <div className="rounded-xl p-5" style={CYAN_PANEL_STYLE}>
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

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <DashboardStatCard label="Win Rate" value={`${playerStats.winRate.toFixed(1)}%`} />
                  <DashboardStatCard label="Games" value={String(playerStats.games)} />
                  <DashboardStatCard label="Record" value={record} />
                  <DashboardStatCard
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

              <div className="rounded-xl p-5" style={CYAN_PANEL_STYLE}>
                <p className={SECTION_LABEL}>Win Rate Progress</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="mb-1.5 flex justify-between text-xs font-mono">
                      <span className="text-emerald-400">WIN {playerStats.wins}</span>
                      <span className="text-red-400">LOSS {playerStats.losses}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full" style={{ backgroundColor: INNER_PANEL_STYLE.backgroundColor }}>
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
