import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";

import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card";
import { DashboardStatsTable } from "@/components/dashboard/dashboard-stats-table";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DASHBOARD_FIXTURE } from "@/lib/fixtures/dashboard";
import { previewReplayUpload, submitReplayUpload } from "@/lib/api/actions";

vi.mock("@/lib/api/actions", () => ({
  previewReplayUpload: vi.fn(),
  submitReplayUpload: vi.fn()
}));

const previewReplayUploadMock = vi.mocked(previewReplayUpload);
const submitReplayUploadMock = vi.mocked(submitReplayUpload);

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function createGamesListResponse() {
  return {
    total: 2,
    analysis_statuses: {
      "48": "succeeded",
      "47": "succeeded"
    },
    games: [
      {
        id: 48,
        map_name: "OP3060 CLAN 6슈빨무",
        game_length: 835,
        winner_team: 1,
        start_time: "2026-03-22T00:05:48Z",
        edges: {
          players: [
            { name: "3x3_GG", race: "P", team: 1, start_location_x: 4000, start_location_y: 100, apm: 148, eapm: 126, cmd_count: 2050, effective_cmd_count: 1746, redundancy: 15 },
            { name: "3x3_mh", race: "P", team: 1, start_location_x: 100, start_location_y: 900, apm: 148, eapm: 136, cmd_count: 2054, effective_cmd_count: 1884, redundancy: 8 },
            { name: "3x3_smwoo", race: "P", team: 1, start_location_x: 4000, start_location_y: 500, apm: 182, eapm: 161, cmd_count: 2500, effective_cmd_count: 2208, redundancy: 12 },
            { name: "3x3_Kiyong", race: "P", team: 2, start_location_x: 100, start_location_y: 100, apm: 171, eapm: 161, cmd_count: 2354, effective_cmd_count: 2216, redundancy: 6 },
            { name: "3x3_pil", race: "Z", team: 2, start_location_x: 4000, start_location_y: 900, apm: 145, eapm: 121, cmd_count: 2015, effective_cmd_count: 1671, redundancy: 17 },
            { name: "3x3_syntax", race: "P", team: 2, start_location_x: 100, start_location_y: 500, apm: 142, eapm: 120, cmd_count: 1965, effective_cmd_count: 1666, redundancy: 15 }
          ]
        }
      },
      {
        id: 47,
        map_name: "Circuit Breaker",
        game_length: 1127,
        winner_team: 1,
        start_time: "2026-03-21T23:45:50Z",
        edges: {
          players: [
            { name: "3x3_GG", race: "P", team: 1, start_location_x: 4000, start_location_y: 100, apm: 138, eapm: 122, cmd_count: 1900, effective_cmd_count: 1680, redundancy: 12 },
            { name: "3x3_smwoo", race: "P", team: 1, start_location_x: 4000, start_location_y: 500, apm: 166, eapm: 148, cmd_count: 2280, effective_cmd_count: 2034, redundancy: 11 },
            { name: "3x3_mh", race: "T", team: 1, start_location_x: 100, start_location_y: 900, apm: 163, eapm: 152, cmd_count: 2241, effective_cmd_count: 2088, redundancy: 7 },
            { name: "3x3_Kiyong", race: "P", team: 2, start_location_x: 100, start_location_y: 100, apm: 157, eapm: 149, cmd_count: 2156, effective_cmd_count: 2046, redundancy: 5 },
            { name: "3x3_pil", race: "Z", team: 2, start_location_x: 4000, start_location_y: 900, apm: 131, eapm: 118, cmd_count: 1800, effective_cmd_count: 1621, redundancy: 10 },
            { name: "3x3_syntax", race: "P", team: 2, start_location_x: 100, start_location_y: 500, apm: 141, eapm: 121, cmd_count: 1937, effective_cmd_count: 1662, redundancy: 14 }
          ]
        }
      }
    ]
  };
}

function createDefaultFetchMock() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("/api/v1/games/48/detail")) {
      return new Response(
        JSON.stringify({
          analysis_status: {
            status: "done",
            user_message: "Winner side held map control and converted its production edge."
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.includes("/api/v1/games/48")) {
      return new Response(
        JSON.stringify({
          reliability: "stable",
          reliability_m_of_n: "5/6",
          game: { id: 48, edges: { replay_files: [{ id: 1, filename: "game-48.rep" }] } }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.includes("/api/v1/games/47/detail")) {
      return new Response(
        JSON.stringify({
          analysis_status: {
            status: "done",
            user_message: "Terran macro timing decided the mid game."
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.includes("/api/v1/games/47")) {
      return new Response(
        JSON.stringify({
          reliability: "stable",
          reliability_m_of_n: "6/6",
          game: { id: 47, edges: { replay_files: [{ id: 2, filename: "game-47.rep" }] } }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.includes("/api/v1/games?")) {
      return new Response(JSON.stringify(createGamesListResponse()), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (url.includes("/api/v1/users/suggest")) {
      return new Response(JSON.stringify({ users: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  });
}

describe("dashboard page", () => {
  beforeEach(() => {
    previewReplayUploadMock.mockReset();
    submitReplayUploadMock.mockReset();
    vi.restoreAllMocks();
    globalThis.__TEST_ROUTER__.push.mockReset();
    globalThis.__TEST_ROUTER__.replace.mockReset();
    globalThis.__TEST_ROUTER__.refresh.mockReset();
    document.cookie = "current_user=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    window.localStorage.clear();
    vi.stubGlobal("fetch", createDefaultFetchMock());
  });

  it("starts with the legacy no-preview terminal state", () => {
    render(<DashboardPage model={DASHBOARD_FIXTURE} />);

    expect(screen.getByText("NO_PREVIEW")).toBeInTheDocument();
    expect(within(screen.getByTestId("dashboard-upload-result")).getByText("READY")).toBeInTheDocument();
  });

  it("restores the legacy current user from localStorage on mount", async () => {
    window.localStorage.setItem("stareplays_current_user", "legacy_saved_user");

    render(
      <DashboardPage
        model={{
          ...DASHBOARD_FIXTURE,
          currentUser: "",
          playerStats: {
            ...DASHBOARD_FIXTURE.playerStats,
            name: ""
          }
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/^CURRENT_USER:$/i).nextElementSibling).toHaveTextContent("legacy_saved_user");
    });

    expect(screen.getByLabelText(/플레이어 이름 입력/i)).toHaveValue("legacy_saved_user");
    expect(globalThis.__TEST_ROUTER__.replace).toHaveBeenCalledWith("/?currentUser=legacy_saved_user");
    expect(globalThis.__TEST_ROUTER__.refresh).toHaveBeenCalled();
  });

  it("renders the figma dashboard upload and stats workspace", async () => {
    const { container } = render(<DashboardPage model={DASHBOARD_FIXTURE} />);

    const replayUploadLabel = screen.getByText(/^Replay_Upload$/i);
    const playerStatsQueryLabel = screen.getByText(/^Player_Stats_Query$/i);
    const playerStatsInput = screen.getByLabelText(/플레이어 이름 입력/i);
    const playerStatsDatalist = container.querySelector('datalist');
    const queryButton = screen.getByRole("button", { name: /^QUERY$/i });
    const recentGamesLabel = screen.getByText(/^Recent_Games$/i);
    const systemLogsLabel = screen.getByText(/^System_Logs$/i);

    expect(replayUploadLabel).toBeInTheDocument();
    expect(screen.getByText(/플레이어 선택 \(Simple Login\)/i)).toBeInTheDocument();
    expect(screen.getByText(/select_player_from_parsed_replay/i)).toBeInTheDocument();
    expect(screen.queryByText(/^HOW TO USE$/i)).not.toBeInTheDocument();
    expect(playerStatsQueryLabel).toBeInTheDocument();
    expect(queryButton).toHaveClass("transition-all");
    expect(screen.queryByText(/^Win Rate Progress$/i)).not.toBeInTheDocument();
    expect(screen.getByText(DASHBOARD_FIXTURE.playerStats.favoriteRaceLabel)).toHaveClass("text-amber-400");
    expect(screen.getByText(/^CURRENT_USER:$/i).nextElementSibling).toHaveTextContent(DASHBOARD_FIXTURE.currentUser);
    expect(playerStatsQueryLabel.parentElement).toHaveClass("p-5");
    expect(playerStatsQueryLabel.parentElement).toHaveStyle({
      backgroundColor: "#0d1833",
      border: "1px solid rgba(34,211,238,0.1)"
    });
    expect(replayUploadLabel.compareDocumentPosition(playerStatsQueryLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(playerStatsQueryLabel.compareDocumentPosition(recentGamesLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(recentGamesLabel.compareDocumentPosition(systemLogsLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(playerStatsQueryLabel.compareDocumentPosition(screen.getByText(/^Race Stats$/i)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(playerStatsQueryLabel.compareDocumentPosition(playerStatsInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((playerStatsInput as Node).compareDocumentPosition(playerStatsDatalist as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((playerStatsDatalist as Node).compareDocumentPosition(queryButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const winRateStatValue = screen.getByText(`${DASHBOARD_FIXTURE.playerStats.winRate.toFixed(1)}%`, {
      selector: "span"
    });
    const winRateStatLabel = winRateStatValue.previousElementSibling;

    expect(winRateStatLabel?.parentElement).toHaveStyle({
      backgroundColor: "#0a1428",
      border: "1px solid rgba(255,255,255,0.06)"
    });
    expect(winRateStatValue).toHaveStyle({ color: "#22d3ee" });
    expect(container.querySelector('label[for="replay-file"]')).toHaveStyle({
      border: "2px dashed rgba(255,255,255,0.1)",
      backgroundColor: "rgba(255,255,255,0.02)"
    });
    expect(container.querySelector('label[for="replay-file"] svg')).toHaveClass("text-cyan-400");
    expect(within(screen.getByTestId("dashboard-upload-result")).getByText(/^READY$/i).parentElement).toHaveStyle({
      backgroundColor: "#0a1428",
      border: "1px solid rgba(255,255,255,0.05)"
    });
    expect(screen.getByLabelText(/플레이어 이름 입력/i)).toHaveStyle({
      backgroundColor: "#0a1428",
      border: "1px solid rgba(255,255,255,0.1)",
      color: "#e2e8f0"
    });
    expect(screen.getByRole("button", { name: /^QUERY$/i })).toHaveStyle({
      background: "linear-gradient(90deg, #0891b2, #1d4ed8)",
      border: "1px solid rgba(34,211,238,0.3)"
    });
    expect(screen.getByText(/^CURRENT_USER:$/i).nextElementSibling).toHaveStyle({
      backgroundColor: "rgba(34,211,238,0.1)",
      color: "#22d3ee",
      border: "1px solid rgba(34,211,238,0.2)"
    });
    expect(screen.getByText(/^CURRENT_USER:$/i).nextElementSibling).not.toHaveClass("tracking-wider");
    expect(screen.getByText(/^PLAYER$/i).nextElementSibling?.querySelector("span")).toHaveStyle({
      color: "#22d3ee"
    });
    expect(screen.getByText("56.4%")).toHaveStyle({
      color: "#34d399"
    });
  });

  it("orders the upload module blocks like the legacy dashboard flow", () => {
    const { container } = render(<DashboardPage model={DASHBOARD_FIXTURE} />);

    const uploadLabel = screen.getByText("Replay_Upload");
    const fileInputLabel = container.querySelector('label[for="replay-file"]');
    const analyzeButton = screen.getByRole("button", { name: /analyze_replay/i });
    const selectedUserBlock = container.querySelector('[data-testid="dashboard-upload-user-block"]');
    const uploadButton = screen.getByRole("button", { name: /upload_with_selected_user/i });
    const previewSummary = container.querySelector('[data-testid="dashboard-preview-summary"]');
    const uploadResult = container.querySelector('[data-testid="dashboard-upload-result"]');

    expect(uploadLabel.compareDocumentPosition(fileInputLabel as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((fileInputLabel as Node).compareDocumentPosition(analyzeButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(analyzeButton.compareDocumentPosition(selectedUserBlock as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((selectedUserBlock as Node).compareDocumentPosition(uploadButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(uploadButton.compareDocumentPosition(previewSummary as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((previewSummary as Node).compareDocumentPosition(uploadResult as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows login-required recent games state when no current user is set", async () => {
    render(
      <DashboardPage
        model={{
          ...DASHBOARD_FIXTURE,
          currentUser: "",
          playerStats: {
            ...DASHBOARD_FIXTURE.playerStats,
            name: ""
          }
        }}
      />
    );

    expect(
      within(screen.getByRole("region", { name: /Recent Games Workspace/i })).getByText(
        /LOGIN_REQUIRED: SIMPLE_LOGIN 후 Recent_Games 조회 가능/i
      )
    ).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-inline-game-detail-row")).not.toBeInTheDocument();
    expect(screen.getByTestId("dashboard-system-logs")).toHaveTextContent("LOGIN_REQUIRED");
  });

  it("loads recent games, refreshes them, and appends system logs", async () => {
    const fetchMock = createDefaultFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<DashboardPage model={DASHBOARD_FIXTURE} />);

    expect(screen.getByText(/#48/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /refresh_games/i }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/v1/games?")).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByTestId("dashboard-system-logs")).toHaveTextContent("LOAD_GAMES_OK");
    expect(screen.getByTestId("dashboard-system-logs")).toHaveTextContent("REFRESH_GAMES");
  });

  it("replaces fallback recent games with the initial loader data for logged-in users", async () => {
    const loaderResponse = createGamesListResponse();
    loaderResponse.total = 1;
    loaderResponse.games = [
      {
        ...loaderResponse.games[0],
        id: 501,
        map_name: "Neo Sylphid"
      }
    ];

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/v1/games?")) {
        return new Response(JSON.stringify(loaderResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/api/v1/users/suggest")) {
        return new Response(JSON.stringify({ users: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<DashboardPage model={DASHBOARD_FIXTURE} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/games?limit=10&offset=0&user_name=3x3_GG"),
        expect.any(Object)
      );
    });
    expect(await screen.findByText("#501")).toBeInTheDocument();
    expect(screen.queryByText("#48")).not.toBeInTheDocument();
  });

  it("loads recent game pages via limit and offset and resets back to page 1 when the current user changes", async () => {
    const currentUserPage1 = createGamesListResponse();
    currentUserPage1.total = 20;
    currentUserPage1.games = Array.from({ length: 10 }, (_, index) => ({
      ...currentUserPage1.games[index % currentUserPage1.games.length],
      id: 200 + index,
      map_name: `Legacy Map ${index + 1}`
    }));

    const currentUserPage2 = createGamesListResponse();
    currentUserPage2.total = 20;
    currentUserPage2.games = Array.from({ length: 10 }, (_, index) => ({
      ...currentUserPage2.games[index % currentUserPage2.games.length],
      id: 210 + index,
      map_name: `Legacy Map ${index + 11}`
    }));

    const nextUserPage1 = createGamesListResponse();
    nextUserPage1.total = 13;
    nextUserPage1.games = Array.from({ length: 10 }, (_, index) => ({
      ...nextUserPage1.games[index % nextUserPage1.games.length],
      id: 300 + index,
      map_name: `Next User Map ${index + 1}`
    }));

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/v1/games?") && url.includes("user_name=3x3_GG") && url.includes("offset=0")) {
        return new Response(JSON.stringify(currentUserPage1), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/api/v1/games?") && url.includes("user_name=3x3_GG") && url.includes("offset=10")) {
        return new Response(JSON.stringify(currentUserPage2), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/api/v1/games?") && url.includes("user_name=3x3_smwoo") && url.includes("offset=0")) {
        return new Response(JSON.stringify(nextUserPage1), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/api/v1/players/3x3_smwoo/stats")) {
        return new Response(
          JSON.stringify({
            player_name: "3x3_smwoo",
            total_games: 27,
            wins: 19,
            losses: 8,
            draws: 0,
            win_rate: 70.4,
            average_apm: 211.7,
            average_eapm: 166.2,
            favorite_race: "T",
            race_stats: {
              Terran: { wins: 19, losses: 8, total: 27, win_rate: 70.4 }
            },
            matchup_stats: {},
            map_stats: {}
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.includes("/api/v1/users/suggest")) {
        return new Response(JSON.stringify({ users: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<DashboardPage model={DASHBOARD_FIXTURE} />);

    expect(await screen.findByText("Page 1/2")).toBeInTheDocument();
    expect(screen.getByText("#200")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Prev$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Next$/i })).toBeEnabled();
    expect(screen.queryByText("#210")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Next$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/games?limit=10&offset=10&user_name=3x3_GG"),
        expect.any(Object)
      );
    });
    expect(screen.getByText("#210")).toBeInTheDocument();
    expect(screen.queryByText("#200")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/플레이어 이름 입력/i), { target: { value: "3x3_smwoo" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^QUERY$/i }));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/games?limit=10&offset=0&user_name=3x3_smwoo"),
        expect.any(Object)
      );
    });
    expect(await screen.findByText("Page 1/2")).toBeInTheDocument();
    expect(screen.getByText("#300")).toBeInTheDocument();
    expect(screen.queryByText("#310")).not.toBeInTheDocument();
  });

  it("renders inline selected-game detail directly below the clicked recent game row and collapses on re-click", async () => {
    const fetchMock = createDefaultFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<DashboardPage model={DASHBOARD_FIXTURE} />);

    const gameRow = await screen.findByTestId("dashboard-game-row-48");
    const nextGameRow = await screen.findByTestId("dashboard-game-row-47");

    fireEvent.click(within(gameRow).getByRole("button", { name: /open recent game 48/i }));

    const inlineRow = await screen.findByTestId("dashboard-inline-game-detail-row");
    expect(gameRow.compareDocumentPosition(inlineRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(inlineRow.compareDocumentPosition(nextGameRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(inlineRow.compareDocumentPosition(screen.getByTestId("dashboard-system-logs")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(inlineRow).getByText("Selected_Game")).toBeInTheDocument();
    expect(within(inlineRow).getByText("Game_Detail_Visualization")).toBeInTheDocument();
    expect(within(inlineRow).getByText(/#48 OP3060 CLAN 6슈빨무/i)).toBeInTheDocument();
    expect(within(inlineRow).getByRole("link", { name: /open_in_analyzer/i })).toHaveAttribute(
      "href",
      "/analyzer?currentUser=3x3_GG&gameId=48"
    );
    expect(within(inlineRow).getByText(/Winner side held map control/i)).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-system-logs")).toHaveTextContent("SELECT_GAME: #48");

    fireEvent.click(within(gameRow).getByRole("button", { name: /open recent game 48/i }));

    await waitFor(() => {
      expect(screen.queryByTestId("dashboard-inline-game-detail-row")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("dashboard-system-logs")).toHaveTextContent("COLLAPSE_GAME: #48");
  });

  it("renders extracted dashboard stat cards with the same visual contract", () => {
    render(<DashboardStatCard label="Win Rate" value="56.4%" sub="EAPM: 164.2" />);

    expect(screen.getByText("Win Rate")).toHaveClass("tracking-widest");
    expect(screen.getByText("56.4%")).toHaveStyle({ color: "#22d3ee" });
    expect(screen.getByText("EAPM: 164.2")).toHaveClass("text-slate-500");
  });

  it("renders extracted dashboard stats tables with the same layout and win-rate coloring", () => {
    render(
      <DashboardStatsTable
        title="Race Stats"
        leadingLabel="RACE"
        rows={[
          { label: "Protoss", record: "10-2", winRate: 83.3 },
          { label: "Terran", record: "4-5", winRate: 44.4 }
        ]}
      />
    );

    expect(screen.getByText("Race Stats")).toHaveClass("font-mono");
    expect(screen.getByText("RACE")).toBeInTheDocument();
    expect(screen.getByText("10-2")).toBeInTheDocument();
    expect(screen.getByText("83.3%")).toHaveStyle({ color: "#34d399" });
    expect(screen.getByText("44.4%")).toHaveStyle({ color: "#f87171" });
  });

  it("shows the legacy preview success terminal summary", async () => {
    render(<DashboardPage model={DASHBOARD_FIXTURE} />);

    previewReplayUploadMock.mockResolvedValue({
      success_count: 1,
      total_files: 1,
      results: [
        {
          ok: true,
          filename: "ladder.rep",
          preview: {
            map_name: "Polypoid",
            start_time: "2026-03-23T01:23:45Z",
            player_count: 6,
            parsed_players: ["3x3_GG", "3x3_mh", "3x3_smwoo"]
          }
        }
      ]
    });

    fireEvent.change(document.querySelector("#replay-file") as HTMLInputElement, {
      target: {
        files: [new File(["mock replay"], "ladder.rep", { type: "application/octet-stream" })]
      }
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /analyze_replay/i }));
    });

    expect((await screen.findAllByText(/ANALYZE_OK: 1\/1 files/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/Analysis Completed/i)).toBeInTheDocument();
    expect(screen.getAllByText(/common players: 3x3_GG/i)).not.toHaveLength(0);
    expect(within(screen.getByTestId("dashboard-preview-summary")).getByText("ladder.rep")).toBeInTheDocument();
    expect(within(screen.getByTestId("dashboard-preview-summary")).getByText("Polypoid")).toBeInTheDocument();
    expect(screen.getAllByText(/3x3_GG, 3x3_mh, 3x3_smwoo/i)).not.toHaveLength(0);
  });

  it("keeps the preview success terminal when auto-selecting the preferred player", async () => {
    render(
      <DashboardPage
        model={{
          ...DASHBOARD_FIXTURE,
          currentUser: "",
          playerStats: {
            ...DASHBOARD_FIXTURE.playerStats,
            name: ""
          }
        }}
      />
    );

    previewReplayUploadMock.mockResolvedValue({
      success_count: 1,
      total_files: 1,
      results: [
        {
          ok: true,
          filename: "preferred.rep",
          preview: {
            map_name: "Destination",
            start_time: "2026-03-23T01:23:45Z",
            player_count: 6,
            parsed_players: ["3x3_GG"]
          }
        }
      ]
    });

    fireEvent.change(document.querySelector("#replay-file") as HTMLInputElement, {
      target: {
        files: [new File(["mock replay"], "preferred.rep", { type: "application/octet-stream" })]
      }
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /analyze_replay/i }));
    });

    await waitFor(() => {
      expect(within(screen.getByTestId("dashboard-upload-result")).getByText("ANALYZE_OK: 1/1 files")).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/플레이어 선택/i)).toHaveValue("3x3_GG");
    expect(screen.getByText(/^CURRENT_USER:$/i).nextElementSibling).toHaveTextContent("3x3_GG");
    expect(screen.queryByText(/^READY$/i)).not.toBeInTheDocument();
  });

  it("preserves the current user and shows a legacy upload failure when preview participants do not match", async () => {
    const mismatchModel = {
      ...DASHBOARD_FIXTURE,
      currentUser: "legacy_bad_user",
      playerStats: {
        ...DASHBOARD_FIXTURE.playerStats,
        name: "legacy_bad_user"
      }
    };

    render(<DashboardPage model={mismatchModel} />);

    previewReplayUploadMock.mockResolvedValue({
      success_count: 1,
      total_files: 1,
      results: [
        {
          ok: true,
          filename: "mismatch.rep",
          preview: {
            map_name: "Destination",
            start_time: "2026-03-23T01:23:45Z",
            player_count: 6,
            parsed_players: ["3x3_GG", "3x3_mh"]
          }
        }
      ]
    });
    submitReplayUploadMock.mockRejectedValue(new Error("should not be used"));

    fireEvent.change(document.querySelector("#replay-file") as HTMLInputElement, {
      target: {
        files: [new File(["mock replay"], "mismatch.rep", { type: "application/octet-stream" })]
      }
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /analyze_replay/i }));
    });

    expect(screen.getByText(/^CURRENT_USER:$/i).nextElementSibling).toHaveTextContent("legacy_bad_user");
    expect(screen.getByLabelText(/플레이어 선택/i)).toHaveValue("");
    expect(screen.getByRole("button", { name: /upload_with_selected_user/i })).toBeDisabled();
    expect(submitReplayUploadMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/플레이어 선택/i), { target: { value: "3x3_GG" } });

    expect(screen.getByText(/^CURRENT_USER:$/i).nextElementSibling).toHaveTextContent("3x3_GG");
    expect(screen.getByLabelText(/플레이어 선택/i)).toHaveValue("3x3_GG");
    expect(screen.getByRole("button", { name: /upload_with_selected_user/i })).toBeEnabled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /upload_with_selected_user/i }));
    });

    expect(submitReplayUploadMock).toHaveBeenCalledWith([expect.objectContaining({ name: "mismatch.rep" })], "3x3_GG", expect.any(Object));
  });

  it("invalidates pending upload analysis when the replay file changes", async () => {
    render(<DashboardPage model={DASHBOARD_FIXTURE} />);

    previewReplayUploadMock
      .mockResolvedValueOnce({
        success_count: 1,
        total_files: 1,
        results: [
          {
            ok: true,
            filename: "first.rep",
            preview: {
              map_name: "Circuit Breaker",
              start_time: "2026-03-23T01:23:45Z",
              player_count: 6,
              parsed_players: ["3x3_GG", "3x3_mh"]
            }
          }
        ]
      })
      .mockRejectedValueOnce(new Error("broken preview"));

    fireEvent.change(document.querySelector("#replay-file") as HTMLInputElement, {
      target: {
        files: [new File(["mock replay"], "first.rep", { type: "application/octet-stream" })]
      }
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /analyze_replay/i }));
    });

    expect(screen.getAllByText(/common players: 3x3_GG/i)).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: /upload_with_selected_user/i })).toBeEnabled();

    fireEvent.change(document.querySelector("#replay-file") as HTMLInputElement, {
      target: {
        files: [new File(["mock replay"], "second.rep", { type: "application/octet-stream" })]
      }
    });

    expect(screen.getByRole("button", { name: /upload_with_selected_user/i })).toBeDisabled();
    expect(within(screen.getByTestId("dashboard-preview-summary")).getByText("NO_PREVIEW")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-upload-result")).toHaveTextContent("READY");
    expect(screen.queryByText(/common players: 3x3_GG/i)).not.toBeInTheDocument();
    expect(screen.queryByText("first.rep")).not.toBeInTheDocument();
    expect(submitReplayUploadMock).not.toHaveBeenCalled();
  });

  it("ignores stale preview results when the replay file changes before preview resolves", async () => {
    render(<DashboardPage model={DASHBOARD_FIXTURE} />);

    const firstPreview = createDeferred<Awaited<ReturnType<typeof previewReplayUploadMock>>>();
    previewReplayUploadMock.mockReturnValueOnce(firstPreview.promise as ReturnType<typeof previewReplayUploadMock>);

    fireEvent.change(document.querySelector("#replay-file") as HTMLInputElement, {
      target: {
        files: [new File(["mock replay"], "first.rep", { type: "application/octet-stream" })]
      }
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /analyze_replay/i }));
    });

    fireEvent.change(document.querySelector("#replay-file") as HTMLInputElement, {
      target: {
        files: [new File(["mock replay"], "second.rep", { type: "application/octet-stream" })]
      }
    });

    await act(async () => {
      firstPreview.resolve({
        success_count: 1,
        total_files: 1,
        results: [
          {
            ok: true,
            filename: "first.rep",
            preview: {
              map_name: "Circuit Breaker",
              start_time: "2026-03-23T01:23:45Z",
              player_count: 6,
              parsed_players: ["3x3_GG", "3x3_mh"]
            }
          }
        ]
      });
      await firstPreview.promise;
    });

    expect(within(screen.getByTestId("dashboard-preview-summary")).getByText("NO_PREVIEW")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-upload-result")).toHaveTextContent("READY");
    expect(screen.getByRole("button", { name: /upload_with_selected_user/i })).toBeDisabled();
    expect(screen.getByText("second.rep")).toBeInTheDocument();
    expect(screen.queryByText("first.rep")).not.toBeInTheDocument();
  });

  it("ignores stale upload results when the replay file changes before upload resolves", async () => {
    render(<DashboardPage model={DASHBOARD_FIXTURE} />);

    const uploadDeferred = createDeferred<Awaited<ReturnType<typeof submitReplayUploadMock>>>();
    submitReplayUploadMock.mockReturnValueOnce(uploadDeferred.promise as ReturnType<typeof submitReplayUploadMock>);

    previewReplayUploadMock.mockResolvedValue({
      success_count: 1,
      total_files: 1,
      preview_candidates: ["3x3_GG"],
      results: [
        {
          ok: true,
          filename: "first.rep",
          preview: {
            map_name: "Polypoid",
            start_time: "2026-03-23T01:23:45Z",
            player_count: 6,
            parsed_players: ["3x3_GG"]
          }
        }
      ]
    });

    fireEvent.change(document.querySelector("#replay-file") as HTMLInputElement, {
      target: {
        files: [new File(["mock replay"], "first.rep", { type: "application/octet-stream" })]
      }
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /analyze_replay/i }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /upload_with_selected_user/i }));
    });

    fireEvent.change(document.querySelector("#replay-file") as HTMLInputElement, {
      target: {
        files: [new File(["mock replay"], "second.rep", { type: "application/octet-stream" })]
      }
    });

    await act(async () => {
      uploadDeferred.resolve({
        game: {
          id: 99,
          map_name: "Polypoid"
        }
      });
      await uploadDeferred.promise;
    });

    expect(within(screen.getByTestId("dashboard-preview-summary")).getByText("NO_PREVIEW")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-upload-result")).toHaveTextContent("READY");
    expect(screen.queryByText(/uploaded game: #99/i)).not.toBeInTheDocument();
    expect(screen.queryByText("first.rep")).not.toBeInTheDocument();
    expect(screen.getByText("second.rep")).toBeInTheDocument();
  });

  it("ignores stale upload results when a new preview starts while upload is in flight", async () => {
    render(<DashboardPage model={DASHBOARD_FIXTURE} />);

    const uploadDeferred = createDeferred<Awaited<ReturnType<typeof submitReplayUploadMock>>>();
    submitReplayUploadMock.mockReturnValueOnce(uploadDeferred.promise as ReturnType<typeof submitReplayUploadMock>);

    previewReplayUploadMock.mockResolvedValue({
      success_count: 1,
      total_files: 1,
      preview_candidates: ["3x3_GG"],
      results: [
        {
          ok: true,
          filename: "first.rep",
          preview: {
            map_name: "Polypoid",
            start_time: "2026-03-23T01:23:45Z",
            player_count: 6,
            parsed_players: ["3x3_GG"]
          }
        }
      ]
    });

    fireEvent.change(document.querySelector("#replay-file") as HTMLInputElement, {
      target: {
        files: [new File(["mock replay"], "first.rep", { type: "application/octet-stream" })]
      }
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /analyze_replay/i }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /upload_with_selected_user/i }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /analyze_replay/i }));
    });

    await act(async () => {
      uploadDeferred.resolve({
        game: {
          id: 101,
          map_name: "Polypoid"
        }
      });
      await uploadDeferred.promise;
    });

    expect(within(screen.getByTestId("dashboard-upload-result")).getByText("ANALYZE_OK: 1/1 files")).toBeInTheDocument();
    expect(screen.queryByText(/uploaded game: #101/i)).not.toBeInTheDocument();
  });

  it("updates the upload module when a replay file is selected and analyzed", async () => {
    render(<DashboardPage model={DASHBOARD_FIXTURE} />);

    const fileInput = document.querySelector("#replay-file") as HTMLInputElement;
    const analyzeButton = screen.getByRole("button", { name: /analyze_replay/i });

    expect(analyzeButton).toBeDisabled();
    expect(analyzeButton).toHaveClass("transition-all", "duration-200");
    expect(within(screen.getByTestId("dashboard-upload-result")).getByText(/^READY$/i)).toBeInTheDocument();

    previewReplayUploadMock.mockResolvedValue({
      success_count: 1,
      total_files: 1,
      preview_candidates: ["3x3_GG", "3x3_mh"],
      results: [
        {
          ok: true,
          filename: "test-game.rep",
          preview: {
            map_name: "Circuit Breaker",
            start_time: "2026-03-23T01:23:45Z",
            player_count: 6,
            parsed_players: ["3x3_GG", "3x3_mh", "3x3_smwoo", "3x3_Kiyong", "3x3_pil", "3x3_syntax"]
          }
        }
      ]
    });

    fireEvent.change(fileInput, {
      target: {
        files: [new File(["mock replay"], "test-game.rep", { type: "application/octet-stream" })]
      }
    });

    const selectedFileName = screen.getByText("test-game.rep");

    expect(selectedFileName).toBeInTheDocument();
    expect(selectedFileName).toHaveClass("text-cyan-300");
    expect(analyzeButton).toBeEnabled();

    await act(async () => {
      fireEvent.click(analyzeButton);
    });

    expect(previewReplayUploadMock).toHaveBeenCalledWith(
      [expect.objectContaining({ name: "test-game.rep" })],
      expect.any(Object)
    );
    expect(await screen.findByText(/analysis completed/i)).toBeInTheDocument();
    expect(screen.getAllByText(/common players/i)).not.toHaveLength(0);
    expect(screen.getByRole("option", { name: "3x3_GG" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload_with_selected_user/i })).toBeEnabled();
  });

  it("ignores stale upload results when currentUser changes while upload is in flight", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/v1/players/3x3_new/stats")) {
        return new Response(
          JSON.stringify({
            player_name: "3x3_new",
            total_games: 42,
            wins: 31,
            losses: 11,
            draws: 0,
            win_rate: 73.8,
            average_apm: 244.4,
            average_eapm: 188.2,
            favorite_race: "T",
            race_stats: {},
            matchup_stats: {},
            map_stats: {}
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.includes("/api/v1/games?")) {
        return new Response(JSON.stringify({ total: 0, games: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/api/v1/users/suggest")) {
        return new Response(JSON.stringify({ users: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    previewReplayUploadMock.mockResolvedValue({
      success_count: 1,
      total_files: 1,
      preview_candidates: ["3x3_GG"],
      results: [
        {
          ok: true,
          filename: "first.rep",
          preview: {
            map_name: "Polypoid",
            start_time: "2026-03-23T01:23:45Z",
            player_count: 6,
            parsed_players: ["3x3_GG"]
          }
        }
      ]
    });

    const uploadDeferred = createDeferred<Awaited<ReturnType<typeof submitReplayUploadMock>>>();
    submitReplayUploadMock.mockReturnValueOnce(uploadDeferred.promise as ReturnType<typeof submitReplayUploadMock>);

    render(
      <DashboardPage
        model={{
          ...DASHBOARD_FIXTURE,
          currentUser: "",
          playerStats: {
            ...DASHBOARD_FIXTURE.playerStats,
            name: ""
          }
        }}
      />
    );

    fireEvent.change(document.querySelector("#replay-file") as HTMLInputElement, {
      target: {
        files: [new File(["mock replay"], "first.rep", { type: "application/octet-stream" })]
      }
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /analyze_replay/i }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /upload_with_selected_user/i }));
    });

    fireEvent.change(screen.getByLabelText(/플레이어 이름 입력/i), { target: { value: "3x3_new" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^QUERY$/i }));
    });

    await act(async () => {
      uploadDeferred.resolve({
        game: {
          id: 222,
          map_name: "Polypoid"
        }
      });
      await uploadDeferred.promise;
    });

    expect(screen.queryByText(/uploaded game: #222/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("dashboard-upload-result")).toHaveTextContent("READY");
    expect(globalThis.__TEST_ROUTER__.replace).toHaveBeenCalledWith("/?currentUser=3x3_new");
  });

  it("keeps uploadResult as the short legacy status terminal and appends upload details under preview summary", async () => {
    render(<DashboardPage model={DASHBOARD_FIXTURE} />);

    previewReplayUploadMock.mockResolvedValue({
      success_count: 1,
      total_files: 1,
      preview_candidates: ["3x3_GG"],
      results: [
        {
          ok: true,
          filename: "ladder.rep",
          preview: {
            map_name: "Polypoid",
            start_time: "2026-03-23T01:23:45Z",
            player_count: 6,
            parsed_players: ["3x3_GG"]
          }
        }
      ]
    });
    submitReplayUploadMock.mockResolvedValue({
      game: {
        id: 88,
        map_name: "Polypoid"
      }
    });

    fireEvent.change(document.querySelector("#replay-file") as HTMLInputElement, {
      target: {
        files: [new File(["mock replay"], "ladder.rep", { type: "application/octet-stream" })]
      }
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /analyze_replay/i }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /upload_with_selected_user/i }));
    });

    expect(submitReplayUploadMock).toHaveBeenCalledWith(
      [expect.objectContaining({ name: "ladder.rep" })],
      "3x3_GG",
      expect.any(Object)
    );
    const uploadTerminal = screen.getByTestId("dashboard-upload-result");
    expect(uploadTerminal).toHaveTextContent("UPLOAD_DONE: check terminal log");
    expect(uploadTerminal).not.toHaveTextContent("game #88");
    expect(screen.queryByText(/upload complete/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("dashboard-preview-summary")).toHaveTextContent("uploaded game: #88 - Polypoid");
    expect(screen.getByRole("link", { name: /open replay vault/i })).toHaveAttribute("href", "/vault?currentUser=3x3_GG");
    expect(screen.getByRole("link", { name: /open analyzer/i })).toHaveAttribute("href", "/analyzer?currentUser=3x3_GG&gameId=88");
    expect(document.cookie).toContain("current_user=3x3_GG");
    expect(globalThis.__TEST_ROUTER__.replace).toHaveBeenCalledWith("/?currentUser=3x3_GG");
    expect(globalThis.__TEST_ROUTER__.refresh).toHaveBeenCalled();
  });

  it("debounces player suggestions for 280ms and triggers query on Enter", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/v1/users/suggest")) {
        return new Response(JSON.stringify({ users: ["3x3_GG", "3x3_smwoo"] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/api/v1/players/3x3_smwoo/stats")) {
        return new Response(
          JSON.stringify({
            player_name: "3x3_smwoo",
            total_games: 27,
            wins: 19,
            losses: 8,
            draws: 0,
            win_rate: 70.4,
            average_apm: 211.7,
            average_eapm: 166.2,
            favorite_race: "T",
            race_stats: {
              Terran: { wins: 19, losses: 8, total: 27, win_rate: 70.4 }
            },
            matchup_stats: {},
            map_stats: {}
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <DashboardPage
        model={{
          ...DASHBOARD_FIXTURE,
          currentUser: "",
          playerStats: {
            ...DASHBOARD_FIXTURE.playerStats,
            name: ""
          }
        }}
      />
    );

    fetchMock.mockClear();

    const queryInput = screen.getByLabelText(/플레이어 이름 입력/i);
    fireEvent.change(queryInput, { target: { value: "3x3_smwoo" } });
    fetchMock.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(280);
      await Promise.resolve();
    });

    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/v1/users/suggest?q=3x3_smwoo")).length).toBeGreaterThan(0);

    vi.useRealTimers();

    expect(await screen.findByRole("option", { name: "3x3_smwoo" })).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(queryInput, { key: "Enter", code: "Enter", charCode: 13 });
    });

    expect(await screen.findAllByText("3x3_smwoo")).not.toHaveLength(0);
    expect(screen.getByText("TERRAN")).toBeInTheDocument();
    expect(await screen.findAllByText("70.4%")).not.toHaveLength(0);
    expect(screen.getByLabelText(/플레이어 선택/i)).toHaveValue("3x3_smwoo");
    expect(document.cookie).toContain("current_user=3x3_smwoo");
    expect(globalThis.__TEST_ROUTER__.replace).toHaveBeenCalledWith("/?currentUser=3x3_smwoo");
    expect(globalThis.__TEST_ROUTER__.refresh).toHaveBeenCalled();
  });

  it("ignores stale player stats responses when an earlier query resolves after a newer one", async () => {
    const deferredStats: Record<string, { resolve: (value: Response) => void }> = {};

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/v1/players/3x3_old/stats")) {
        return new Promise<Response>((resolve) => {
          deferredStats.old = { resolve };
        });
      }

      if (url.includes("/api/v1/players/3x3_new/stats")) {
        return new Promise<Response>((resolve) => {
          deferredStats.new = { resolve };
        });
      }

      if (url.includes("/api/v1/games?")) {
        return Promise.resolve(
          new Response(JSON.stringify({ total: 0, games: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        );
      }

      if (url.includes("/api/v1/users/suggest")) {
        return Promise.resolve(
          new Response(JSON.stringify({ users: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ error: "not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        })
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <DashboardPage
        model={{
          ...DASHBOARD_FIXTURE,
          currentUser: "",
          playerStats: {
            ...DASHBOARD_FIXTURE.playerStats,
            name: ""
          }
        }}
      />
    );

    const queryInput = screen.getByLabelText(/플레이어 이름 입력/i);

    fireEvent.change(queryInput, { target: { value: "3x3_old" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^QUERY$/i }));
    });

    fireEvent.change(queryInput, { target: { value: "3x3_new" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^QUERY$/i }));
    });

    await act(async () => {
      deferredStats.new?.resolve(
        new Response(
          JSON.stringify({
            player_name: "3x3_new",
            total_games: 42,
            wins: 31,
            losses: 11,
            draws: 0,
            win_rate: 73.8,
            average_apm: 244.4,
            average_eapm: 188.2,
            favorite_race: "T",
            race_stats: {},
            matchup_stats: {},
            map_stats: {}
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      );
      await Promise.resolve();
    });

    expect(screen.getByText("3x3_new", { selector: "span.font-mono.text-xl" })).toBeInTheDocument();
    expect(screen.getByText("73.8%", { selector: "span" })).toBeInTheDocument();

    await act(async () => {
      deferredStats.old?.resolve(
        new Response(
          JSON.stringify({
            player_name: "3x3_old",
            total_games: 7,
            wins: 2,
            losses: 5,
            draws: 0,
            win_rate: 28.6,
            average_apm: 111.1,
            average_eapm: 90.9,
            favorite_race: "Z",
            race_stats: {},
            matchup_stats: {},
            map_stats: {}
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      );
      await Promise.resolve();
    });

    expect(screen.queryByText("3x3_old", { selector: "span.font-mono.text-xl" })).not.toBeInTheDocument();
    expect(screen.getByText("3x3_new", { selector: "span.font-mono.text-xl" })).toBeInTheDocument();
    expect(screen.getByText("73.8%", { selector: "span" })).toBeInTheDocument();
  });

  it("ignores stale recent-games responses when an earlier load resolves after a newer one", async () => {
    const deferredGames: Record<string, { resolve: (value: Response) => void }> = {};

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/v1/games?") && url.includes("user_name=3x3_old")) {
        return new Promise<Response>((resolve) => {
          deferredGames.old = { resolve };
        });
      }

      if (url.includes("/api/v1/games?") && url.includes("user_name=3x3_new")) {
        return new Promise<Response>((resolve) => {
          deferredGames.new = { resolve };
        });
      }

      if (url.includes("/api/v1/players/")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              player_name: "3x3_new",
              total_games: 1,
              wins: 1,
              losses: 0,
              draws: 0,
              win_rate: 100,
              average_apm: 200,
              average_eapm: 180,
              favorite_race: "P",
              race_stats: {},
              matchup_stats: {},
              map_stats: {}
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" }
            }
          )
        );
      }

      if (url.includes("/api/v1/users/suggest")) {
        return Promise.resolve(
          new Response(JSON.stringify({ users: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ total: 0, games: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <DashboardPage
        model={{
          ...DASHBOARD_FIXTURE,
          currentUser: "",
          playerStats: {
            ...DASHBOARD_FIXTURE.playerStats,
            name: ""
          }
        }}
      />
    );

    const queryInput = screen.getByLabelText(/플레이어 이름 입력/i);

    fireEvent.change(queryInput, { target: { value: "3x3_old" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^QUERY$/i }));
    });

    fireEvent.change(queryInput, { target: { value: "3x3_new" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^QUERY$/i }));
    });

    await act(async () => {
      deferredGames.new?.resolve(
        new Response(JSON.stringify(createGamesListResponse()), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
      await Promise.resolve();
    });

    expect(screen.getByText(/#48/i)).toBeInTheDocument();

    await act(async () => {
      deferredGames.old?.resolve(
        new Response(
          JSON.stringify({
            total: 1,
            analysis_statuses: { "901": "succeeded" },
            games: [
              {
                id: 901,
                map_name: "Old Map",
                game_length: 600,
                winner_team: 1,
                start_time: "2026-03-22T00:05:48Z",
                edges: {
                  players: [
                    { name: "3x3_old", race: "P", team: 1, start_location_x: 100, start_location_y: 100, apm: 120, eapm: 110, cmd_count: 100, effective_cmd_count: 90, redundancy: 10 }
                  ]
                }
              }
            ]
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      );
      await Promise.resolve();
    });

    expect(screen.queryByTestId("dashboard-game-row-901")).not.toBeInTheDocument();
    expect(screen.getByTestId("dashboard-game-row-48")).toBeInTheDocument();
  });

  it("ignores stale suggestion responses when newer input finishes later", async () => {
    vi.useFakeTimers();
    let resolveFirst: ((value: Response) => void) | null = null;
    let resolveSecond: ((value: Response) => void) | null = null;

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/v1/users/suggest?q=3x")) {
        return new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        });
      }

      if (url.includes("/api/v1/users/suggest?q=3x3_sm")) {
        return new Promise<Response>((resolve) => {
          resolveSecond = resolve;
        });
      }

      return Promise.resolve(
        new Response(JSON.stringify({ users: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<DashboardPage model={DASHBOARD_FIXTURE} />);

    const queryInput = screen.getByLabelText(/플레이어 이름 입력/i);

    fireEvent.change(queryInput, { target: { value: "3x" } });
    await act(async () => {
      vi.advanceTimersByTime(280);
    });

    fireEvent.change(queryInput, { target: { value: "3x3_sm" } });
    await act(async () => {
      vi.advanceTimersByTime(280);
    });

    await act(async () => {
      resolveSecond?.(
        new Response(JSON.stringify({ users: ["3x3_smwoo"] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
      await Promise.resolve();
    });

    expect(screen.getByRole("option", { name: "3x3_smwoo" })).toBeInTheDocument();

    await act(async () => {
      resolveFirst?.(
        new Response(JSON.stringify({ users: ["3x_old"] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
      await Promise.resolve();
    });

    expect(screen.queryByRole("option", { name: "3x_old" })).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("keeps suggestion failures in system logs without mutating the datalist", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/v1/users/suggest?q=3x3&limit=5")) {
        return new Response(JSON.stringify({ users: ["3x3_GG", "3x3_smwoo"] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/api/v1/users/suggest?q=3x3_fail")) {
        return new Response(JSON.stringify({ error: "suggest down" }), {
          status: 503,
          headers: { "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ users: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <DashboardPage
        model={{
          ...DASHBOARD_FIXTURE,
          currentUser: "",
          playerStats: {
            ...DASHBOARD_FIXTURE.playerStats,
            name: ""
          }
        }}
      />
    );

    const queryInput = screen.getByLabelText(/플레이어 이름 입력/i);
    fireEvent.change(queryInput, { target: { value: "3x3" } });
    await act(async () => {
      vi.advanceTimersByTime(280);
      await Promise.resolve();
    });

    expect(document.querySelectorAll("#dashboard-player-suggestions option")).toHaveLength(2);

    await act(async () => {
      fireEvent.change(queryInput, { target: { value: "3x3_fail" } });
      await Promise.resolve();
    });
    expect(document.querySelectorAll("#dashboard-player-suggestions option")).toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(280);
      await Promise.resolve();
    });

    expect(document.querySelectorAll("#dashboard-player-suggestions option")).toHaveLength(0);
    expect(screen.getByTestId("dashboard-system-logs")).toHaveTextContent("SUGGEST_FAIL: 3x3_fail");
    vi.useRealTimers();
  });

  it("does not inject fallback options when the suggestion API returns no users", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/v1/users/suggest?q=3x3_empty&limit=5")) {
        return new Response(JSON.stringify({ users: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ users: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <DashboardPage
        model={{
          ...DASHBOARD_FIXTURE,
          currentUser: "",
          playerStats: {
            ...DASHBOARD_FIXTURE.playerStats,
            name: ""
          }
        }}
      />
    );

    const queryInput = screen.getByLabelText(/플레이어 이름 입력/i);
    fireEvent.change(queryInput, { target: { value: "3x3_empty" } });

    await act(async () => {
      vi.advanceTimersByTime(280);
      await Promise.resolve();
    });

    expect(document.querySelectorAll("#dashboard-player-suggestions option")).toHaveLength(0);
    vi.useRealTimers();
  });

  it("clears the datalist when the query input is emptied", async () => {
    vi.useFakeTimers();
    let resolvePending: ((value: Response) => void) | null = null;

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/v1/users/suggest?q=3x3")) {
        return new Promise<Response>((resolve) => {
          resolvePending = resolve;
        });
      }

      return Promise.resolve(
        new Response(JSON.stringify({ users: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<DashboardPage model={DASHBOARD_FIXTURE} />);

    const queryInput = screen.getByLabelText(/플레이어 이름 입력/i);

    fireEvent.change(queryInput, { target: { value: "3x3" } });
    await act(async () => {
      vi.advanceTimersByTime(280);
    });

    fireEvent.change(queryInput, { target: { value: "" } });

    await act(async () => {
      resolvePending?.(
        new Response(JSON.stringify({ users: ["3x3_legacy"] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
      await Promise.resolve();
    });

    expect(screen.queryByRole("option", { name: "3x3_legacy" })).not.toBeInTheDocument();
    expect(document.querySelectorAll("#dashboard-player-suggestions option")).toHaveLength(0);
    vi.useRealTimers();
  });

  it("renders the legacy visualization stack and toggles fullscreen state", async () => {
    render(<DashboardPage model={DASHBOARD_FIXTURE} />);

    fireEvent.click(await screen.findByRole("button", { name: /open recent game 48/i }));

    const inlineRow = await screen.findByTestId("dashboard-inline-game-detail-row");
    const vizShell = within(inlineRow).getByTestId("dashboard-viz-shell");

    expect(within(inlineRow).getByText("Selected_Game")).toBeInTheDocument();
    expect(within(inlineRow).getByText("Game_Detail_Visualization")).toBeInTheDocument();
    expect(vizShell).toHaveAttribute("data-fullscreen", "false");
    expect(within(vizShell).getByRole("button", { name: /fullscreen/i })).toBeInTheDocument();
    expect(within(vizShell).getByText(/analysis notice/i)).toBeInTheDocument();
    expect(within(vizShell).getByText(/viz tab row/i)).toBeInTheDocument();
    expect(within(vizShell).getByRole("button", { name: "APM" })).toBeInTheDocument();
    expect(within(vizShell).getByRole("button", { name: "Unit_Production" })).toBeInTheDocument();
    expect(within(vizShell).getByRole("button", { name: "Resource_Spend" })).toBeInTheDocument();
    expect(within(vizShell).getByRole("button", { name: "Production" })).toBeInTheDocument();
    expect(within(vizShell).getByRole("button", { name: "Tech" })).toBeInTheDocument();
    expect(within(vizShell).getByRole("button", { name: "Battle" })).toBeInTheDocument();
    expect(within(vizShell).getByRole("button", { name: "Actions" })).toBeInTheDocument();
    expect(within(vizShell).getByText(/chart canvas area/i)).toBeInTheDocument();
    expect(within(vizShell).getByText(/legend row/i)).toBeInTheDocument();
    expect(within(vizShell).getByText(/hint row/i)).toBeInTheDocument();
    expect(within(vizShell).getByText(/tech-event info row/i)).toBeInTheDocument();
    expect(within(vizShell).getByText(/summary area/i)).toBeInTheDocument();
    expect(within(vizShell).getByText(/3x3_GG, 3x3_mh, 3x3_smwoo/i)).toBeInTheDocument();
    expect(within(vizShell).getAllByText(/5\/6 \| stable/i).length).toBeGreaterThan(0);

    fireEvent.click(within(vizShell).getByRole("button", { name: "Tech" }));

    expect(within(vizShell).getByRole("button", { name: "Tech" })).toHaveAttribute("aria-pressed", "true");
    expect(within(vizShell).getByText(/canvas shell for TECH/i)).toBeInTheDocument();
    expect(within(vizShell).getByText(/Reliability: 5\/6 \| stable/i)).toBeInTheDocument();

    fireEvent.click(within(vizShell).getByRole("button", { name: /fullscreen/i }));

    expect(vizShell).toHaveAttribute("data-fullscreen", "true");
    expect(document.body).toHaveClass("viz-fullscreen-lock");

    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });

    await waitFor(() => {
      expect(vizShell).toHaveAttribute("data-fullscreen", "false");
    });
    expect(document.body).not.toHaveClass("viz-fullscreen-lock");
  });
});
