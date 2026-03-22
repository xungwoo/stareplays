import { createRankingsPageModel, getRankingsPageModel } from "@/lib/adapters/rankings";

describe("rankings adapter", () => {
  it("creates summary metrics and two tabs from fixture data", () => {
    const model = getRankingsPageModel();

    expect(model.tabs).toHaveLength(2);
    expect(model.summary.length).toBeGreaterThan(0);
    expect(model.rankings.length).toBeGreaterThan(0);
    expect(model.raceCompositions.length).toBeGreaterThan(0);
  });

  it("preserves the resolved current user even when ranking rows do not include that player", () => {
    const model = createRankingsPageModel({
      currentUser: "cookie-user",
      rankingsResponse: {
        rankings: [{ rank: 1, name: "another-user", games: 10, wins: 6, losses: 4, draws: 0, win_rate: 60, avg_apm: 150, avg_eapm: 130 }]
      }
    });

    expect(model.currentUser).toBe("cookie-user");
    expect(model.rankings[0]?.isCurrentUser).toBe(false);
  });
});
