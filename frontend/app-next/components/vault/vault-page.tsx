"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { CYAN_PANEL_STYLE, CYAN_SECTION_DIVIDER_STYLE, INNER_PANEL_STYLE } from "@/lib/constants/ui-styles";
import { VaultDetailPanel, type VaultHydratedDetail, type VaultTechFocus, type VaultVizTab, createHydratedVaultDetail } from "@/components/vault/vault-detail-panel";
import { VaultGameRow } from "@/components/vault/vault-game-row";
import { buildApiUrl } from "@/lib/api/url";
import type { ApiGameDetailResponse, ApiGetGameResponse } from "@/types/api";
import type { VaultPageModel } from "@/types/vault";

const CARD_STYLE = CYAN_PANEL_STYLE;

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
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [detailByGameId, setDetailByGameId] = useState<Record<number, VaultHydratedDetail>>({});
  const [detailStatusByGameId, setDetailStatusByGameId] = useState<Record<number, "idle" | "loading" | "success" | "error">>({});
  const [detailErrorByGameId, setDetailErrorByGameId] = useState<Record<number, string | null>>({});
  const [activeVizTab, setActiveVizTab] = useState<VaultVizTab>("apm");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [techFocus, setTechFocus] = useState<VaultTechFocus>(null);
  const [highlightedPlayer, setHighlightedPlayer] = useState<string | null>(null);
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(model.games.length / pageSize));
  const pageGames = model.games.slice((page - 1) * pageSize, page * pageSize);
  const currentUserHref = `/vault?currentUser=${encodeURIComponent(model.currentUser)}`;

  useEffect(() => {
    if (expandedId != null && !model.games.some((game) => game.id === expandedId)) {
      setExpandedId(null);
    }
  }, [expandedId, model.games]);

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
          <span className="rounded px-2 py-1 text-[10px] font-mono font-bold" style={{ backgroundColor: "rgba(34,211,238,0.08)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.18)" }}>
            CURRENT_USER: {model.currentUser}
          </span>
        </div>

        <Link
          href={currentUserHref}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 transition-all hover:text-slate-200"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <RefreshCw className="h-3 w-3" />
          REFRESH
        </Link>
      </div>

      <div className="rounded-xl overflow-hidden" style={CARD_STYLE}>
        <div
          className="grid items-center gap-4 px-4 py-2.5"
          style={{
            gridTemplateColumns: "50px 1fr 80px 2fr 2fr 100px 80px 1fr",
            backgroundColor: "#081428",
            ...CYAN_SECTION_DIVIDER_STYLE
          }}
        >
          {["ID", "MAP_NAME", "MATCHUP", "OUR_TEAM", "ENEMY_TEAM", "ANALYZER", "TIME", "START_TIME"].map((header) => (
            <span key={header} className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-600">
              {header}
            </span>
          ))}
        </div>

        {pageGames.map((game) => (
          <VaultGameRow
            key={game.id}
            game={game}
            isExpanded={expandedId === game.id}
            onToggle={() => handleSelectGame(game.id)}
          />
        ))}

        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="rounded px-4 py-1.5 text-xs font-mono transition-all hover:bg-slate-800 disabled:opacity-30"
            style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}
          >
            Prev
          </button>
          <span className="text-xs font-mono text-slate-500">
            PAGE {page}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page === totalPages}
            className="rounded px-4 py-1.5 text-xs font-mono transition-all hover:bg-slate-800 disabled:opacity-30"
            style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}
          >
            Next
          </button>
        </div>
      </div>

      {expandedId != null
        ? (() => {
            const expandedGame =
              model.games.find((game) => game.id === expandedId) ??
              pageGames.find((game) => game.id === expandedId) ??
              null;

            if (!expandedGame) {
              return null;
            }

            if (detailStatusByGameId[expandedId] === "loading") {
              return (
                <div
                  className="mt-2 rounded-xl px-5 py-4 text-xs font-mono text-slate-400"
                  style={{ backgroundColor: "#080e1f", border: "1px solid rgba(34,211,238,0.12)" }}
                >
                  FETCHING_GAME...
                </div>
              );
            }

            return (
              <VaultDetailPanel
                game={expandedGame}
                currentUser={model.currentUser}
                hydratedDetail={detailByGameId[expandedId]}
                isHydrating={false}
                hydrateError={detailErrorByGameId[expandedId]}
                activeVizTab={activeVizTab}
                isFullscreen={isFullscreen}
                techFocus={techFocus}
                highlightedPlayer={highlightedPlayer}
                onActiveVizTabChange={setActiveVizTab}
                onFullscreenToggle={() => setIsFullscreen((current) => !current)}
                onTechFocusChange={(focus) => {
                  setTechFocus(focus);
                  setHighlightedPlayer(focus?.playerName ?? null);
                }}
              />
            );
          })()
        : null}
    </div>
  );
}
