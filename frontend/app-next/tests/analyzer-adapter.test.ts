import { getAnalyzerPageModel } from "@/lib/adapters/analyzer";

describe("analyzer adapter", () => {
  it("returns a selected game with tabs and selectable players", () => {
    const model = getAnalyzerPageModel();

    expect(model.games.length).toBeGreaterThan(0);
    expect(model.selectedGame).toBeTruthy();
    expect(model.tabs.length).toBeGreaterThan(0);
    expect(model.players.length).toBeGreaterThan(0);
  });
});
