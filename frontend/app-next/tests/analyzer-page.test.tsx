import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AnalyzerPage from "@/app/analyzer/page";
import { AnalyzerPage as AnalyzerPageComponent } from "@/components/analyzer/analyzer-page";
import type { AnalyzerPageModel } from "@/types/analyzer";

describe("analyzer page", () => {
  it("renders the figma analyzer workspace and switches timeline tabs", async () => {
    const { container } = render(await AnalyzerPage({}));
    const user = userEvent.setup();

    expect(screen.getByText(/한 게임의 흐름과 플레이어별 분석을 함께 보는 상세 분석 화면/i)).toBeInTheDocument();
    expect(screen.getByText(/CURRENT_USER: 3x3_GG/i)).toBeInTheDocument();
    expect(screen.getByText(/^GAME SELECTOR$/i)).toBeInTheDocument();
    expect(screen.getByText(/^TIMELINE WORKSPACE$/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^resource spend$/i }));
    expect(screen.getByText(/replay_analyzer_status/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^tech \/ upgrade$/i })).toBeInTheDocument();

    const apmTab = screen.getByRole("button", { name: /^apm$/i });
    await user.click(apmTab);
    expect(apmTab).toHaveStyle({
      backgroundColor: "rgba(34, 211, 238, 0.15)",
      color: "#22d3ee"
    });
    expect(container.querySelector(".recharts-responsive-container")?.parentElement).toHaveStyle({
      backgroundColor: "#0a1428",
      border: "1px solid rgba(255,255,255,0.05)"
    });

    expect(screen.getByRole("button", { name: /^Prev$/i })).toHaveStyle({
      border: "1px solid rgba(255,255,255,0.1)"
    });
    expect(screen.getByRole("link", { name: "" })).toHaveAttribute("href", "/analyzer?currentUser=3x3_GG&gameId=48");
    expect(screen.getByText(/^GAME SELECTOR$/i).parentElement).toHaveStyle({
      borderBottom: "1px solid rgba(255,255,255,0.06)"
    });
    expect(screen.getByRole("button", { name: /^Prev$/i }).parentElement).toHaveStyle({
      borderTop: "1px solid rgba(255,255,255,0.05)"
    });
    expect(screen.getByText(/replay_analyzer_status/i).parentElement).toHaveStyle({
      backgroundColor: "#0a1428",
      border: "1px solid rgba(255,255,255,0.06)"
    });
    expect(screen.getByText(/^PLAYER DEEP DIVE$/i).parentElement).toHaveStyle({
      backgroundColor: "#0d1833",
      border: "1px solid rgba(34,211,238,0.1)"
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
      backgroundColor: "rgba(255,255,255,0.06)"
    });
  });

  it("keeps the focused player selection when switching games, matching the source behavior", async () => {
    render(await AnalyzerPage({}));
    const user = userEvent.setup();
    const deepDive = screen.getByText(/^PLAYER DEEP DIVE$/i).parentElement as HTMLElement;

    await user.click(within(deepDive).getByRole("button", { name: /3x3_gg/i }));
    expect(within(deepDive).getByText(/^APM$/i)).toBeInTheDocument();

    await user.click(screen.getByText(/^#47$/i));
    expect(within(deepDive).getByText(/^APM$/i)).toBeInTheDocument();
    expect(within(deepDive).getByRole("button", { name: /3x3_gg/i })).toHaveStyle({
      backgroundColor: "rgba(34,211,238,0.08)"
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

    expect(within(leftColumn).getAllByTestId("start-grid-player-name").map((node) => node.textContent)).toEqual(["3x3_Kiyong", "3x3_syntax", "3x3_mh"]);
    expect(within(rightColumn).getAllByTestId("start-grid-player-name").map((node) => node.textContent)).toEqual(["3x3_GG", "3x3_smwoo", "3x3_pil"]);
  });
});
