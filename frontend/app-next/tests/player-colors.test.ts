import { getPlayerColor } from "@/lib/utils/player-colors";

describe("getPlayerColor", () => {
  it("preserves explicit palette entries for known players", () => {
    expect(getPlayerColor("3x3_GG")).toBe("#22d3ee");
    expect(getPlayerColor("3x3_pil")).toBe("#a78bfa");
  });

  it("assigns a stable vivid fallback color to unknown players", () => {
    expect(getPlayerColor("Gateway10001")).toBe(getPlayerColor("Gateway10001"));
    expect(getPlayerColor("Gateway10001")).not.toBe("#888");
    expect(getPlayerColor("Gateway10001")).not.toBe("#94a3b8");
  });

  it("spreads different unknown players across the fallback palette", () => {
    expect(getPlayerColor("Gateway10001")).not.toBe(getPlayerColor("startend82"));
  });
});

