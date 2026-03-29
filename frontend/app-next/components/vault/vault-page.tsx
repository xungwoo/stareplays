"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

import { CYAN_PANEL_STYLE, CYAN_SECTION_DIVIDER_STYLE } from "@/lib/constants/ui-styles";
import { VaultDetailPanel, type VaultHydratedDetail, type VaultTechFocus, type VaultVizTab, createHydratedVaultDetail } from "@/components/vault/vault-detail-panel";
import { VaultGameRow } from "@/components/vault/vault-game-row";
import { createVaultPageModel } from "@/lib/adapters/vault";
import { buildApiUrl } from "@/lib/api/url";
import type { ApiGameDetailResponse, ApiGamesListResponse, ApiGetGameResponse } from "@/types/api";
import type { VaultPageModel } from "@/types/vault";

const CARD_STYLE = CYAN_PANEL_STYLE;
const LOGIN_REQUIRED_MESSAGE = "LOGIN_REQUIRED: SIMPLE_LOGIN 후 Recent_Games 조회 가능";
const NO_GAMES_FOUND_MESSAGE = "NO_GAMES_FOUND";

type VaultRuntimeModel = VaultPageModel & {
  page?: number;
  pageSize?: number;
  totalGames?: number;
  tableMessage?: string | null;
};

function getResolvedTableMessage(currentUser: string, runtimeModel: VaultRuntimeModel) {
  if (!currentUser) {
    return LOGIN_REQUIRED_MESSAGE;
  }

  return runtimeModel.tableMessage?.trim() || (runtimeModel.games.length === 0 ? NO_GAMES_FOUND_MESSAGE : null);
}

function getResolvedPageSize(runtimeModel: VaultRuntimeModel) {
  return Math.max(1, runtimeModel.pageSize ?? Math.max(runtimeModel.games.length, 1));
}

function getResolvedTotalGames(tableMessage: string | null, runtimeModel: VaultRuntimeModel) {
  return tableMessage ? 0 : Math.max(runtimeModel.games.length, runtimeModel.totalGames ?? runtimeModel.games.length);
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

export function VaultPage({ model }: { model: VaultPageModel }) {
  const runtimeModel = model as VaultRuntimeModel;
  const currentUser = model.currentUser.trim();
  const initialTableMessage = getResolvedTableMessage(currentUser, runtimeModel);
  const initialPageSize = getResolvedPageSize(runtimeModel);
  const initialTotalGames = getResolvedTotalGames(initialTableMessage, runtimeModel);
  const initialTotalPages = Math.max(1, Math.ceil(initialTotalGames / initialPageSize));
  const initialPage = Math.min(Math.max(1, runtimeModel.page ?? 1), initialTotalPages);
  const [games, setGames] = useState(model.games);
  const [tableMessage, setTableMessage] = useState<string | null>(initialTableMessage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [totalGames, setTotalGames] = useState(initialTotalGames);
  const [page, setPage] = useState(initialPage);
  const [isGamesLoading, setIsGamesLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailByGameId, setDetailByGameId] = useState<Record<number, VaultHydratedDetail>>({});
  const [detailStatusByGameId, setDetailStatusByGameId] = useState<Record<number, "idle" | "loading" | "success" | "error">>({});
  const [detailErrorByGameId, setDetailErrorByGameId] = useState<Record<number, string | null>>({});
  const [activeVizTab, setActiveVizTab] = useState<VaultVizTab>("apm");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [techFocus, setTechFocus] = useState<VaultTechFocus>(null);
  const [techEventInfo, setTechEventInfo] = useState<string | null>(null);
  const [highlightedPlayer, setHighlightedPlayer] = useState<string | null>(null);
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
  const totalPages = Math.max(1, Math.ceil(totalGames / pageSize));
  const expandedGame = expandedId == null ? null : games.find((game) => game.id === expandedId) ?? null;
  const expandedDetailStatus = expandedId == null ? null : detailStatusByGameId[expandedId] ?? null;

  async function loadGames(targetPage: number) {
    if (!currentUser) {
      return;
    }

    const nextPageSize = Math.max(1, pageSize);
    const requestedPage = Math.max(1, targetPage);
    const offset = (requestedPage - 1) * nextPageSize;
    setIsGamesLoading(true);

    try {
      const response = await fetchBrowserApiJson<ApiGamesListResponse>(
        `/api/v1/games?limit=${nextPageSize}&offset=${offset}&user_name=${encodeURIComponent(currentUser)}`
      );
      const nextModel = createVaultPageModel({
        currentUser,
        gamesResponse: response
      });
      const nextTableMessage = nextModel.games.length === 0 ? NO_GAMES_FOUND_MESSAGE : null;
      const nextTotalGames = nextTableMessage ? 0 : Math.max(nextModel.games.length, response.total ?? nextModel.games.length);
      const nextTotalPages = Math.max(1, Math.ceil(nextTotalGames / nextPageSize));

      setGames(nextModel.games);
      setTableMessage(nextTableMessage);
      setTotalGames(nextTotalGames);
      setPage(Math.min(requestedPage, nextTotalPages));
    } catch (error) {
      setGames([]);
      setTableMessage(error instanceof Error ? `ERROR_LOAD_GAMES: ${error.message}` : "ERROR_LOAD_GAMES: failed to load games");
      setTotalGames(0);
      setPage(1);
    } finally {
      setIsGamesLoading(false);
    }
  }

  function stickyTopOffset() {
    const nav = document.querySelector("nav.sticky");
    const navHeight = nav instanceof HTMLElement ? Math.ceil(nav.getBoundingClientRect().height) : 0;
    return navHeight + 8;
  }

  function syncSelectedRowViewport(gameId: number, force = false) {
    const sync = () => {
      const row = rowRefs.current[gameId];
      if (!row) {
        return;
      }

      const offset = stickyTopOffset();
      const rect = row.getBoundingClientRect();
      const needScroll = force || rect.top < offset || rect.top > offset + 40;
      if (!needScroll) {
        return;
      }

      const rowTopOnDoc = window.scrollY + rect.top;
      const targetTop = Math.max(0, rowTopOnDoc - offset);
      if (typeof globalThis.scrollTo === "function") {
        globalThis.scrollTo({ top: targetTop, behavior: "auto" });
      }
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(sync);
    });
  }

  useEffect(() => {
    if (expandedId != null && !games.some((game) => game.id === expandedId)) {
      setExpandedId(null);
    }
  }, [expandedId, games]);

  useEffect(() => {
    const nextTableMessage = getResolvedTableMessage(currentUser, runtimeModel);
    const nextPageSize = getResolvedPageSize(runtimeModel);
    const nextTotalGames = getResolvedTotalGames(nextTableMessage, runtimeModel);
    const nextTotalPages = Math.max(1, Math.ceil(nextTotalGames / nextPageSize));

    setGames(model.games);
    setTableMessage(nextTableMessage);
    setPageSize(nextPageSize);
    setTotalGames(nextTotalGames);
    setPage(Math.min(Math.max(1, runtimeModel.page ?? 1), nextTotalPages));
  }, [currentUser, model.games, runtimeModel]);

  useEffect(() => {
    if (!isFullscreen) {
      document.body.classList.remove("viz-fullscreen-lock");
      return undefined;
    }

    document.body.classList.add("viz-fullscreen-lock");

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("viz-fullscreen-lock");
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (expandedId == null) {
      return;
    }

    syncSelectedRowViewport(expandedId, true);
  }, [expandedId]);

  useEffect(() => {
    if (expandedId == null) {
      return;
    }

    if (expandedDetailStatus === "success" || expandedDetailStatus === "error") {
      syncSelectedRowViewport(expandedId, false);
    }
  }, [expandedDetailStatus, expandedId]);

  useEffect(() => {
    if (expandedId == null) {
      return;
    }

    let cancelled = false;
    setDetailStatusByGameId((previous) => ({ ...previous, [expandedId]: "loading" }));
    setDetailErrorByGameId((previous) => ({ ...previous, [expandedId]: null }));

    void Promise.all([
      fetchBrowserApiJson<ApiGetGameResponse>(`/api/v1/games/${expandedId}`),
      fetchBrowserApiJson<ApiGameDetailResponse>(`/api/v1/games/${expandedId}/detail`)
    ])
      .then(([gameResponse, detailResponse]) => {
        if (cancelled) {
          return;
        }
        setDetailByGameId((previous) => ({
          ...previous,
          [expandedId]: createHydratedVaultDetail(gameResponse, detailResponse)
        }));
        setDetailStatusByGameId((previous) => ({ ...previous, [expandedId]: "success" }));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setActiveVizTab("apm");
        setIsFullscreen(false);
        setTechFocus(null);
        setTechEventInfo(null);
        setHighlightedPlayer(null);
        setDetailByGameId((previous) => {
          if (!(expandedId in previous)) {
            return previous;
          }

          const next = { ...previous };
          delete next[expandedId];
          return next;
        });
        setDetailStatusByGameId((previous) => ({ ...previous, [expandedId]: "error" }));
        setDetailErrorByGameId((previous) => ({
          ...previous,
          [expandedId]: error instanceof Error ? error.message : "failed to load selected game detail"
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [expandedId]);

  const handleSelectGame = (gameId: number) => {
    setExpandedId((current) => {
      const next = current === gameId ? null : gameId;
      if (next !== current) {
        setActiveVizTab("apm");
        setIsFullscreen(false);
        setTechFocus(null);
        setTechEventInfo(null);
        setHighlightedPlayer(null);
        setDetailErrorByGameId((previous) => ({
          ...previous,
          [gameId]: null
        }));
        setDetailStatusByGameId((previous) => ({
          ...previous,
          [gameId]: next == null ? "idle" : "loading"
        }));
      }
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-5 rounded-sm" style={{ backgroundColor: "#22d3ee" }} />
          <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-slate-200">Recent Games</h2>
        </div>

        <button
          type="button"
          onClick={() => {
            void loadGames(page);
          }}
          disabled={isGamesLoading || !currentUser}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 transition-all hover:text-slate-200"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <RefreshCw className="h-3 w-3" />
          REFRESH
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={CARD_STYLE}>
        <table className="w-full table-fixed text-xs font-mono text-slate-300">
          <colgroup>
            <col style={{ width: "50px" }} />
            <col />
            <col style={{ width: "80px" }} />
            <col style={{ width: "2fr" }} />
            <col style={{ width: "2fr" }} />
            <col style={{ width: "100px" }} />
            <col style={{ width: "80px" }} />
            <col style={{ width: "1fr" }} />
          </colgroup>
          <thead style={{ backgroundColor: "#081428", ...CYAN_SECTION_DIVIDER_STYLE }}>
            <tr className="text-[10px] uppercase tracking-widest text-slate-600">
              <th className="px-4 py-2.5 text-left">#ID</th>
              <th className="px-4 py-2.5 text-left">MAP_NAME</th>
              <th className="px-4 py-2.5 text-left">MATCHUP</th>
              <th className="px-4 py-2.5 text-left">OUR_TEAM</th>
              <th className="px-4 py-2.5 text-left">ENEMY_TEAM</th>
              <th className="px-4 py-2.5 text-left">ANALYZER</th>
              <th className="px-4 py-2.5 text-left">PLAY_TIME</th>
              <th className="px-4 py-2.5 text-left">START_TIME</th>
            </tr>
          </thead>
          <tbody>
            {tableMessage ? (
              <tr>
                <td colSpan={8} className="p-3 text-center text-[11px] text-slate-500">
                  {tableMessage}
                </td>
              </tr>
            ) : (
              games.map((game) => (
                <Fragment key={game.id}>
                  <VaultGameRow
                    game={game}
                    isExpanded={expandedId === game.id}
                    onToggle={() => handleSelectGame(game.id)}
                    rowRef={(node) => {
                      rowRefs.current[game.id] = node;
                    }}
                  />
                  {expandedId === game.id ? (
                    <tr data-testid="vault-inline-detail-row" className="border-b" style={{ borderColor: "rgba(34,211,238,0.12)" }}>
                      <td colSpan={8} className="p-3">
                        {expandedGame ? (
                          <VaultDetailPanel
                            game={expandedGame}
                            currentUser={currentUser}
                            hydratedDetail={detailByGameId[expandedId]}
                            isHydrating={expandedDetailStatus === "loading"}
                            hydrateError={expandedDetailStatus === "error" ? detailErrorByGameId[expandedId] ?? "failed to load selected game detail" : null}
                            activeVizTab={activeVizTab}
                            isFullscreen={isFullscreen}
                            techFocus={techFocus}
                            techEventInfo={techEventInfo}
                            highlightedPlayer={highlightedPlayer}
                            onActiveVizTabChange={(tab) => {
                              setActiveVizTab(tab);
                              if (tab !== "tech") {
                                setTechEventInfo(null);
                              }
                            }}
                            onFullscreenToggle={() => setIsFullscreen((current) => !current)}
                            onTechFocusChange={(focus) => {
                              setTechFocus(focus);
                              setHighlightedPlayer(focus?.playerName ?? null);
                              setTechEventInfo(focus ? "TECH_EVENT: CLICK_MARKER_TO_VIEW" : null);
                            }}
                            onTechEventInfoChange={setTechEventInfo}
                            onHighlightedPlayerChange={(playerName) => {
                              setHighlightedPlayer(playerName);
                            }}
                          />
                        ) : (
                          <div
                            className="rounded-xl px-5 py-4 text-xs font-mono text-slate-400"
                            style={{ backgroundColor: "#080e1f", border: "1px solid rgba(34,211,238,0.12)" }}
                          >
                            FETCHING_GAME...
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>

        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <button
            type="button"
            onClick={() => {
              if (page <= 1 || isGamesLoading) {
                return;
              }

              void loadGames(page - 1);
            }}
            disabled={page <= 1 || totalGames === 0 || isGamesLoading}
            className="rounded px-4 py-1.5 text-xs font-mono transition-all hover:bg-slate-800 disabled:opacity-30"
            style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}
          >
            Prev
          </button>
          <span className="text-xs font-mono text-slate-500">
            Page {page}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() => {
              if (page >= totalPages || totalGames === 0 || isGamesLoading) {
                return;
              }

              void loadGames(page + 1);
            }}
            disabled={page >= totalPages || totalGames === 0 || isGamesLoading}
            className="rounded px-4 py-1.5 text-xs font-mono transition-all hover:bg-slate-800 disabled:opacity-30"
            style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
