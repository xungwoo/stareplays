import { getOrderedGamePlayers } from "@/lib/utils/analyzer-player-order";
import type { VaultGame } from "@/types/vault";

describe("getOrderedGamePlayers", () => {
  it("returns selected-game players in winner-plus-loser order with selected-game stats, matching the source behavior", () => {
    const game: VaultGame = {
      id: 1,
      map: "Circuit Breaker",
      matchup: "PTZvPTZ",
      winnerTeam: [
        { name: "alpha", race: "P", apm: 101, eapm: 88, cmd: 1001, ecmd: 901, effective: 81.5, redundancy: 7, production: 95, isCurrentUser: true },
        { name: "bravo", race: "T", apm: 102, eapm: 89, cmd: 1002, ecmd: 902, effective: 82.5, redundancy: 8, production: 96 }
      ],
      loserTeam: [{ name: "charlie", race: "Z", apm: 103, eapm: 90, cmd: 1003, ecmd: 903, effective: 83.5, redundancy: 9, production: 97 }],
      analyzerStatus: "DONE",
      playTime: "12:34",
      startTime: "2026-03-23 10:00",
      matchStory: "Test match",
      keyPlayer: "game-key",
      worstPlayer: "game-worst"
    };

    expect(getOrderedGamePlayers(game)).toEqual([
      game.winnerTeam[0],
      game.winnerTeam[1],
      game.loserTeam[0]
    ]);
  });
});
