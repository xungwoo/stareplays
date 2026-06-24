import { createTeamAnalysisRawPayload } from "@/lib/adapters/team-analysis-raw";
import type { ApiGamesListResponse } from "@/types/api";

const gamesResponse: ApiGamesListResponse = {
  total: 1,
  games: [
    {
      id: 101,
      map_name: "Season Arena",
      winner_team: 1,
      game_length: 900,
      is_random_selected: true,
      start_time: "2026-06-01T00:00:00Z",
      season_label: "시즌7",
      edges: {
        players: [
          { name: "3x3_GG", race: "P", team: 1, apm: 190, eapm: 160, cmd_count: 1900, effective_cmd_count: 1600 },
          { name: "3x3_mh", race: "T", team: 1, apm: 180, eapm: 150, cmd_count: 1800, effective_cmd_count: 1500 },
          { name: "3x3_smwoo", race: "Z", team: 1, apm: 210, eapm: 170, cmd_count: 2100, effective_cmd_count: 1700 },
          { name: "3x3_Kiyong", race: "P", team: 2, apm: 175, eapm: 145, cmd_count: 1750, effective_cmd_count: 1450 },
          { name: "3x3_syntax", race: "T", team: 2, apm: 165, eapm: 135, cmd_count: 1650, effective_cmd_count: 1350 },
          { name: "3x3_pil", race: "Z", team: 2, apm: 185, eapm: 155, cmd_count: 1850, effective_cmd_count: 1550 }
        ]
      }
    }
  ]
};

describe("team analysis raw payload", () => {
  it("creates an LLM-friendly raw data snapshot with stable metadata", () => {
    const payload = createTeamAnalysisRawPayload({
      gamesResponse,
      seasonLabel: "시즌7",
      generatedAt: "2026-06-24T00:00:00.000Z"
    });

    expect(payload.schemaVersion).toBe("stareplays.team-analysis.raw.v2");
    expect(payload.generatedAt).toBe("2026-06-24T00:00:00.000Z");
    expect(payload.scope).toEqual({ teamSize: "3x3", seasonLabel: "시즌7" });
    expect(payload.features.isRandomSelected).toBe(true);
    expect(payload.source.totalGames).toBe(1);
    expect(payload.source.randomSelectedGames).toBe(1);
    expect(payload.analysis.summary.gamesAnalyzed).toBe(1);
    expect(payload.analysis.summary.randomSelectedGames).toBe(1);
    expect(payload.analysis.recentMatches[0]?.isRandomSelected).toBe(true);
    expect(payload.analysis.players.map((player) => player.name)).toEqual(expect.arrayContaining(["성우", "민혁", "성민"]));
    expect(payload.llm.promptTitle).toContain("3x3 팀 전적 분석");
    expect(payload.llm.analysisGuidance.join("\n")).toContain("isRandomSelected=true");
    expect(payload.llm.suggestedQuestions.length).toBeGreaterThanOrEqual(4);
  });
});
