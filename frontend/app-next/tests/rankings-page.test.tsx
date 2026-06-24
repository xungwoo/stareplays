import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RankingsTable } from "@/components/rankings/rankings-tables";
import { RankingsPage } from "@/components/rankings/rankings-page";
import { getRankingsPageModel } from "@/lib/adapters/rankings";
import type { RankingsPageModel } from "@/types/rankings";

type RankingsPageTestModel = RankingsPageModel & {
  rankingsError?: string;
  raceCompositionsError?: string;
};

function createModel(overrides: Partial<RankingsPageTestModel> = {}): RankingsPageTestModel {
  return {
    ...getRankingsPageModel(),
    ...overrides,
    tabs: overrides.tabs ?? getRankingsPageModel().tabs,
    summary: overrides.summary ?? getRankingsPageModel().summary,
    rankings: overrides.rankings ?? getRankingsPageModel().rankings,
    raceRankings: overrides.raceRankings ?? getRankingsPageModel().raceRankings,
    raceCompositions: overrides.raceCompositions ?? getRankingsPageModel().raceCompositions
  };
}

function expectDocumentOrder(before: HTMLElement, after: HTMLElement) {
  expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

describe("rankings page", () => {
  it("renders the extracted rankings table with the legacy columns", () => {
    const model = createModel();

    render(
      <RankingsTable
        model={model}
        currentUser={model.currentUser}
        sortBy="win_rate"
        sortDesc
        onSortChange={() => {}}
      />
    );

    expect(screen.getByRole("heading", { name: /rankings_3v3/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /win rate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /avg apm/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /avg eapm/i })).toBeInTheDocument();
    expect(screen.getByText(/CURRENT_USER:/i)).toBeInTheDocument();
  });

  it("toggles ranking sorts, preserves tab state, and uses legacy tie-break rules", async () => {
    render(<RankingsPage model={createModel()} />);
    const user = userEvent.setup();

    const winRateButton = screen.getByRole("button", { name: /win rate/i });
    const avgApmButton = screen.getByRole("button", { name: /avg apm/i });

    expect(winRateButton).toHaveTextContent("▼");

    await user.click(avgApmButton);
    expect(avgApmButton).toHaveTextContent("▼");
    expectDocumentOrder(screen.getByText("성민"), screen.getByText("성우"));

    await user.click(avgApmButton);
    expect(avgApmButton).toHaveTextContent("▲");
    expectDocumentOrder(screen.getByText("성우"), screen.getByText("성민"));

    await user.click(screen.getByRole("button", { name: /race_composition_winrate/i }));
    expect(screen.getByRole("heading", { name: /race_composition_winrate \(3v3\)/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /rankings_3v3/i }));
    expect(screen.getByRole("button", { name: /avg apm/i })).toHaveTextContent("▲");
    expectDocumentOrder(screen.getByText("성우"), screen.getByText("성민"));
  });

  it("renders race rankings including random-selection rankings", async () => {
    render(
      <RankingsPage
        model={createModel({
          raceRankings: [
            { race: "T", rank: 1, user: "3x3_alpha", games: 2, wins: 1, losses: 1, winRate: 50, avgApm: 170 },
            { race: "R", rank: 1, user: "3x3_alpha", games: 1, wins: 1, losses: 0, winRate: 100, avgApm: 180 }
          ]
        })}
      />
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /race_rankings/i }));

    expect(screen.getByRole("heading", { name: /race_rankings/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /random_rankings/i })).toBeInTheDocument();
    expect(screen.getAllByText("3x3_alpha").length).toBeGreaterThan(0);
  });

  it("sorts win rate and race composition ties with the legacy tie-break cascade", async () => {
    const model = createModel({
      rankings: [
        { rank: 1, user: "charlie", winRate: 55.8, wins: 24, losses: 19, draws: 0, games: 43, avgApm: 150, avgEapm: 180, isCurrentUser: false, favoriteRace: "P" },
        { rank: 2, user: "bravo", winRate: 55.8, wins: 24, losses: 19, draws: 0, games: 43, avgApm: 150, avgEapm: 170, isCurrentUser: true, favoriteRace: "Z" },
        { rank: 3, user: "alpha", winRate: 55.8, wins: 24, losses: 19, draws: 0, games: 43, avgApm: 150, avgEapm: 160, isCurrentUser: false, favoriteRace: "T" }
      ],
      raceCompositions: [
        { teamA: ["P", "P", "T"], teamB: ["P", "P", "Z"], games: 7, teamAWinPct: 50, teamBWinPct: 50, teamAWins: 3, teamBWins: 4 },
        { teamA: ["P", "P", "P"], teamB: ["P", "P", "T"], games: 8, teamAWinPct: 66.7, teamBWinPct: 33.3, teamAWins: 5, teamBWins: 3 },
        { teamA: ["P", "P", "P"], teamB: ["P", "P", "P"], games: 9, teamAWinPct: 50, teamBWinPct: 50, teamAWins: 4, teamBWins: 5 }
      ]
    });

    render(<RankingsPage model={model} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /win rate/i }));
    expectDocumentOrder(screen.getByText("alpha"), screen.getByText("bravo"));
    expectDocumentOrder(screen.getByText("bravo"), screen.getByText("charlie"));

    await user.click(screen.getByRole("button", { name: /avg apm/i }));
    expectDocumentOrder(screen.getByText("alpha"), screen.getByText("bravo"));
    expectDocumentOrder(screen.getByText("bravo"), screen.getByText("charlie"));

    await user.click(screen.getByRole("button", { name: /race_composition_winrate/i }));
    expect(screen.getAllByText(/^(7|8|9)$/).map((node) => node.textContent)).toEqual(["9", "8", "7"]);

    await user.click(screen.getByRole("button", { name: /team_a win/i }));
    expect(screen.getAllByText(/^(7|8|9)$/).map((node) => node.textContent)).toEqual(["8", "9", "7"]);
  });

  it("highlights the current user row with legacy semantics", () => {
    render(<RankingsPage model={createModel()} />);

    const currentUserRow = screen.getByText("성우").closest("div[style]");
    expect(screen.getByText("YOU")).toBeInTheDocument();
    expect(currentUserRow).toHaveStyle({ backgroundColor: "rgba(255, 255, 255, 0.4)" });
  });

  it("renders legacy empty copy for both rankings tables", async () => {
    render(
      <RankingsPage
        model={createModel({
          rankings: [],
          raceCompositions: []
        })}
      />
    );
    const user = userEvent.setup();

    expect(screen.getByText("NO_3V3_RANKINGS")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /race_composition_winrate/i }));
    expect(screen.getByText("NO_MATCHUP_DATA")).toBeInTheDocument();
  });

  it("renders legacy error copy for both rankings tables", async () => {
    render(
      <RankingsPage
        model={createModel({
          rankings: [],
          raceCompositions: [],
          rankingsError: "boom",
          raceCompositionsError: "kaboom"
        })}
      />
    );
    const user = userEvent.setup();

    expect(screen.getByText(/ERROR_LOAD_RANKINGS: boom/i)).toBeInTheDocument();
    expect(screen.queryByText(/ERROR_LOAD_ANALYZER: kaboom/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /race_composition_winrate/i }));
    expect(screen.getByText(/ERROR_LOAD_ANALYZER: kaboom/i)).toBeInTheDocument();
    expect(screen.getByText("NO_MATCHUP_DATA")).toBeInTheDocument();
  });

  it("forces the race composition tab into the legacy error-empty state even if stale rows exist", async () => {
    render(
      <RankingsPage
        model={createModel({
          raceCompositionsError: "kaboom"
        })}
      />
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /race_composition_winrate/i }));

    expect(screen.getByText(/ERROR_LOAD_ANALYZER: kaboom/i)).toBeInTheDocument();
    expect(screen.getByText("NO_MATCHUP_DATA")).toBeInTheDocument();
    expect(screen.queryByText(/^PPT$/i)).not.toBeInTheDocument();
  });

  it("keeps the rankings sort state when switching tabs", async () => {
    render(<RankingsPage model={createModel()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /avg eapm/i }));
    expect(screen.getByRole("button", { name: /avg eapm/i })).toHaveTextContent("▼");

    await user.click(screen.getByRole("button", { name: /race_composition_winrate/i }));
    await user.click(screen.getByRole("button", { name: /rankings_3v3/i }));

    expect(screen.getByRole("button", { name: /avg eapm/i })).toHaveTextContent("▼");
    expectDocumentOrder(screen.getByText("성민"), screen.getByText("성우"));
  });
});
