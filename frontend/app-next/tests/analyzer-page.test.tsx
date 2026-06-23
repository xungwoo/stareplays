import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { AnalyzerPlayerDeepDive } from "@/components/analyzer/analyzer-player-deep-dive";
import { AnalyzerTabs } from "@/components/analyzer/analyzer-tabs";
import { AnalyzerSummaryStrip } from "@/components/analyzer/analyzer-summary-strip";
import { AnalyzerPage as AnalyzerPageComponent } from "@/components/analyzer/analyzer-page";
import { reanalyzeAnalyzerGame } from "@/lib/api/actions";
import { getAnalyzerPageModel } from "@/lib/adapters/analyzer";
import { loadAnalyzerPageModel } from "@/lib/loaders/analyzer";
import type { AnalyzerPageModel } from "@/types/analyzer";

vi.mock("@/lib/api/actions", () => ({
  reanalyzeAnalyzerGame: vi.fn()
}));

const reanalyzeAnalyzerGameMock = vi.mocked(reanalyzeAnalyzerGame);

function createJsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

describe("analyzer page", () => {
  beforeEach(() => {
    reanalyzeAnalyzerGameMock.mockReset();
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders the figma analyzer workspace and switches timeline tabs", async () => {
    const { container } = render(<AnalyzerPageComponent model={getAnalyzerPageModel(48)} />);
    const user = userEvent.setup();

    expect(screen.getByText(/한 게임의 흐름과 플레이어별 분석을 함께 보는 상세 분석 화면/i)).toBeInTheDocument();
    expect(screen.getByText(/CURRENT_USER: 3x3_GG/i)).toBeInTheDocument();
    expect(screen.getByText(/^GAME SELECTOR$/i)).toBeInTheDocument();
    expect(screen.getByText(/^TIMELINE WORKSPACE$/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^economy$/i }));
    expect(screen.getByText(/replay_analyzer_status/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^tech$/i })).toBeInTheDocument();

    const apmTab = screen.getByRole("button", { name: /^apm$/i });
    await user.click(apmTab);
    expect(apmTab).toHaveStyle({
      backgroundColor: "rgba(34, 211, 238, 0.15)",
      color: "#22d3ee"
    });
    expect(container.querySelector(".recharts-responsive-container")?.parentElement).toHaveStyle({
      backgroundColor: "#1e293b",
      border: "1px solid rgba(226,232,240,0.08)"
    });

    expect(screen.getByRole("button", { name: /^Prev$/i })).toHaveStyle({
      border: "1px solid rgba(255,255,255,0.1)"
    });
    expect(screen.getByRole("link", { name: /refresh selected game/i })).toHaveAttribute("href", "/analyzer?currentUser=3x3_GG&gameId=48");
    expect(screen.getByText(/^GAME SELECTOR$/i).parentElement).toHaveStyle({
      borderBottom: "1px solid rgba(255,255,255,0.06)"
    });
    expect(screen.getByRole("button", { name: /^Prev$/i }).parentElement).toHaveStyle({
      borderTop: "1px solid rgba(255,255,255,0.05)"
    });
    expect(screen.getByText(/replay_analyzer_status/i).parentElement).toHaveStyle({
      backgroundColor: "#202c40",
      border: "1px solid rgba(226,232,240,0.1)"
    });
    expect(screen.getByText(/^PLAYER DEEP DIVE$/i).parentElement).toHaveStyle({
      backgroundColor: "#192234",
      border: "1px solid rgba(148,163,184,0.16)"
    });
    const highlightedPlayTime = screen
      .getAllByText(/\d+:\d+/)
      .find((element) => element.tagName === "SPAN" && element.className.includes("text-xl"));
    expect(highlightedPlayTime).toHaveStyle({
      color: "#22d3ee"
    });
    expect(screen.getByText(/^MATCH_STORY:$/i).parentElement).toHaveStyle({
      borderBottom: "1px solid rgba(255,255,255,0.05)"
    });
    expect(screen.getByText(/^MAP:$/i).parentElement?.parentElement).toHaveStyle({
      backgroundColor: "rgba(226,232,240,0.08)"
    });
  });

  it("omits the current-user filter when the analyzer loader receives an explicit empty user", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/games?")) {
        expect(url).not.toContain("user_name=");
        return createJsonResponse({
          total: 1,
          games: [
            {
              id: 48,
              map_name: "Legacy Ridge",
              winner_team: 1,
              game_length: 835,
              start_time: "2026-03-22T00:05:48Z",
              edges: {
                players: [
                  { name: "alpha", race: "P", team: 1, apm: 148, eapm: 126, cmd_count: 2050, effective_cmd_count: 1746, redundancy: 15 },
                  { name: "beta", race: "Z", team: 2, apm: 171, eapm: 161, cmd_count: 2354, effective_cmd_count: 2216, redundancy: 6 }
                ]
              }
            }
          ],
          analysis_statuses: { 48: "succeeded" }
        });
      }

      if (url.includes("/games/48/detail")) {
        return createJsonResponse({ detail: {}, tech_tree: {}, resource_spend: {}, unit_production: {} });
      }

      if (url.includes("/games/48/analyzer")) {
        return createJsonResponse({ status: "succeeded", result: { summary: { teams: [], players: [] }, analysis_phase: {}, match_flow: {}, player_timeseries: { players: [] } } });
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    const model = await loadAnalyzerPageModel({
      fetchImpl: fetchMock,
      apiBaseUrl: "http://127.0.0.1:3000",
      currentUser: ""
    });

    expect(model.currentUser).toBe("");
    expect(fetchMock).toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("user_name=");
  });

  it("loads analyzer games without a user filter when both query and cookie are absent", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/games?")) {
        expect(url).not.toContain("user_name=");
        return createJsonResponse({
          total: 1,
          games: [
            {
              id: 48,
              map_name: "Legacy Ridge",
              winner_team: 1,
              game_length: 835,
              start_time: "2026-03-22T00:05:48Z",
              edges: {
                players: [
                  { name: "alpha", race: "P", team: 1, apm: 148, eapm: 126, cmd_count: 2050, effective_cmd_count: 1746, redundancy: 15 },
                  { name: "beta", race: "Z", team: 2, apm: 171, eapm: 161, cmd_count: 2354, effective_cmd_count: 2216, redundancy: 6 }
                ]
              }
            }
          ],
          analysis_statuses: { 48: "succeeded" }
        });
      }

      if (url.includes("/games/48/detail")) {
        return createJsonResponse({ detail: {}, tech_tree: {}, resource_spend: {}, unit_production: {} });
      }

      if (url.includes("/games/48/analyzer")) {
        return createJsonResponse({ status: "succeeded", result: { summary: { teams: [], players: [] }, analysis_phase: {}, match_flow: {}, player_timeseries: { players: [] } } });
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    const model = await loadAnalyzerPageModel({
      fetchImpl: fetchMock,
      apiBaseUrl: "http://127.0.0.1:3000"
    });

    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("user_name=");
    expect(model.games).toHaveLength(1);
  });

  it("renders the legacy analyzer tab set instead of the figma-only tab labels", () => {
    render(<AnalyzerPageComponent model={getAnalyzerPageModel(48)} />);

    expect(screen.getByRole("button", { name: /^match flow$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^economy$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^apm$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^production$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^tech$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^combat$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^resource spend$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^unit production$/i })).not.toBeInTheDocument();
  });

  it("renders the extracted analyzer tab shell with the six legacy tabs", () => {
    const model = getAnalyzerPageModel(48);

    render(
      <AnalyzerTabs
        activeTab="match-flow"
        focusedPlayer={null}
        game={model.selectedGame}
        hiddenApmPlayers={{}}
        insight={model.insightsByGameId[model.selectedGame.id]}
        matchFlowResetKey="48-match-flow"
        onActiveTabChange={() => {}}
        onSelectPlayer={() => {}}
        onToggleApmPlayer={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: /^match flow$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^economy$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^apm$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^production$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^tech$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^combat$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^resource spend$/i })).not.toBeInTheDocument();
  });

  it("renders the extracted player deep dive with all-players and focused-player states", () => {
    const model = getAnalyzerPageModel(48);

    const { rerender } = render(
      <AnalyzerPlayerDeepDive
        game={model.selectedGame}
        insight={model.insightsByGameId[model.selectedGame.id]}
        focusedPlayer={null}
        onClearSelection={() => {}}
        onSelectPlayer={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: /all players/i })).toBeInTheDocument();
    expect(screen.getByText(/^all players$/i, { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText(/^key player$/i)).toBeInTheDocument();
    expect(screen.getAllByText("성우").length).toBeGreaterThan(0);
    expect(screen.getByText(/^worst impact$/i)).toBeInTheDocument();
    expect(screen.getAllByText("필균").length).toBeGreaterThan(0);

    rerender(
      <AnalyzerPlayerDeepDive
        game={model.selectedGame}
        insight={model.insightsByGameId[model.selectedGame.id]}
        focusedPlayer={model.selectedGame.winnerTeam[0]?.name ?? null}
        onClearSelection={() => {}}
        onSelectPlayer={() => {}}
      />
    );

    expect(screen.getByText(/^player read$/i)).toBeInTheDocument();
    expect(screen.getByText(/^tech$/i)).toBeInTheDocument();
  });

  it("uses text-first status refresh copy while preserving the last rendered analyzer status", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AnalyzerPageComponent model={getAnalyzerPageModel(48)} />);
    const user = userEvent.setup();

    expect(screen.getAllByText((_, element) => element?.textContent?.includes("REPLAY_ANALYZER_STATUS: DONE") ?? false).at(-1)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /refresh analyzer status/i }));

    expect(screen.getAllByText((_, element) => element?.textContent?.includes("REPLAY_ANALYZER_STATUS: DONE") ?? false).at(-1)).toBeInTheDocument();
    expect(screen.getByText(/REFRESHING_ANALYZER_STATUS\.\.\./i)).toBeInTheDocument();

    resolveFetch?.(createJsonResponse({ status: "running" }));

    await waitFor(() => expect(screen.queryByText(/REFRESHING_ANALYZER_STATUS\.\.\./i)).not.toBeInTheDocument());
    expect(screen.getAllByText((_, element) => element?.textContent?.includes("REPLAY_ANALYZER_STATUS: RUNNING") ?? false).at(-1)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/games/48/analyzer", expect.any(Object));
  });

  it("only refreshes analyzer status when the user explicitly clicks refresh", async () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const fetchMock = vi.fn(async () => createJsonResponse({ status: "running" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AnalyzerPageComponent model={getAnalyzerPageModel(48)} />);
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /refresh analyzer status/i }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/games/48/analyzer", expect.any(Object));
  });

  it("uses the legacy selector page size of 10 games", async () => {
    const base = getAnalyzerPageModel(48);
    const games = Array.from({ length: 11 }, (_, index) => ({
      ...base.games[0],
      id: 100 + index,
      map: `Map ${index + 1}`,
      startTime: `2026-03-${String((index % 9) + 10).padStart(2, "0")} 10:00`
    }));
    const model: AnalyzerPageModel = {
      ...base,
      games,
      selectedGame: games[0],
      insightsByGameId: Object.fromEntries(games.map((game) => [game.id, base.insightsByGameId[48]]))
    };

    render(<AnalyzerPageComponent model={model} />);
    const user = userEvent.setup();

    expect(screen.getByText(/^#100$/i)).toBeInTheDocument();
    expect(screen.getByText(/^#109$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^#110$/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    expect(screen.getByText(/^#110$/i)).toBeInTheDocument();
  });

  it("lets match-flow marker clicks focus and clear the shared selected-player state", async () => {
    render(<AnalyzerPageComponent model={getAnalyzerPageModel(48)} />);
    const user = userEvent.setup();

    const timelineEvent = screen.getByRole("button", { name: /Cybernetics Core/i });
    await user.click(timelineEvent);

    const deepDive = screen.getByText(/^PLAYER DEEP DIVE$/i).parentElement as HTMLElement;
    expect(within(deepDive).getByRole("button", { name: /성우/i })).toBeInTheDocument();
    expect(within(deepDive).getByText(/^PLAYER READ$/i)).toBeInTheDocument();

    await user.click(timelineEvent);

    expect(within(deepDive).getByText(/^All Players$/i, { selector: "p" })).toBeInTheDocument();
    expect(within(deepDive).getByText(/Click any player id in the 3x3 board, timeline, or tables to focus that player/i)).toBeInTheDocument();
  });

  it("matches the legacy apm hide-show toggle semantics", async () => {
    render(<AnalyzerPageComponent model={getAnalyzerPageModel(48)} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /^apm$/i }));

    const hidePlayerButton = screen.getByRole("button", { name: /^hide 성우$/i });
    await user.click(hidePlayerButton);
    expect(screen.getByRole("button", { name: /^show 성우$/i })).toBeInTheDocument();

    const deepDive = screen.getByText(/^PLAYER DEEP DIVE$/i).parentElement as HTMLElement;
    await user.click(within(deepDive).getByRole("button", { name: /성우/i }));
    expect(within(deepDive).getByText(/^PLAYER READ$/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^show 성우$/i }));
    expect(within(deepDive).getByText(/^All Players$/i, { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^hide 성우$/i })).toBeInTheDocument();
  });

  it("resets the match-flow timeline pager when a different game is selected", async () => {
    const base = getAnalyzerPageModel(48);
    const longTimeline = Array.from({ length: 25 }, (_, index) => ({
      time: `${String(index).padStart(2, "0")}:00`,
      event: `Marker ${index + 1}`,
      player: "3x3_GG",
      type: "BUILDING" as const,
      team: "WINNER" as const
    }));
    const model: AnalyzerPageModel = {
      ...base,
      games: base.games.slice(0, 2),
      selectedGame: base.games[0],
      timeline: longTimeline,
      insightsByGameId: {
        [base.games[0].id]: { ...base.insightsByGameId[base.games[0].id], timeline: longTimeline },
        [base.games[1].id]: { ...base.insightsByGameId[base.games[1].id], timeline: longTimeline }
      }
    };

    render(<AnalyzerPageComponent model={model} />);
    const user = userEvent.setup();

    await user.click(screen.getAllByRole("button", { name: "" })[1]);
    expect(screen.getByText(/13-24 \/ 25/i)).toBeInTheDocument();

    await user.click(screen.getByText(/^#47$/i));
    expect(screen.getByText(/1-12 \/ 25/i)).toBeInTheDocument();
  });

  it("renders spend, production, tech, and apm summaries in the focused player panel", async () => {
    render(<AnalyzerPageComponent model={getAnalyzerPageModel(48)} />);
    const user = userEvent.setup();
    const deepDive = screen.getByText(/^PLAYER DEEP DIVE$/i).parentElement as HTMLElement;

    await user.click(within(deepDive).getByRole("button", { name: /성우/i }));

    expect(within(deepDive).getByText(/^APM$/i)).toBeInTheDocument();
    expect(within(deepDive).getByText(/^PRODUCTION$/i)).toBeInTheDocument();
    expect(within(deepDive).getByText(/^SPEND$/i)).toBeInTheDocument();
    expect(within(deepDive).getByText(/^TECH$/i)).toBeInTheDocument();
  });

  it("lets the user manually reanalyze the selected game and shows status feedback", async () => {
    reanalyzeAnalyzerGameMock.mockResolvedValue({ ok: true, message: "reanalyze queued" });

    render(<AnalyzerPageComponent model={getAnalyzerPageModel(48)} />);
    const user = userEvent.setup();

    const reanalyzeButton = screen.getByRole("button", { name: /reanalyze selected game/i });
    expect(reanalyzeButton).toBeEnabled();

    await user.click(reanalyzeButton);

    expect(reanalyzeAnalyzerGameMock).toHaveBeenCalledWith(48, expect.any(Object));
    expect(await screen.findByText(/reanalyze queued/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /refresh/i })).toHaveAttribute("href", "/analyzer?currentUser=3x3_GG&gameId=48");
  });

  it("shows an error when the reanalyze request fails", async () => {
    reanalyzeAnalyzerGameMock.mockRejectedValue(new Error("reanalyze failed"));

    render(<AnalyzerPageComponent model={getAnalyzerPageModel(48)} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /reanalyze selected game/i }));

    expect(await screen.findByText(/reanalyze failed/i)).toBeInTheDocument();
  });

  it("falls back to a queued message when reanalyze succeeds with no body", async () => {
    reanalyzeAnalyzerGameMock.mockResolvedValue(undefined);

    render(<AnalyzerPageComponent model={getAnalyzerPageModel(48)} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /reanalyze selected game/i }));

    expect(await screen.findByText(/reanalyze queued for game #48/i)).toBeInTheDocument();
  });

  it("ignores stale reanalyze results after the user switches to another game", async () => {
    let resolveRequest: ((value: { ok: true; message: string }) => void) | undefined;
    const pendingRequest = new Promise<{ ok: true; message: string }>((resolve) => {
      resolveRequest = resolve;
    });
    reanalyzeAnalyzerGameMock.mockReturnValue(pendingRequest);

    render(<AnalyzerPageComponent model={getAnalyzerPageModel(48)} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /reanalyze selected game/i }));
    await user.click(screen.getByText(/^#47$/i));

    resolveRequest?.({ ok: true, message: "reanalyze queued" });

    await waitFor(() => expect(screen.getByRole("link", { name: /refresh/i })).toHaveAttribute("href", "/analyzer?currentUser=3x3_GG&gameId=47"));
    expect(screen.queryByText(/reanalyze queued/i)).not.toBeInTheDocument();
  });

  it("keeps the focused player selection when switching games, matching the source behavior", async () => {
    render(<AnalyzerPageComponent model={getAnalyzerPageModel(48)} />);
    const user = userEvent.setup();
    const deepDive = screen.getByText(/^PLAYER DEEP DIVE$/i).parentElement as HTMLElement;

    await user.click(within(deepDive).getByRole("button", { name: /성우/i }));
    expect(within(deepDive).getByText(/^APM$/i)).toBeInTheDocument();

    await user.click(screen.getByText(/^#47$/i));
    expect(within(deepDive).getByText(/^APM$/i)).toBeInTheDocument();
    expect(within(deepDive).getByRole("button", { name: /성우/i })).toHaveStyle({
      backgroundColor: "rgba(34,211,238,0.08)"
    });
  });

  it("syncs the selected game when the route-provided model changes", async () => {
    const baseModel: AnalyzerPageModel = {
      currentUser: "alpha",
      games: [
        {
          id: 47,
          map: "Alpha Ridge",
          matchup: "PTZvPTZ",
          winnerTeam: [{ name: "alpha", race: "P", apm: 100, eapm: 90, cmd: 1000, ecmd: 900, effective: 80, redundancy: 10, production: 95, isCurrentUser: true }],
          loserTeam: [{ name: "charlie", race: "Z", apm: 120, eapm: 92, cmd: 1200, ecmd: 920, effective: 82, redundancy: 12, production: 97 }],
          analyzerStatus: "DONE",
          playTime: "12:34",
          startTime: "2026-03-23 10:00",
          matchStory: "Game 47"
        },
        {
          id: 48,
          map: "Beta Mesa",
          matchup: "PTZvPTZ",
          winnerTeam: [{ name: "alpha", race: "P", apm: 101, eapm: 91, cmd: 1001, ecmd: 901, effective: 81, redundancy: 11, production: 96, isCurrentUser: true }],
          loserTeam: [{ name: "charlie", race: "Z", apm: 121, eapm: 93, cmd: 1201, ecmd: 921, effective: 83, redundancy: 13, production: 98 }],
          analyzerStatus: "DONE",
          playTime: "13:37",
          startTime: "2026-03-23 11:00",
          matchStory: "Game 48"
        }
      ],
      selectedGame: {
        id: 47,
        map: "Alpha Ridge",
        matchup: "PTZvPTZ",
        winnerTeam: [{ name: "alpha", race: "P", apm: 100, eapm: 90, cmd: 1000, ecmd: 900, effective: 80, redundancy: 10, production: 95, isCurrentUser: true }],
        loserTeam: [{ name: "charlie", race: "Z", apm: 120, eapm: 92, cmd: 1200, ecmd: 920, effective: 82, redundancy: 12, production: 97 }],
        analyzerStatus: "DONE",
        playTime: "12:34",
        startTime: "2026-03-23 10:00",
        matchStory: "Game 47"
      },
      players: [],
      tabs: [
        { id: "match_flow", label: "Match Flow" },
        { id: "apm", label: "APM" },
        { id: "resource", label: "Resource Spend" },
        { id: "unit_prod", label: "Unit Production" },
        { id: "tech", label: "Tech / Upgrade" }
      ],
      timeline: [],
      comparison: {
        kills: { winner: 1, loser: 2 },
        workerPeak: { winner: 3, loser: 4 },
        totalSpend: { winner: 5, loser: 6 },
        techUpg: { winner: 7, loser: 8 }
      },
      apmSeries: [],
      resourceSeries: [],
      unitProductionSeries: [],
      insightsByGameId: {
        47: {
          players: [{ name: "alpha", race: "P", apm: 100, eapm: 90, cmd: 1000, ecmd: 900, effective: 80, redundancy: 10, production: 95, isCurrentUser: true }],
          timeline: [],
          comparison: {
            kills: { winner: 1, loser: 2 },
            workerPeak: { winner: 3, loser: 4 },
            totalSpend: { winner: 5, loser: 6 },
            techUpg: { winner: 7, loser: 8 }
          },
          apmSeries: [],
          resourceSeries: [],
          unitProductionSeries: [],
          keyPlayer: "alpha",
          worstPlayer: "charlie"
        },
        48: {
          players: [{ name: "alpha", race: "P", apm: 101, eapm: 91, cmd: 1001, ecmd: 901, effective: 81, redundancy: 11, production: 96, isCurrentUser: true }],
          timeline: [],
          comparison: {
            kills: { winner: 1, loser: 2 },
            workerPeak: { winner: 3, loser: 4 },
            totalSpend: { winner: 5, loser: 6 },
            techUpg: { winner: 7, loser: 8 }
          },
          apmSeries: [],
          resourceSeries: [],
          unitProductionSeries: [],
          keyPlayer: "alpha",
          worstPlayer: "charlie"
        }
      }
    };

    const { rerender } = render(<AnalyzerPageComponent model={baseModel} />);

    expect(screen.getByText("Alpha Ridge")).toBeInTheDocument();
    expect(screen.getByText(/^#47$/i).closest("tr")).toHaveStyle({
      backgroundColor: "rgba(34,211,238,0.07)"
    });

    rerender(
      <AnalyzerPageComponent
        model={{
          ...baseModel,
          selectedGame: baseModel.games[1]
        }}
      />
    );

    await waitFor(() => expect(screen.getByText("Beta Mesa")).toBeInTheDocument());
    expect(screen.getByText(/^#48$/i).closest("tr")).toHaveStyle({
      backgroundColor: "rgba(34,211,238,0.07)"
    });
  });

  it("renders deep-dive players in winner-plus-loser team order from the selected game, matching the source behavior", () => {
    const model: AnalyzerPageModel = {
      currentUser: "alpha",
      games: [
        {
          id: 1,
          map: "Circuit Breaker",
          matchup: "PTZvPTZ",
          winnerTeam: [
            { name: "alpha", race: "P", apm: 100, eapm: 90, cmd: 1000, ecmd: 900, effective: 80, redundancy: 10, production: 95, isCurrentUser: true },
            { name: "bravo", race: "T", apm: 110, eapm: 91, cmd: 1100, ecmd: 910, effective: 81, redundancy: 11, production: 96 }
          ],
          loserTeam: [{ name: "charlie", race: "Z", apm: 120, eapm: 92, cmd: 1200, ecmd: 920, effective: 82, redundancy: 12, production: 97 }],
          analyzerStatus: "DONE",
          playTime: "12:34",
          startTime: "2026-03-23 10:00",
          matchStory: "Test match",
          keyPlayer: "alpha",
          worstPlayer: "charlie"
        }
      ],
      selectedGame: {
        id: 1,
        map: "Circuit Breaker",
        matchup: "PTZvPTZ",
        winnerTeam: [
          { name: "alpha", race: "P", apm: 100, eapm: 90, cmd: 1000, ecmd: 900, effective: 80, redundancy: 10, production: 95, isCurrentUser: true },
          { name: "bravo", race: "T", apm: 110, eapm: 91, cmd: 1100, ecmd: 910, effective: 81, redundancy: 11, production: 96 }
        ],
        loserTeam: [{ name: "charlie", race: "Z", apm: 120, eapm: 92, cmd: 1200, ecmd: 920, effective: 82, redundancy: 12, production: 97 }],
        analyzerStatus: "DONE",
        playTime: "12:34",
        startTime: "2026-03-23 10:00",
        matchStory: "Test match",
        keyPlayer: "alpha",
        worstPlayer: "charlie"
      },
      players: [],
      tabs: [
        { id: "match_flow", label: "Match Flow" },
        { id: "apm", label: "APM" },
        { id: "resource", label: "Resource Spend" },
        { id: "unit_prod", label: "Unit Production" },
        { id: "tech", label: "Tech / Upgrade" }
      ],
      timeline: [],
      comparison: {
        kills: { winner: 1, loser: 2 },
        workerPeak: { winner: 3, loser: 4 },
        totalSpend: { winner: 5, loser: 6 },
        techUpg: { winner: 7, loser: 8 }
      },
      apmSeries: [],
      resourceSeries: [],
      unitProductionSeries: [],
      insightsByGameId: {
        1: {
          players: [
            { name: "charlie", race: "Z", apm: 120, eapm: 92, cmd: 1200, ecmd: 920, effective: 82, redundancy: 12, production: 97 },
            { name: "bravo", race: "T", apm: 110, eapm: 91, cmd: 1100, ecmd: 910, effective: 81, redundancy: 11, production: 96 },
            { name: "alpha", race: "P", apm: 100, eapm: 90, cmd: 1000, ecmd: 900, effective: 80, redundancy: 10, production: 95, isCurrentUser: true }
          ],
          timeline: [],
          comparison: {
            kills: { winner: 1, loser: 2 },
            workerPeak: { winner: 3, loser: 4 },
            totalSpend: { winner: 5, loser: 6 },
            techUpg: { winner: 7, loser: 8 }
          },
          apmSeries: [],
          resourceSeries: [],
          unitProductionSeries: [],
          keyPlayer: "alpha",
          worstPlayer: "charlie"
        }
      }
    };

    render(<AnalyzerPageComponent model={model} />);

    const deepDive = screen.getByText(/^PLAYER DEEP DIVE$/i).parentElement as HTMLElement;
    const labels = within(deepDive)
      .getAllByRole("button")
      .map((button) => button.textContent?.replace(/\s+/g, "").trim());

    expect(labels).toEqual(["ALLPLAYERS", "PalphaYOUWINNER", "TbravoWINNER", "ZcharlieLOSER"]);
  });

  it("uses selected-game key and worst players in the all-players summary, matching the source behavior", () => {
    const model: AnalyzerPageModel = {
      currentUser: "alpha",
      games: [
        {
          id: 1,
          map: "Circuit Breaker",
          matchup: "PTZvPTZ",
          winnerTeam: [{ name: "alpha", race: "P", apm: 100, eapm: 90, cmd: 1000, ecmd: 900, effective: 80, redundancy: 10, production: 95, isCurrentUser: true }],
          loserTeam: [{ name: "charlie", race: "Z", apm: 120, eapm: 92, cmd: 1200, ecmd: 920, effective: 82, redundancy: 12, production: 97 }],
          analyzerStatus: "DONE",
          playTime: "12:34",
          startTime: "2026-03-23 10:00",
          matchStory: "Test match",
          keyPlayer: "game-key",
          worstPlayer: "game-worst"
        }
      ],
      selectedGame: {
        id: 1,
        map: "Circuit Breaker",
        matchup: "PTZvPTZ",
        winnerTeam: [{ name: "alpha", race: "P", apm: 100, eapm: 90, cmd: 1000, ecmd: 900, effective: 80, redundancy: 10, production: 95, isCurrentUser: true }],
        loserTeam: [{ name: "charlie", race: "Z", apm: 120, eapm: 92, cmd: 1200, ecmd: 920, effective: 82, redundancy: 12, production: 97 }],
        analyzerStatus: "DONE",
        playTime: "12:34",
        startTime: "2026-03-23 10:00",
        matchStory: "Test match",
        keyPlayer: "game-key",
        worstPlayer: "game-worst"
      },
      players: [],
      tabs: [
        { id: "match_flow", label: "Match Flow" },
        { id: "apm", label: "APM" },
        { id: "resource", label: "Resource Spend" },
        { id: "unit_prod", label: "Unit Production" },
        { id: "tech", label: "Tech / Upgrade" }
      ],
      timeline: [],
      comparison: {
        kills: { winner: 1, loser: 2 },
        workerPeak: { winner: 3, loser: 4 },
        totalSpend: { winner: 5, loser: 6 },
        techUpg: { winner: 7, loser: 8 }
      },
      apmSeries: [],
      resourceSeries: [],
      unitProductionSeries: [],
      insightsByGameId: {
        1: {
          players: [
            { name: "alpha", race: "P", apm: 100, eapm: 90, cmd: 1000, ecmd: 900, effective: 80, redundancy: 10, production: 95, isCurrentUser: true },
            { name: "charlie", race: "Z", apm: 120, eapm: 92, cmd: 1200, ecmd: 920, effective: 82, redundancy: 12, production: 97 }
          ],
          timeline: [],
          comparison: {
            kills: { winner: 1, loser: 2 },
            workerPeak: { winner: 3, loser: 4 },
            totalSpend: { winner: 5, loser: 6 },
            techUpg: { winner: 7, loser: 8 }
          },
          apmSeries: [],
          resourceSeries: [],
          unitProductionSeries: [],
          keyPlayer: "insight-key",
          worstPlayer: "insight-worst"
        }
      }
    };

    render(<AnalyzerPageComponent model={model} />);

    const deepDive = screen.getByText(/^PLAYER DEEP DIVE$/i).parentElement as HTMLElement;
    expect(within(deepDive).getByText("game-key")).toBeInTheDocument();
    expect(within(deepDive).getByText("game-worst")).toBeInTheDocument();
    expect(within(deepDive).queryByText("insight-key")).not.toBeInTheDocument();
    expect(within(deepDive).queryByText("insight-worst")).not.toBeInTheDocument();
  });

  it("uses selected-game player stats in the focused deep-dive card, matching the source behavior", async () => {
    const model: AnalyzerPageModel = {
      currentUser: "alpha",
      games: [
        {
          id: 1,
          map: "Circuit Breaker",
          matchup: "PTZvPTZ",
          winnerTeam: [{ name: "alpha", race: "P", apm: 101, eapm: 88, cmd: 1001, ecmd: 901, effective: 81.5, redundancy: 7, production: 95, isCurrentUser: true }],
          loserTeam: [{ name: "charlie", race: "Z", apm: 120, eapm: 92, cmd: 1200, ecmd: 920, effective: 82, redundancy: 12, production: 97 }],
          analyzerStatus: "DONE",
          playTime: "12:34",
          startTime: "2026-03-23 10:00",
          matchStory: "Test match",
          keyPlayer: "game-key",
          worstPlayer: "game-worst"
        }
      ],
      selectedGame: {
        id: 1,
        map: "Circuit Breaker",
        matchup: "PTZvPTZ",
        winnerTeam: [{ name: "alpha", race: "P", apm: 101, eapm: 88, cmd: 1001, ecmd: 901, effective: 81.5, redundancy: 7, production: 95, isCurrentUser: true }],
        loserTeam: [{ name: "charlie", race: "Z", apm: 120, eapm: 92, cmd: 1200, ecmd: 920, effective: 82, redundancy: 12, production: 97 }],
        analyzerStatus: "DONE",
        playTime: "12:34",
        startTime: "2026-03-23 10:00",
        matchStory: "Test match",
        keyPlayer: "game-key",
        worstPlayer: "game-worst"
      },
      players: [],
      tabs: [
        { id: "match_flow", label: "Match Flow" },
        { id: "apm", label: "APM" },
        { id: "resource", label: "Resource Spend" },
        { id: "unit_prod", label: "Unit Production" },
        { id: "tech", label: "Tech / Upgrade" }
      ],
      timeline: [],
      comparison: {
        kills: { winner: 1, loser: 2 },
        workerPeak: { winner: 3, loser: 4 },
        totalSpend: { winner: 5, loser: 6 },
        techUpg: { winner: 7, loser: 8 }
      },
      apmSeries: [],
      resourceSeries: [],
      unitProductionSeries: [],
      insightsByGameId: {
        1: {
          players: [
            { name: "alpha", race: "P", apm: 999, eapm: 777, cmd: 9999, ecmd: 8888, effective: 55.5, redundancy: 99, production: 11, isCurrentUser: true },
            { name: "charlie", race: "Z", apm: 120, eapm: 92, cmd: 1200, ecmd: 920, effective: 82, redundancy: 12, production: 97 }
          ],
          timeline: [],
          comparison: {
            kills: { winner: 1, loser: 2 },
            workerPeak: { winner: 3, loser: 4 },
            totalSpend: { winner: 5, loser: 6 },
            techUpg: { winner: 7, loser: 8 }
          },
          apmSeries: [],
          resourceSeries: [],
          unitProductionSeries: [],
          keyPlayer: "insight-key",
          worstPlayer: "insight-worst"
        }
      }
    };

    render(<AnalyzerPageComponent model={model} />);
    const user = userEvent.setup();
    const deepDive = screen.getByText(/^PLAYER DEEP DIVE$/i).parentElement as HTMLElement;

    await user.click(within(deepDive).getByRole("button", { name: /alpha/i }));

    expect(within(deepDive).getByText("101")).toBeInTheDocument();
    expect(within(deepDive).getByText("88")).toBeInTheDocument();
    expect(within(deepDive).getByText("1,001")).toBeInTheDocument();
    expect(within(deepDive).getByText("901")).toBeInTheDocument();
    expect(within(deepDive).getByText("81.5%")).toBeInTheDocument();
    expect(within(deepDive).getByText("7%")).toBeInTheDocument();
    expect(within(deepDive).getByText("95")).toBeInTheDocument();
    expect(within(deepDive).queryByText("999")).not.toBeInTheDocument();
    expect(within(deepDive).queryByText("777")).not.toBeInTheDocument();
    expect(within(deepDive).queryByText("9,999")).not.toBeInTheDocument();
  });

  it("renders the summary strip using start-position sides instead of winner and loser columns", () => {
    const model: AnalyzerPageModel = {
      currentUser: "3x3_GG",
      games: [
        {
          id: 1,
          map: "OP3060 CLAN 6슈빨무",
          matchup: "3v3",
          winnerTeam: [
            { name: "3x3_GG", race: "P", apm: 148, eapm: 126, cmd: 2050, ecmd: 1746, effective: 85.2, redundancy: 15, production: 203, isCurrentUser: true, startLocationX: 4000, startLocationY: 100 },
            { name: "3x3_mh", race: "P", apm: 148, eapm: 136, cmd: 2054, ecmd: 1884, effective: 91.7, redundancy: 8, production: 200, startLocationX: 100, startLocationY: 900 },
            { name: "3x3_smwoo", race: "P", apm: 182, eapm: 161, cmd: 2500, ecmd: 2208, effective: 88.3, redundancy: 12, production: 211, startLocationX: 4000, startLocationY: 500 }
          ],
          loserTeam: [
            { name: "3x3_Kiyong", race: "P", apm: 171, eapm: 161, cmd: 2354, ecmd: 2216, effective: 94.1, redundancy: 6, production: 176, startLocationX: 100, startLocationY: 100 },
            { name: "3x3_pil", race: "Z", apm: 145, eapm: 121, cmd: 2015, ecmd: 1671, effective: 82.9, redundancy: 17, production: 194, startLocationX: 4000, startLocationY: 900 },
            { name: "3x3_syntax", race: "P", apm: 142, eapm: 120, cmd: 1965, ecmd: 1666, effective: 84.8, redundancy: 15, production: 153, startLocationX: 100, startLocationY: 500 }
          ],
          analyzerStatus: "DONE",
          playTime: "13:55",
          startTime: "2026-03-22 00:05:48",
          matchStory: "Test story",
          keyPlayer: "3x3_GG",
          worstPlayer: "3x3_pil"
        }
      ],
      selectedGame: {
        id: 1,
        map: "OP3060 CLAN 6슈빨무",
        matchup: "3v3",
        winnerTeam: [
          { name: "3x3_GG", race: "P", apm: 148, eapm: 126, cmd: 2050, ecmd: 1746, effective: 85.2, redundancy: 15, production: 203, isCurrentUser: true, startLocationX: 4000, startLocationY: 100 },
          { name: "3x3_mh", race: "P", apm: 148, eapm: 136, cmd: 2054, ecmd: 1884, effective: 91.7, redundancy: 8, production: 200, startLocationX: 100, startLocationY: 900 },
          { name: "3x3_smwoo", race: "P", apm: 182, eapm: 161, cmd: 2500, ecmd: 2208, effective: 88.3, redundancy: 12, production: 211, startLocationX: 4000, startLocationY: 500 }
        ],
        loserTeam: [
          { name: "3x3_Kiyong", race: "P", apm: 171, eapm: 161, cmd: 2354, ecmd: 2216, effective: 94.1, redundancy: 6, production: 176, startLocationX: 100, startLocationY: 100 },
          { name: "3x3_pil", race: "Z", apm: 145, eapm: 121, cmd: 2015, ecmd: 1671, effective: 82.9, redundancy: 17, production: 194, startLocationX: 4000, startLocationY: 900 },
          { name: "3x3_syntax", race: "P", apm: 142, eapm: 120, cmd: 1965, ecmd: 1666, effective: 84.8, redundancy: 15, production: 153, startLocationX: 100, startLocationY: 500 }
        ],
        analyzerStatus: "DONE",
        playTime: "13:55",
        startTime: "2026-03-22 00:05:48",
        matchStory: "Test story",
        keyPlayer: "3x3_GG",
        worstPlayer: "3x3_pil"
      },
      players: [],
      tabs: [
        { id: "match_flow", label: "Match Flow" },
        { id: "apm", label: "APM" },
        { id: "resource", label: "Resource Spend" },
        { id: "unit_prod", label: "Unit Production" },
        { id: "tech", label: "Tech / Upgrade" }
      ],
      timeline: [],
      comparison: {
        kills: { winner: 1, loser: 2 },
        workerPeak: { winner: 3, loser: 4 },
        totalSpend: { winner: 5, loser: 6 },
        techUpg: { winner: 7, loser: 8 }
      },
      apmSeries: [],
      resourceSeries: [],
      unitProductionSeries: [],
      insightsByGameId: {
        1: {
          players: [],
          timeline: [],
          comparison: {
            kills: { winner: 1, loser: 2 },
            workerPeak: { winner: 3, loser: 4 },
            totalSpend: { winner: 5, loser: 6 },
            techUpg: { winner: 7, loser: 8 }
          },
          apmSeries: [],
          resourceSeries: [],
          unitProductionSeries: [],
          keyPlayer: "3x3_GG",
          worstPlayer: "3x3_pil"
        }
      }
    };

    render(<AnalyzerPageComponent model={model} />);

    const leftColumn = screen.getByTestId("analyzer-start-grid-left");
    const rightColumn = screen.getByTestId("analyzer-start-grid-right");

    expect(within(leftColumn).getAllByTestId("start-grid-player-name").map((node) => node.textContent)).toEqual(["기용", "명진", "민혁"]);
    expect(within(rightColumn).getAllByTestId("start-grid-player-name").map((node) => node.textContent)).toEqual(["성우", "성민", "필균"]);
  });

  it("renders the extracted summary strip with the same start-grid layout and metadata", () => {
    const model = getAnalyzerPageModel(48);

    render(<AnalyzerSummaryStrip game={model.selectedGame} />);

    expect(screen.getByText(/^GAME SUMMARY STRIP$/i)).toBeInTheDocument();
    expect(screen.getByText(/^MAP:$/i).parentElement).toHaveStyle({
      backgroundColor: "#202c40"
    });
    expect(screen.getByText(/^PLAY TIME:$/i).parentElement).toHaveStyle({
      backgroundColor: "#202c40"
    });
    expect(screen.getByText(/^START:$/i).parentElement).toHaveStyle({
      backgroundColor: "#202c40"
    });

    const leftColumn = screen.getByTestId("analyzer-start-grid-left");
    const rightColumn = screen.getByTestId("analyzer-start-grid-right");

    expect(within(leftColumn).getAllByTestId("start-grid-player-name").map((node) => node.textContent)).toEqual(["기용", "명진", "민혁"]);
    expect(within(rightColumn).getAllByTestId("start-grid-player-name").map((node) => node.textContent)).toEqual(["성우", "성민", "필균"]);
  });
});
