"use client";

import Link from "next/link";
import { Fragment, type ChangeEvent, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheckCircle, ChevronDown, LoaderCircle, Upload } from "lucide-react";

import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { RaceBadge } from "@/components/shared/race-badge";
import { ResultBadge, StatusBadge } from "@/components/shared/status-badge";
import { CURRENT_USER_CHANGE_EVENT } from "@/components/shell/current-user-chip";
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card";
import { DashboardStatsTable } from "@/components/dashboard/dashboard-stats-table";
import { createVaultPageModel } from "@/lib/adapters/vault";
import { previewReplayUpload, submitReplayUpload } from "@/lib/api/actions";
import { VAULT_GAMES_FIXTURE } from "@/lib/fixtures/vault";
import { CYAN_PANEL_STYLE, INNER_PANEL_STRONG_STYLE, INNER_PANEL_STYLE } from "@/lib/constants/ui-styles";
import { buildApiUrl } from "@/lib/api/url";
import { buildCurrentUserSessionDocumentCookie } from "@/lib/utils/current-user-session";
import { getStartGridBoard } from "@/lib/utils/start-grid-board";
import { formatStartTime } from "@/lib/utils/format";
import type {
  ApiGameDetailResponse,
  ApiGamesListResponse,
  ApiGetGameResponse,
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
import type { VaultGame, VaultPlayer } from "@/types/vault";

const SECTION_LABEL = "text-[10px] font-mono font-semibold tracking-widest text-slate-500 uppercase mb-3";
const RECENT_GAMES_LOGIN_REQUIRED = "LOGIN_REQUIRED: SIMPLE_LOGIN 후 Recent_Games 조회 가능";
const RECENT_GAMES_PAGE_SIZE = 10;
const VIZ_TABS = [
  { id: "apm", label: "APM" },
  { id: "unitprod", label: "Unit_Production" },
  { id: "spend", label: "Resource_Spend" },
  { id: "production", label: "Production" },
  { id: "tech", label: "Tech" },
  { id: "battle", label: "Battle" },
  { id: "actions", label: "Actions" }
] as const;

type DashboardVizTab = (typeof VIZ_TABS)[number]["id"];

interface DashboardGameDetailModel {
  analysisMessage: string | null;
  reliabilityLabel: string;
  replayFileCount: number;
}

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

function clonePlayerForCurrentUser(player: VaultPlayer, currentUser: string): VaultPlayer {
  return {
    ...player,
    isCurrentUser: player.name.trim().toLowerCase() === currentUser.trim().toLowerCase()
  };
}

function buildFallbackRecentGames(currentUser: string): VaultGame[] {
  const normalized = currentUser.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return VAULT_GAMES_FIXTURE.map((game) => ({
    ...game,
    winnerTeam: game.winnerTeam.map((player) => clonePlayerForCurrentUser(player, currentUser)),
    loserTeam: game.loserTeam.map((player) => clonePlayerForCurrentUser(player, currentUser))
  })).filter((game) => {
    return [...game.winnerTeam, ...game.loserTeam].some((player) => player.name.trim().toLowerCase() === normalized);
  });
}

function buildGameDetailModel(gameResponse: ApiGetGameResponse, detailResponse: ApiGameDetailResponse): DashboardGameDetailModel {
  return {
    analysisMessage: detailResponse.analysis_status?.user_message?.trim() || null,
    reliabilityLabel: [
      gameResponse.reliability_m_of_n?.trim(),
      gameResponse.reliability?.trim()
    ]
      .filter(Boolean)
      .join(" | ") || "UNAVAILABLE",
    replayFileCount: gameResponse.game?.edges?.replay_files?.length ?? 0
  };
}

function getRecentGameTeams(game: VaultGame) {
  const currentUserWinner = game.winnerTeam.some((player) => player.isCurrentUser);
  const currentUserLoser = game.loserTeam.some((player) => player.isCurrentUser);

  if (currentUserWinner) {
    return {
      ourTeam: game.winnerTeam,
      enemyTeam: game.loserTeam,
      ourResult: "WINNER" as const,
      enemyResult: "LOSER" as const
    };
  }

  if (currentUserLoser) {
    return {
      ourTeam: game.loserTeam,
      enemyTeam: game.winnerTeam,
      ourResult: "LOSER" as const,
      enemyResult: "WINNER" as const
    };
  }

  return {
    ourTeam: game.winnerTeam,
    enemyTeam: game.loserTeam,
    ourResult: "WINNER" as const,
    enemyResult: "LOSER" as const
  };
}

function formatRaceComposition(team: VaultPlayer[]): string {
  return team.map((player) => player.race).join("");
}

function getVizPanelSummary(game: VaultGame, detail: DashboardGameDetailModel | null, activeVizTab: DashboardVizTab): string {
  const allPlayers = [...game.winnerTeam, ...game.loserTeam];
  const topApmPlayer = allPlayers.slice().sort((left, right) => right.apm - left.apm)[0];
  const topProductionPlayer = allPlayers.slice().sort((left, right) => right.production - left.production)[0];
  const totalWinnerApm = game.winnerTeam.reduce((sum, player) => sum + player.apm, 0);
  const totalLoserApm = game.loserTeam.reduce((sum, player) => sum + player.apm, 0);

  switch (activeVizTab) {
    case "apm":
      return `Top APM: ${topApmPlayer?.name ?? "-"} (${topApmPlayer?.apm ?? 0})`;
    case "unitprod":
      return `Production leader: ${topProductionPlayer?.name ?? "-"} (${topProductionPlayer?.production ?? 0})`;
    case "spend":
      return `Team pressure: WIN ${totalWinnerApm} / LOSS ${totalLoserApm}`;
    case "production":
      return `Replay files: ${detail?.replayFileCount ?? 0}`;
    case "tech":
      return `Reliability: ${detail?.reliabilityLabel ?? "UNAVAILABLE"}`;
    case "battle":
      return detail?.analysisMessage || game.matchStory;
    case "actions":
      return `Analyzer: ${game.analyzerStatus} | Key: ${game.keyPlayer ?? "-"}`;
    default:
      return game.matchStory;
  }
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
  const [recentGames, setRecentGames] = useState<VaultGame[]>(() =>
    model.currentUser.trim() ? buildFallbackRecentGames(model.currentUser) : []
  );
  const [recentGamesTotal, setRecentGamesTotal] = useState(() =>
    model.currentUser.trim() ? buildFallbackRecentGames(model.currentUser).length : 0
  );
  const [gamesState, setGamesState] = useState<DashboardActionStatus>(model.currentUser.trim() ? "success" : "idle");
  const [gamesError, setGamesError] = useState<string | null>(model.currentUser.trim() ? null : RECENT_GAMES_LOGIN_REQUIRED);
  const [recentGamesPage, setRecentGamesPage] = useState(1);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [gameDetailById, setGameDetailById] = useState<Record<number, DashboardGameDetailModel>>({});
  const [gameDetailStateById, setGameDetailStateById] = useState<Record<number, DashboardActionStatus>>({});
  const [activeVizTab, setActiveVizTab] = useState<DashboardVizTab>("apm");
  const [isDetailFullscreen, setIsDetailFullscreen] = useState(false);
  const [systemLogs, setSystemLogs] = useState<string[]>(model.currentUser.trim() ? ["READY"] : ["READY", RECENT_GAMES_LOGIN_REQUIRED]);
  const suggestionTimerRef = useRef<number | null>(null);
  const suggestionRequestRef = useRef(0);
  const queryRequestRef = useRef(0);
  const recentGamesRequestRef = useRef(0);
  const previewRequestRef = useRef(0);
  const uploadRequestRef = useRef(0);

  const selectedFile = selectedFiles[0] ?? null;
  const record = `${playerStats.wins}-${playerStats.losses}-${playerStats.draws}`;
  const currentUserNormalized = currentUser.trim();
  const selectablePlayers = previewSummary
    ? previewSummary.commonPlayers
    : [...new Set([selectedPlayer, ...model.uploadCandidates].filter(Boolean))];
  const uploadReady =
    pendingFiles.length > 0 &&
    Boolean(currentUserNormalized) &&
    pendingCommonPlayers.some((player) => player.trim().toLowerCase() === currentUserNormalized.toLowerCase());
  const selectedGame = selectedGameId != null ? recentGames.find((game) => game.id === selectedGameId) ?? null : null;
  const selectedGameDetail = selectedGameId != null ? gameDetailById[selectedGameId] ?? null : null;
  const selectedGameDetailState = selectedGameId != null ? gameDetailStateById[selectedGameId] ?? "idle" : "idle";
  const selectedGameBoard = selectedGame ? getStartGridBoard(selectedGame) : null;
  const recentGamesPageCount = Math.max(1, Math.ceil(recentGamesTotal / RECENT_GAMES_PAGE_SIZE));

  function appendSystemLog(entry: string) {
    setSystemLogs((previous) => [...previous, entry].slice(-24));
  }

  async function loadRecentGames(nextUser: string, trigger: string, page = 1) {
    const normalized = nextUser.trim();
    if (!normalized) {
      setRecentGames([]);
      setRecentGamesTotal(0);
      setGamesState("idle");
      setGamesError(RECENT_GAMES_LOGIN_REQUIRED);
      setRecentGamesPage(1);
      setSelectedGameId(null);
      appendSystemLog(RECENT_GAMES_LOGIN_REQUIRED);
      return;
    }

    const requestId = ++recentGamesRequestRef.current;
    setGamesState("submitting");
    setGamesError(null);
    appendSystemLog(`${trigger}: ${normalized}`);

    try {
      const offset = (page - 1) * RECENT_GAMES_PAGE_SIZE;
      const response = await fetchBrowserApiJson<ApiGamesListResponse>(
        `/api/v1/games?limit=${RECENT_GAMES_PAGE_SIZE}&offset=${offset}&user_name=${encodeURIComponent(normalized)}`
      );
      if (recentGamesRequestRef.current !== requestId) {
        return;
      }
      const games = createVaultPageModel({ currentUser: normalized, gamesResponse: response }).games;
      setRecentGames(games);
      setRecentGamesTotal(toNumber(response.total, games.length));
      setRecentGamesPage(page);
      setGamesState("success");
      setGamesError(null);
      setSelectedGameId((current) => (current != null && !games.some((game) => game.id === current) ? null : current));
      appendSystemLog(`LOAD_GAMES_OK: ${games.length} for ${normalized}`);
    } catch (error) {
      if (recentGamesRequestRef.current !== requestId) {
        return;
      }
      const message = error instanceof Error ? error.message : "failed to load recent games";
      setRecentGames([]);
      setRecentGamesTotal(0);
      setGamesState("error");
      setGamesError(`LOAD_GAMES_FAIL: ${message}`);
      setSelectedGameId(null);
      appendSystemLog(`LOAD_GAMES_FAIL: ${message}`);
    }
  }

  function persistCurrentUser(nextUser: string, options?: { refresh?: boolean }) {
    const normalized = nextUser.trim();
    const currentNormalized = currentUser.trim();

    if (normalized !== currentNormalized) {
      setRecentGamesPage(1);
      setSelectedGameId(null);
    }

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

  useEffect(() => {
    if (!currentUser.trim()) {
      setRecentGames([]);
      setRecentGamesTotal(0);
      setGamesState("idle");
      setGamesError(RECENT_GAMES_LOGIN_REQUIRED);
      setRecentGamesPage(1);
      setSelectedGameId(null);
      setSystemLogs((previous) =>
        previous.includes(RECENT_GAMES_LOGIN_REQUIRED) ? previous : [...previous, RECENT_GAMES_LOGIN_REQUIRED].slice(-24)
      );
      return;
    }

    const fallbackGames = buildFallbackRecentGames(currentUser);
    setRecentGames(fallbackGames);
    setRecentGamesTotal(fallbackGames.length);
    setRecentGamesPage(1);
    setSelectedGameId(null);
    void loadRecentGames(currentUser, "LOAD_GAMES", 1);
  }, [currentUser]);

  useEffect(() => {
    if (recentGamesPage > recentGamesPageCount) {
      setRecentGamesPage(recentGamesPageCount);
    }
  }, [recentGamesPage, recentGamesPageCount]);

  useEffect(() => {
    if (selectedGameId == null || gameDetailById[selectedGameId]) {
      return;
    }

    let cancelled = false;
    setGameDetailStateById((previous) => ({ ...previous, [selectedGameId]: "submitting" }));
    appendSystemLog(`FETCHING_GAME: #${selectedGameId}`);

    void Promise.all([
      fetchBrowserApiJson<ApiGetGameResponse>(`/api/v1/games/${selectedGameId}`),
      fetchBrowserApiJson<ApiGameDetailResponse>(`/api/v1/games/${selectedGameId}/detail`)
    ])
      .then(([gameResponse, detailResponse]) => {
        if (cancelled) {
          return;
        }
        setGameDetailById((previous) => ({
          ...previous,
          [selectedGameId]: buildGameDetailModel(gameResponse, detailResponse)
        }));
        setGameDetailStateById((previous) => ({ ...previous, [selectedGameId]: "success" }));
        appendSystemLog(`FETCH_GAME_OK: #${selectedGameId}`);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setGameDetailStateById((previous) => ({ ...previous, [selectedGameId]: "error" }));
        appendSystemLog(`FETCH_GAME_FAIL: #${selectedGameId} - ${error instanceof Error ? error.message : "unknown error"}`);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedGameId, gameDetailById]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDetailFullscreen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (!isDetailFullscreen) {
      document.body.classList.remove("viz-fullscreen-lock");
      return;
    }

    document.body.classList.add("viz-fullscreen-lock");
    return () => {
      document.body.classList.remove("viz-fullscreen-lock");
    };
  }, [isDetailFullscreen]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []);
    previewRequestRef.current += 1;
    uploadRequestRef.current += 1;
    setSelectedFiles(nextFiles);
    setPreviewState("idle");
    setPreviewSummary(null);
    setPendingFiles([]);
    setPendingCommonPlayers([]);
    setUploadState("idle");
    setUploadErrorMessage(null);
    setUploadSummary(null);
    setUploadStatusMessage("READY");
    setSelectedPlayer("");
  }

  function handlePlayerSelection(nextPlayer: string) {
    setSelectedPlayer(nextPlayer);
    if (nextPlayer.trim()) {
      appendSystemLog(`SELECT_USER: ${nextPlayer}`);
      persistCurrentUser(nextPlayer);
    }
  }

  async function handlePreview() {
    if (selectedFiles.length === 0) {
      return;
    }

    const requestId = ++previewRequestRef.current;
    uploadRequestRef.current += 1;
    setPreviewState("submitting");
    setUploadState("idle");
    setUploadErrorMessage(null);
    setUploadSummary(null);
    setUploadStatusMessage(`ANALYZING ${selectedFiles.length} FILE(S)...`);
    appendSystemLog(`ANALYZE_REPLAY: ${selectedFiles.length} file(s)`);

    try {
      const result = (await previewReplayUpload(selectedFiles, { fetchImpl: fetch })) as ApiReplayPreviewResponse;
      if (previewRequestRef.current !== requestId) {
        return;
      }
      const summary = createPreviewSummary(result);
      setPreviewSummary(summary);
      setPreviewState("success");
      setPendingFiles(selectedFiles);
      setPendingCommonPlayers(summary.commonPlayers);
      setUploadStatusMessage(`ANALYZE_OK: ${summary.successCount}/${summary.totalFiles} files`);
      appendSystemLog(`ANALYZE_OK: ${summary.successCount}/${summary.totalFiles} files`);

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
      if (previewRequestRef.current !== requestId) {
        return;
      }
      const message = error instanceof Error ? error.message : "preview failed";
      setPreviewState("error");
      setUploadStatusMessage(`ANALYZE_FAIL: ${message}`);
      appendSystemLog(`ANALYZE_FAIL: ${message}`);
    }
  }

  async function handleUpload() {
    const normalizedCurrentUser = currentUser.trim();

    if (!normalizedCurrentUser) {
      setUploadState("error");
      setUploadErrorMessage("select user first (simple login)");
      setUploadStatusMessage("UPLOAD_FAIL: select user first (simple login)");
      appendSystemLog("UPLOAD_FAIL: select user first (simple login)");
      return;
    }

    if (pendingFiles.length === 0) {
      setUploadState("error");
      setUploadErrorMessage("analyze replay first");
      setUploadStatusMessage("UPLOAD_FAIL: analyze replay first");
      appendSystemLog("UPLOAD_FAIL: analyze replay first");
      return;
    }

    if (pendingCommonPlayers.length === 0) {
      setUploadState("error");
      setUploadErrorMessage("no common participant across analyzed files");
      setUploadStatusMessage("UPLOAD_FAIL: no common participant across analyzed files");
      appendSystemLog("UPLOAD_FAIL: no common participant across analyzed files");
      return;
    }

    const isCurrentUserCommon = pendingCommonPlayers.some(
      (player) => player.trim().toLowerCase() === normalizedCurrentUser.toLowerCase()
    );

    if (!isCurrentUserCommon) {
      setUploadState("error");
      setUploadErrorMessage(`'${normalizedCurrentUser}' is not a common participant in current analyzed files`);
      setUploadStatusMessage(`UPLOAD_FAIL: '${normalizedCurrentUser}' is not a common participant in current analyzed files`);
      appendSystemLog(`UPLOAD_FAIL: '${normalizedCurrentUser}' is not a common participant in current analyzed files`);
      return;
    }

    const requestId = ++uploadRequestRef.current;
    setUploadState("submitting");
    setUploadErrorMessage(null);
    setUploadSummary(null);
    setUploadStatusMessage(`UPLOADING ${pendingFiles.length} FILE(S) AS ${normalizedCurrentUser}...`);
    appendSystemLog(`UPLOAD_START: ${normalizedCurrentUser}`);

    try {
      const result = (await submitReplayUpload(pendingFiles, normalizedCurrentUser, { fetchImpl: fetch })) as ApiReplayUploadResponse;
      if (uploadRequestRef.current !== requestId) {
        return;
      }
      const summary = createUploadSummary(result, normalizedCurrentUser);
      setUploadSummary(summary);
      setUploadState("success");
      setUploadErrorMessage(null);
      setUploadStatusMessage("UPLOAD_DONE: check terminal log");
      appendSystemLog("UPLOAD_DONE: check terminal log");
      persistCurrentUser(normalizedCurrentUser, { refresh: true });
      if (summary.uploadedGameId != null) {
        setSelectedGameId(summary.uploadedGameId);
      }
      void loadRecentGames(normalizedCurrentUser, "UPLOAD_REFRESH", 1);
    } catch (error) {
      if (uploadRequestRef.current !== requestId) {
        return;
      }
      const message = error instanceof Error ? error.message : "upload failed";
      setUploadState("error");
      setUploadErrorMessage(message);
      setUploadStatusMessage(`UPLOAD_FAIL: ${message}`);
      appendSystemLog(`UPLOAD_FAIL: ${message}`);
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
      setQuerySuggestions([]);
      return;
    }

    setQuerySuggestions([]);
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
        setQuerySuggestions((result.users ?? []).map((suggestion) => String(suggestion).trim()).filter(Boolean));
      } catch {
        if (suggestionRequestRef.current !== requestId) {
          return;
        }
        setQuerySuggestions([]);
        appendSystemLog(`SUGGEST_FAIL: ${normalized}`);
      }
    }, 280);
  }

  async function handleQuery() {
    const normalized = queryName.trim();
    if (!normalized) {
      return;
    }

    const requestId = ++queryRequestRef.current;
    setQueryState("submitting");
    setQueryError(null);
    appendSystemLog(`QUERY_PLAYER: ${normalized}`);
    persistCurrentUser(normalized, { refresh: true });
    setSelectedPlayer(normalized);

    try {
      const result = await fetchBrowserApiJson<ApiPlayerStatsResponse>(
        `/api/v1/players/${encodeURIComponent(normalized)}/stats`
      );
      if (queryRequestRef.current !== requestId) {
        return;
      }
      setPlayerStats(createPlayerStatsModel(result, model.playerStats, normalized));
      setQueryState("success");
      appendSystemLog(`QUERY_OK: ${normalized}`);
    } catch (error) {
      if (queryRequestRef.current !== requestId) {
        return;
      }
      setQueryState("error");
      setQueryError(error instanceof Error ? error.message : "query failed");
      appendSystemLog(`QUERY_FAIL: ${error instanceof Error ? error.message : "query failed"}`);
    }
  }

  function handleRefreshGames() {
    void loadRecentGames(currentUser, "REFRESH_GAMES", recentGamesPage);
  }

  function handleRecentGamesPageChange(nextPage: number) {
    if (nextPage === recentGamesPage) {
      return;
    }

    void loadRecentGames(currentUser, "PAGE_GAMES", nextPage);
  }

  function handleToggleSelectedGame(gameId: number) {
    if (selectedGameId === gameId) {
      setIsDetailFullscreen(false);
      setSelectedGameId(null);
      appendSystemLog(`COLLAPSE_GAME: #${gameId}`);
      return;
    }

    setIsDetailFullscreen(false);
    setSelectedGameId(gameId);
    setActiveVizTab("apm");
    appendSystemLog(`SELECT_GAME: #${gameId}`);
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-5" aria-label="Replay Upload Workspace">
          <div className="rounded-xl p-5" style={CYAN_PANEL_STYLE}>
            <p className={SECTION_LABEL}>Replay_Upload</p>

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

            <div className="mt-4" data-testid="dashboard-upload-user-block">
              <p className={SECTION_LABEL}>Selected_User (Simple_Login)</p>
              <p className="mb-3 text-[10px] font-mono text-slate-600">플레이어 선택 (Simple Login)</p>
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

            <div
              data-testid="dashboard-preview-summary"
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
                  {uploadSummary ? (
                    <div className="border-t border-white/5 pt-3">
                      <p className="text-slate-400">
                        {uploadSummary.uploadedGameId
                          ? `uploaded game: #${uploadSummary.uploadedGameId}${uploadSummary.uploadedMapName ? ` - ${uploadSummary.uploadedMapName}` : ""}`
                          : "uploaded game: batch upload completed"}
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
              ) : (
                <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                  {previewState === "submitting" ? <LoaderCircle className="h-4 w-4 animate-spin text-yellow-400" aria-hidden="true" /> : null}
                  <span>{previewState === "submitting" ? "ANALYZING REPLAY..." : "NO_PREVIEW"}</span>
                </div>
              )}
            </div>

            <div
              data-testid="dashboard-upload-result"
              className="mt-3 rounded-lg px-4 py-3"
              style={INNER_PANEL_STYLE}
            >
              <pre className="overflow-auto whitespace-pre-wrap text-[11px] font-mono text-slate-300">
                {uploadErrorMessage ?? uploadStatusMessage}
              </pre>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-7" aria-label="Player Statistics Workspace">
          <div className="rounded-xl p-5" style={CYAN_PANEL_STYLE}>
            <p className={SECTION_LABEL}>Player_Stats_Query</p>
            <div className="flex gap-2">
              <input
                value={queryName}
                onChange={(event) => {
                  void handleQueryNameChange(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") {
                    return;
                  }

                  event.preventDefault();
                  void handleQuery();
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
            </>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <section className="rounded-xl p-5" style={CYAN_PANEL_STYLE} aria-label="Recent Games Workspace">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="h-5 w-1.5 rounded-sm" style={{ backgroundColor: "#22d3ee" }} aria-hidden="true" />
              <p className={SECTION_LABEL}>Recent_Games</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleRecentGamesPageChange(Math.max(1, recentGamesPage - 1))}
                disabled={recentGamesPage <= 1 || recentGames.length === 0}
                className="rounded border px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-widest text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.02)" }}
              >
                Prev
              </button>
              <span className="text-[11px] font-mono text-slate-500">{`Page ${recentGamesPage}/${recentGamesPageCount}`}</span>
              <button
                type="button"
                onClick={() => handleRecentGamesPageChange(Math.min(recentGamesPageCount, recentGamesPage + 1))}
                disabled={recentGamesPage >= recentGamesPageCount || recentGames.length === 0}
                className="rounded border px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-widest text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.02)" }}
              >
                Next
              </button>
              <button
                type="button"
                onClick={handleRefreshGames}
                className="rounded border px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-widest text-slate-400"
                style={{ borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.02)" }}
              >
                Refresh_Games
              </button>
            </div>
          </div>

          {!currentUser.trim() ? (
            <div className="mt-4 rounded-lg px-4 py-3 text-xs font-mono text-yellow-300" style={INNER_PANEL_STYLE}>
              {RECENT_GAMES_LOGIN_REQUIRED}
            </div>
          ) : recentGames.length === 0 ? (
            <div className="mt-4 rounded-lg px-4 py-3 text-xs font-mono text-slate-400" style={INNER_PANEL_STYLE}>
              {gamesState === "submitting" ? "LOADING_GAMES..." : gamesError ?? "NO_RECENT_GAMES"}
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <table className="w-full table-fixed text-xs font-mono text-slate-300">
                <thead style={{ backgroundColor: "#081428" }}>
                  <tr className="text-[10px] uppercase tracking-widest text-slate-600">
                    <th className="px-3 py-2 text-left">#ID</th>
                    <th className="px-3 py-2 text-left">MAP_NAME</th>
                    <th className="px-3 py-2 text-left">MATCHUP</th>
                    <th className="px-3 py-2 text-left">OUR_TEAM</th>
                    <th className="px-3 py-2 text-left">ENEMY_TEAM</th>
                    <th className="px-3 py-2 text-left">ANALYZER</th>
                    <th className="px-3 py-2 text-left">PLAY_TIME</th>
                    <th className="px-3 py-2 text-left">START_TIME</th>
                  </tr>
                </thead>
                <tbody>
                  {recentGames.map((game) => {
                    const { ourTeam, enemyTeam, ourResult, enemyResult } = getRecentGameTeams(game);
                    const isSelected = selectedGameId === game.id;

                    return (
                      <Fragment key={game.id}>
                        <tr
                          data-testid={`dashboard-game-row-${game.id}`}
                          className="border-t"
                          style={{
                            borderColor: "rgba(255,255,255,0.05)",
                            backgroundColor: isSelected ? "rgba(34,211,238,0.07)" : "transparent"
                          }}
                          onClick={() => handleToggleSelectedGame(game.id)}
                        >
                          <td className="px-3 py-3 align-top text-slate-500">
                            <button type="button" className="text-left" aria-label={`Open recent game ${game.id}`}>
                              #{game.id}
                            </button>
                          </td>
                          <td className="px-3 py-3 align-top">{game.map}</td>
                          <td className="px-3 py-3 align-top text-slate-400">{game.matchup}</td>
                          <td className="px-3 py-3 align-top">
                            <div className="flex flex-col gap-1">
                              <ResultBadge result={ourResult} />
                              {ourTeam.map((player) => (
                                <div key={`${game.id}-our-${player.name}`} className="flex items-center gap-1 text-[11px]">
                                  <RaceBadge race={player.race} />
                                  <span className={player.isCurrentUser ? "text-cyan-300" : "text-slate-300"}>{player.name}</span>
                                  {player.isCurrentUser ? <span className="text-[9px] text-cyan-500">YOU</span> : null}
                                  <span className="ml-auto text-slate-600">A:{player.apm} E:{player.eapm}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="flex flex-col gap-1">
                              <ResultBadge result={enemyResult} />
                              {enemyTeam.map((player) => (
                                <div key={`${game.id}-enemy-${player.name}`} className="flex items-center gap-1 text-[11px]">
                                  <RaceBadge race={player.race} />
                                  <span className="text-slate-300">{player.name}</span>
                                  <span className="ml-auto text-slate-600">A:{player.apm} E:{player.eapm}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <StatusBadge status={game.analyzerStatus} />
                          </td>
                          <td className="px-3 py-3 align-top text-slate-400">{game.playTime}</td>
                          <td className="px-3 py-3 align-top text-slate-500">{game.startTime}</td>
                        </tr>

                        {isSelected && selectedGame ? (
                          <tr data-testid="dashboard-inline-game-detail-row" className="border-t" style={{ borderColor: "rgba(34,211,238,0.12)" }}>
                            <td colSpan={8} className="p-4">
                              <div className="grid gap-4 lg:grid-cols-2">
                                <div className="rounded-lg px-4 py-3" style={INNER_PANEL_STYLE}>
                                  <div className="flex items-center justify-between gap-3">
                                    <p className={SECTION_LABEL}>Selected_Game</p>
                                    <Link
                                      href={`/analyzer?currentUser=${encodeURIComponent(currentUser)}&gameId=${selectedGame.id}`}
                                      className="rounded border px-3 py-1.5 text-[11px] font-mono font-bold text-slate-300"
                                      style={{ borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.02)" }}
                                    >
                                      Open_In_Analyzer
                                    </Link>
                                  </div>
                                  <div className="flex items-center justify-between gap-4 text-[11px] font-mono text-slate-400">
                                    <span>{`#${selectedGame.id} ${selectedGame.map}`}</span>
                                    <span>{selectedGame.startTime}</span>
                                  </div>
                                  <div className="mt-3 grid grid-cols-3 gap-3">
                                    {Array.from({ length: 3 }, (_, rowIndex) => {
                                      const leftEntry = selectedGameBoard?.leftColumn[rowIndex];
                                      const rightEntry = selectedGameBoard?.rightColumn[rowIndex];

                                      return (
                                        <Fragment key={`board-row-${rowIndex}`}>
                                          <div className="rounded-lg px-3 py-2" style={INNER_PANEL_STRONG_STYLE}>
                                            {leftEntry ? (
                                              <>
                                                <div className="flex items-center justify-between gap-2">
                                                  <div className="flex items-center gap-1.5">
                                                    <RaceBadge race={leftEntry.player.race} />
                                                    <span className="text-[11px] font-mono text-slate-200">{leftEntry.player.name}</span>
                                                  </div>
                                                  <ResultBadge result={leftEntry.result} />
                                                </div>
                                                <p className="mt-2 text-[10px] font-mono text-slate-400">
                                                  APM {leftEntry.player.apm} / EAPM {leftEntry.player.eapm}
                                                </p>
                                                <p className="text-[10px] font-mono text-slate-500">
                                                  CMD {leftEntry.player.cmd} / ECMD {leftEntry.player.ecmd}
                                                </p>
                                                <p className="text-[10px] font-mono text-slate-500">
                                                  EFFECTIVE {leftEntry.player.effective.toFixed(1)}% / PROD {leftEntry.player.production}
                                                </p>
                                                <p className="text-[10px] font-mono text-slate-500">
                                                  REDUNDANCY% {leftEntry.player.redundancy}
                                                </p>
                                              </>
                                            ) : null}
                                          </div>
                                          <div className="rounded-lg px-3 py-2 text-center" style={INNER_PANEL_STRONG_STYLE}>
                                            {rowIndex === 1 ? (
                                              <>
                                                <p className="text-xs font-mono text-cyan-300">{selectedGame.matchup}</p>
                                                <p className="mt-1 text-[10px] font-mono text-slate-500">
                                                  {formatRaceComposition(selectedGame.winnerTeam)} vs {formatRaceComposition(selectedGame.loserTeam)}
                                                </p>
                                                <p className="mt-2 text-[10px] font-mono text-slate-400">PLAY TIME {selectedGame.playTime}</p>
                                              </>
                                            ) : null}
                                          </div>
                                          <div className="rounded-lg px-3 py-2" style={INNER_PANEL_STRONG_STYLE}>
                                            {rightEntry ? (
                                              <>
                                                <div className="flex items-center justify-between gap-2">
                                                  <div className="flex items-center gap-1.5">
                                                    <RaceBadge race={rightEntry.player.race} />
                                                    <span className="text-[11px] font-mono text-slate-200">{rightEntry.player.name}</span>
                                                  </div>
                                                  <ResultBadge result={rightEntry.result} />
                                                </div>
                                                <p className="mt-2 text-[10px] font-mono text-slate-400">
                                                  APM {rightEntry.player.apm} / EAPM {rightEntry.player.eapm}
                                                </p>
                                                <p className="text-[10px] font-mono text-slate-500">
                                                  CMD {rightEntry.player.cmd} / ECMD {rightEntry.player.ecmd}
                                                </p>
                                                <p className="text-[10px] font-mono text-slate-500">
                                                  EFFECTIVE {rightEntry.player.effective.toFixed(1)}% / PROD {rightEntry.player.production}
                                                </p>
                                                <p className="text-[10px] font-mono text-slate-500">
                                                  REDUNDANCY% {rightEntry.player.redundancy}
                                                </p>
                                              </>
                                            ) : null}
                                          </div>
                                        </Fragment>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div
                                  data-testid="dashboard-viz-shell"
                                  data-fullscreen={isDetailFullscreen ? "true" : "false"}
                                  className="rounded-lg px-4 py-3 transition-all duration-200"
                                  style={{
                                    ...INNER_PANEL_STYLE,
                                    position: isDetailFullscreen ? "fixed" : "relative",
                                    inset: isDetailFullscreen ? "1rem" : undefined,
                                    zIndex: isDetailFullscreen ? 60 : "auto",
                                    overflow: isDetailFullscreen ? "auto" : undefined,
                                    maxHeight: isDetailFullscreen ? "calc(100vh - 2rem)" : undefined,
                                    boxShadow: isDetailFullscreen ? "0 30px 80px rgba(0,0,0,0.45)" : undefined
                                  }}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <p className={SECTION_LABEL}>Game_Detail_Visualization</p>
                                    <button
                                      type="button"
                                      onClick={() => setIsDetailFullscreen((current) => !current)}
                                      className="rounded border px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-widest"
                                      style={{
                                        borderColor: "rgba(34,211,238,0.3)",
                                        backgroundColor: isDetailFullscreen ? "rgba(34,211,238,0.16)" : "rgba(255,255,255,0.02)",
                                        color: isDetailFullscreen ? "#67e8f9" : "#94a3b8"
                                      }}
                                    >
                                      {isDetailFullscreen ? "Exit_Fullscreen" : "Fullscreen"}
                                    </button>
                                  </div>
                                  <div className="mt-3 space-y-3">
                                    <div className="rounded-lg px-3 py-3 text-[11px] font-mono text-slate-300" style={INNER_PANEL_STRONG_STYLE}>
                                      <p className={SECTION_LABEL}>analysis notice</p>
                                      <p>{selectedGameDetailState === "submitting" ? "FETCHING_GAME..." : selectedGameDetail?.analysisMessage || selectedGame.matchStory}</p>
                                      <p className="mt-2 text-slate-500">
                                        {selectedGameDetail ? selectedGameDetail.reliabilityLabel : "DETAIL_PENDING"}
                                      </p>
                                    </div>

                                    <div>
                                      <p className={SECTION_LABEL}>viz tab row</p>
                                      <div className="flex flex-wrap gap-2">
                                        {VIZ_TABS.map((tab) => (
                                          <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActiveVizTab(tab.id)}
                                            aria-pressed={activeVizTab === tab.id}
                                            data-active={activeVizTab === tab.id ? "true" : "false"}
                                            className="rounded border px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-widest"
                                            style={{
                                              borderColor: activeVizTab === tab.id ? "rgba(34,211,238,0.3)" : "rgba(255,255,255,0.08)",
                                              backgroundColor: activeVizTab === tab.id ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.02)",
                                              color: activeVizTab === tab.id ? "#67e8f9" : "#94a3b8"
                                            }}
                                          >
                                            {tab.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="rounded-lg px-3 py-3 text-[11px] font-mono text-slate-300" style={INNER_PANEL_STRONG_STYLE}>
                                      <p className={SECTION_LABEL}>chart canvas area</p>
                                      <p>{`Canvas shell for ${activeVizTab.toUpperCase()}`}</p>
                                    </div>

                                    <div className="rounded-lg px-3 py-3 text-[11px] font-mono text-slate-300" style={INNER_PANEL_STRONG_STYLE}>
                                      <p className={SECTION_LABEL}>legend row</p>
                                      <p>{selectedGame.winnerTeam.map((player) => player.name).join(", ")}</p>
                                    </div>

                                    <div className="rounded-lg px-3 py-3 text-[11px] font-mono text-slate-300" style={INNER_PANEL_STRONG_STYLE}>
                                      <p className={SECTION_LABEL}>hint row</p>
                                      <p>Tap a tab or use Escape to leave fullscreen.</p>
                                    </div>

                                    <div className="rounded-lg px-3 py-3 text-[11px] font-mono text-slate-300" style={INNER_PANEL_STRONG_STYLE}>
                                      <p className={SECTION_LABEL}>tech-event info row</p>
                                      <p>{selectedGameDetail ? selectedGameDetail.reliabilityLabel : selectedGame.analyzerStatus}</p>
                                    </div>

                                    <div className="rounded-lg px-3 py-3 text-[11px] font-mono text-slate-300" style={INNER_PANEL_STRONG_STYLE}>
                                      <p className={SECTION_LABEL}>summary area</p>
                                      <p>{getVizPanelSummary(selectedGame, selectedGameDetail, activeVizTab)}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl p-5" style={CYAN_PANEL_STYLE} aria-label="System Logs Workspace">
          <p className={SECTION_LABEL}>System_Logs</p>
          <pre
            data-testid="dashboard-system-logs"
            className="overflow-auto rounded-lg px-4 py-3 text-[11px] font-mono whitespace-pre-wrap text-slate-400"
            style={INNER_PANEL_STYLE}
          >
            {systemLogs.join("\n")}
          </pre>
        </section>
      </div>
    </div>
  );
}
