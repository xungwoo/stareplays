import { getStartGridBoard } from "@/lib/utils/start-grid-board";
import type { VaultGame } from "@/types/vault";

function createGame(overrides: Partial<VaultGame> = {}): VaultGame {
  return {
    id: 1,
    map: "OP3060 CLAN 6슈빨무",
    matchup: "3v3",
    winnerTeam: [
      { name: "3x3_GG", race: "P", apm: 148, eapm: 126, cmd: 2050, ecmd: 1746, effective: 85.2, redundancy: 15, production: 203, startLocationX: 4000, startLocationY: 100 },
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
    startTime: "2026-03-23 01:00:00",
    matchStory: "Test",
    ...overrides
  };
}

describe("start grid board", () => {
  it("derives left and right side order from start positions instead of winner and loser grouping", () => {
    const board = getStartGridBoard(createGame());

    expect(board.leftColumn.map((entry) => `${entry.player.name}:${entry.result}`)).toEqual([
      "3x3_Kiyong:LOSER",
      "3x3_syntax:LOSER",
      "3x3_mh:WINNER"
    ]);
    expect(board.rightColumn.map((entry) => `${entry.player.name}:${entry.result}`)).toEqual([
      "3x3_GG:WINNER",
      "3x3_smwoo:WINNER",
      "3x3_pil:LOSER"
    ]);
  });

  it("falls back to a deterministic split when start positions are missing", () => {
    const board = getStartGridBoard(
      createGame({
        winnerTeam: [
          { name: "alpha", race: "P", apm: 1, eapm: 1, cmd: 1, ecmd: 1, effective: 1, redundancy: 1, production: 1 },
          { name: "bravo", race: "T", apm: 1, eapm: 1, cmd: 1, ecmd: 1, effective: 1, redundancy: 1, production: 1 },
          { name: "charlie", race: "Z", apm: 1, eapm: 1, cmd: 1, ecmd: 1, effective: 1, redundancy: 1, production: 1 }
        ],
        loserTeam: [
          { name: "delta", race: "P", apm: 1, eapm: 1, cmd: 1, ecmd: 1, effective: 1, redundancy: 1, production: 1 },
          { name: "echo", race: "T", apm: 1, eapm: 1, cmd: 1, ecmd: 1, effective: 1, redundancy: 1, production: 1 },
          { name: "foxtrot", race: "Z", apm: 1, eapm: 1, cmd: 1, ecmd: 1, effective: 1, redundancy: 1, production: 1 }
        ]
      })
    );

    expect(board.leftColumn.map((entry) => entry.player.name)).toEqual(["alpha", "bravo", "charlie"]);
    expect(board.rightColumn.map((entry) => entry.player.name)).toEqual(["delta", "echo", "foxtrot"]);
  });
});
