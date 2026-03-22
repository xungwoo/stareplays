import { getDashboardPageModel } from "@/lib/adapters/dashboard";

describe("dashboard adapter", () => {
  it("creates upload guidance and player summary data for the figma dashboard", () => {
    const model = getDashboardPageModel();

    expect(model.uploadPlaceholder).toBe("SELECT_PLAYER_FROM_PARSED_REPLAY");
    expect(model.quickTips.length).toBe(4);
    expect(model.playerStats.favoriteRaceLabel.length).toBeGreaterThan(0);
    expect(model.metrics.length).toBeGreaterThan(0);
  });
});
