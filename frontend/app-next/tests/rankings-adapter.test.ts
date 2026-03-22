import { getRankingsPageModel } from "@/lib/adapters/rankings";

describe("rankings adapter", () => {
  it("creates summary metrics and two tabs from fixture data", () => {
    const model = getRankingsPageModel();

    expect(model.tabs).toHaveLength(2);
    expect(model.summary.length).toBeGreaterThan(0);
    expect(model.rankings.length).toBeGreaterThan(0);
    expect(model.raceCompositions.length).toBeGreaterThan(0);
  });
});
