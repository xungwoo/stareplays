import { createRankingsPageModel, getRankingsPageModel } from "@/lib/adapters/rankings";

describe("rankings adapter", () => {
  it("creates summary metrics and two tabs from fixture data", () => {
    const model = getRankingsPageModel();

    expect(model.tabs).toHaveLength(3);
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

  it("builds race and random-selection rankings from game rows", () => {
    const model = createRankingsPageModel({
      gamesResponse: {
        games: [
          {
            winner_team: 1,
            edges: {
              players: [
                { name: "3x3_alpha", race: "T", team: 1, apm: 180, is_random_selected: true },
                { name: "3x3_beta", race: "P", team: 2, apm: 150 }
              ]
            }
          },
          {
            winner_team: 2,
            edges: {
              players: [
                { name: "3x3_alpha", race: "T", team: 1, apm: 160 },
                { name: "3x3_beta", race: "Z", team: 2, apm: 170 }
              ]
            }
          }
        ]
      }
    });

    expect(model.raceRankings).toEqual(expect.arrayContaining([
      expect.objectContaining({ race: "T", user: "3x3_alpha", games: 2, wins: 1, losses: 1 }),
      expect.objectContaining({ race: "R", user: "3x3_alpha", games: 1, wins: 1, losses: 0 }),
    ]));
    expect(model.raceRankings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ race: "R", user: "3x3_beta" })
    ]));
  });
});
