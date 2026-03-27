import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  });

  it("starts with the legacy no-preview terminal state", () => {
    render(<DashboardPage model={DASHBOARD_FIXTURE} />);

    expect(screen.getByText("NO_PREVIEW")).toBeInTheDocument();
    expect(screen.getByText("READY")).toBeInTheDocument();
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

    expect(screen.getByText(/^Replay Upload$/i)).toBeInTheDocument();
    expect(screen.getByText(/플레이어 선택 \(Simple Login\)/i)).toBeInTheDocument();
    expect(screen.getByText(/select_player_from_parsed_replay/i)).toBeInTheDocument();
    expect(screen.getByText(/^HOW TO USE$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Player Stats Query$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^QUERY$/i })).toHaveClass("transition-all");
    expect(screen.getByText(/^Win Rate Progress$/i)).toBeInTheDocument();
    expect(screen.getByText(DASHBOARD_FIXTURE.playerStats.favoriteRaceLabel)).toHaveClass("text-amber-400");
    expect(screen.getByText(/^CURRENT_USER:$/i).nextElementSibling).toHaveTextContent(DASHBOARD_FIXTURE.currentUser);
    expect(screen.getByText(/^Player Stats Query$/i).parentElement).toHaveClass("p-5");
    expect(screen.getByText(/^Player Stats Query$/i).parentElement).toHaveStyle({
      backgroundColor: "#0d1833",
      border: "1px solid rgba(34,211,238,0.1)"
    });
    expect(screen.getByText(/^HOW TO USE$/i).parentElement).toHaveStyle({
      border: "1px solid rgba(34,211,238,0.1)"
    });
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
    expect(screen.getByText(/^READY$/i).parentElement).toHaveStyle({
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
    expect(container.querySelector(".h-3.overflow-hidden.rounded-full")).toHaveStyle({
      backgroundColor: "#0a1428"
    });
    expect(screen.getByText(/^PLAYER$/i).nextElementSibling?.querySelector("span")).toHaveStyle({
      color: "#22d3ee"
    });
    expect(screen.getByText(`${DASHBOARD_FIXTURE.playerStats.winRate.toFixed(1)}%`, {
      selector: "p"
    })).toHaveStyle({
      color: "#22d3ee"
    });

    const progressLabels = [...container.querySelectorAll("span")].filter((element) => {
      return element.textContent?.startsWith("WIN ") || element.textContent?.startsWith("LOSS ");
    });

    expect(progressLabels.some((element) => element.textContent?.startsWith("WIN ") && element.className.includes("text-emerald-400"))).toBe(true);
    expect(progressLabels.some((element) => element.textContent?.startsWith("LOSS ") && element.className.includes("text-red-400"))).toBe(true);
    expect(screen.getByText("56.4%")).toHaveStyle({
      color: "#34d399"
    });
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

    expect(await screen.findByText(/ANALYZE_OK: 1\/1 files/i)).toBeInTheDocument();
    expect(screen.getByText(/Analysis Completed/i)).toBeInTheDocument();
    expect(screen.getAllByText(/common players: 3x3_GG/i)).not.toHaveLength(0);
    expect(screen.getAllByText("ladder.rep")).not.toHaveLength(0);
    expect(screen.getByText(/OK ladder\.rep - map: Polypoid/i)).toBeInTheDocument();
    expect(screen.getAllByText(/3x3_GG, 3x3_mh, 3x3_smwoo/i)).not.toHaveLength(0);
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
    expect(screen.getByRole("button", { name: /upload_with_selected_user/i })).toBeEnabled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /upload_with_selected_user/i }));
    });

    expect(
      await screen.findByText(/UPLOAD_FAIL: 'legacy_bad_user' is not a common participant in current analyzed files/i)
    ).toBeInTheDocument();
    expect(submitReplayUploadMock).not.toHaveBeenCalled();
  });

  it("keeps the prior pending state visible when a later preview fails", async () => {
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

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /analyze_replay/i }));
    });

    expect(await screen.findByText(/ANALYZE_FAIL: broken preview/i)).toBeInTheDocument();
    expect(screen.getAllByText(/common players: 3x3_GG/i)).not.toHaveLength(0);
    expect(screen.getByText(/OK first\.rep - map: Circuit Breaker/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload_with_selected_user/i })).toBeEnabled();
  });

  it("updates the upload module when a replay file is selected and analyzed", async () => {
    render(<DashboardPage model={DASHBOARD_FIXTURE} />);

    const fileInput = document.querySelector("#replay-file") as HTMLInputElement;
    const analyzeButton = screen.getByRole("button", { name: /analyze_replay/i });

    expect(analyzeButton).toBeDisabled();
    expect(analyzeButton).toHaveClass("transition-all", "duration-200");
    expect(screen.getByText(/^READY$/i)).toBeInTheDocument();

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

  it("uploads the previewed replay with the selected current user and exposes follow-up links", async () => {
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
    expect(await screen.findByText(/upload complete/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open replay vault/i })).toHaveAttribute("href", "/vault?currentUser=3x3_GG");
    expect(screen.getByRole("link", { name: /open analyzer/i })).toHaveAttribute("href", "/analyzer?currentUser=3x3_GG&gameId=88");
    expect(document.cookie).toContain("current_user=3x3_GG");
    expect(globalThis.__TEST_ROUTER__.replace).toHaveBeenCalledWith("/?currentUser=3x3_GG");
    expect(globalThis.__TEST_ROUTER__.refresh).toHaveBeenCalled();
  });

  it("queries live player stats and suggestions from the api", async () => {
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

    render(<DashboardPage model={DASHBOARD_FIXTURE} />);

    const queryInput = screen.getByLabelText(/플레이어 이름 입력/i);
    fireEvent.change(queryInput, { target: { value: "3x3_smwoo" } });

    await act(async () => {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 220);
      });
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/v1/users/suggest?q=3x3_smwoo"), expect.any(Object));
    });
    expect(await screen.findByRole("option", { name: "3x3_smwoo" })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^QUERY$/i }));
    });

    expect(await screen.findAllByText("3x3_smwoo")).not.toHaveLength(0);
    expect(screen.getByText("TERRAN")).toBeInTheDocument();
    expect(await screen.findAllByText("70.4%")).not.toHaveLength(0);
    expect(screen.getByLabelText(/플레이어 선택/i)).toHaveValue("3x3_smwoo");
    expect(document.cookie).toContain("current_user=3x3_smwoo");
    expect(globalThis.__TEST_ROUTER__.replace).toHaveBeenCalledWith("/?currentUser=3x3_smwoo");
    expect(globalThis.__TEST_ROUTER__.refresh).toHaveBeenCalled();
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
      vi.advanceTimersByTime(200);
    });

    fireEvent.change(queryInput, { target: { value: "3x3_sm" } });
    await act(async () => {
      vi.advanceTimersByTime(200);
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

  it("does not restore stale suggestions after the query input is cleared", async () => {
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
      vi.advanceTimersByTime(200);
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
    expect(screen.getByRole("option", { name: DASHBOARD_FIXTURE.playerStats.name })).toBeInTheDocument();
    vi.useRealTimers();
  });
});
