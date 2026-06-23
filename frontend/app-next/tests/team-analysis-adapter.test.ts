import { createTeamAnalysisPageModel } from "@/lib/adapters/team-analysis";
import type { ApiGamesListResponse } from "@/types/api";

const gamesResponse: ApiGamesListResponse = {
  total: 4,
  games: [
    {
      id: 1,
      map_name: "Team Circuit",
      winner_team: 1,
      game_length: 900,
      start_time: "2026-03-01T00:00:00Z",
      edges: {
        players: [
          { name: "3x3_alpha", race: "P", team: 1, apm: 210, eapm: 170, cmd_count: 2100, effective_cmd_count: 1700 },
          { name: "3x3_bravo", race: "T", team: 1, apm: 180, eapm: 150, cmd_count: 1800, effective_cmd_count: 1500 },
          { name: "3x3_charlie", race: "Z", team: 1, apm: 160, eapm: 130, cmd_count: 1600, effective_cmd_count: 1300 },
          { name: "3x3_delta", race: "P", team: 2, apm: 155, eapm: 120, cmd_count: 1550, effective_cmd_count: 1200 },
          { name: "3x3_echo", race: "P", team: 2, apm: 145, eapm: 115, cmd_count: 1450, effective_cmd_count: 1150 },
          { name: "guest_foxtrot", race: "T", team: 2, apm: 200, eapm: 160, cmd_count: 2000, effective_cmd_count: 1600 }
        ]
      }
    },
    {
      id: 2,
      map_name: "Team Circuit",
      winner_team: 2,
      game_length: 840,
      start_time: "2026-03-02T00:00:00Z",
      edges: {
        players: [
          { name: "3x3_alpha", race: "P", team: 1, apm: 200, eapm: 160, cmd_count: 2000, effective_cmd_count: 1600 },
          { name: "3x3_bravo", race: "T", team: 1, apm: 170, eapm: 140, cmd_count: 1700, effective_cmd_count: 1400 },
          { name: "3x3_delta", race: "Z", team: 1, apm: 165, eapm: 135, cmd_count: 1650, effective_cmd_count: 1350 },
          { name: "3x3_charlie", race: "Z", team: 2, apm: 190, eapm: 155, cmd_count: 1900, effective_cmd_count: 1550 },
          { name: "3x3_echo", race: "P", team: 2, apm: 150, eapm: 122, cmd_count: 1500, effective_cmd_count: 1220 },
          { name: "3x3_foxtrot", race: "T", team: 2, apm: 175, eapm: 145, cmd_count: 1750, effective_cmd_count: 1450 }
        ]
      }
    },
    {
      id: 3,
      map_name: "Neo Junction",
      winner_team: 1,
      game_length: 760,
      start_time: "2026-03-03T00:00:00Z",
      edges: {
        players: [
          { name: "3x3_alpha", race: "T", team: 1, apm: 220, eapm: 180, cmd_count: 2200, effective_cmd_count: 1800 },
          { name: "3x3_echo", race: "P", team: 1, apm: 155, eapm: 128, cmd_count: 1550, effective_cmd_count: 1280 },
          { name: "3x3_foxtrot", race: "P", team: 1, apm: 180, eapm: 150, cmd_count: 1800, effective_cmd_count: 1500 },
          { name: "3x3_bravo", race: "T", team: 2, apm: 165, eapm: 138, cmd_count: 1650, effective_cmd_count: 1380 },
          { name: "3x3_charlie", race: "Z", team: 2, apm: 170, eapm: 142, cmd_count: 1700, effective_cmd_count: 1420 },
          { name: "3x3_delta", race: "P", team: 2, apm: 150, eapm: 119, cmd_count: 1500, effective_cmd_count: 1190 }
        ]
      }
    },
    {
      id: 4,
      map_name: "Ignored Solo",
      winner_team: 1,
      game_length: 600,
      edges: {
        players: [
          { name: "solo_alpha", race: "P", team: 1, apm: 300 },
          { name: "solo_bravo", race: "T", team: 2, apm: 100 }
        ]
      }
    }
  ]
};

describe("team analysis adapter", () => {
  it("aggregates only complete 3x3 official matches into player, race, lineup, and rating analysis", () => {
    const model = createTeamAnalysisPageModel({ gamesResponse });

    expect(model.summary.gamesAnalyzed).toBe(2);
    expect(model.summary.playersTracked).toBe(6);
    expect(model.summary.lineupsTracked).toBeGreaterThanOrEqual(4);
    expect(model.players.map((player) => player.name)).not.toContain("guest_foxtrot");
    expect(model.players.map((player) => player.name)).not.toContain("solo_alpha");

    const alpha = model.players.find((player) => player.name === "3x3_alpha");
    expect(alpha).toMatchObject({
      games: 2,
      wins: 1,
      losses: 1,
      winRate: 50,
      averageApm: 210,
      bestRace: "T"
    });
    expect(alpha?.raceStats).toEqual([
      { race: "P", games: 1, wins: 0, losses: 1, winRate: 0, qualified: false },
      { race: "T", games: 1, wins: 1, losses: 0, winRate: 100, qualified: false }
    ]);
    expect(alpha?.apmRank).toBe(1);
    expect(alpha?.bradleyTerry).not.toBe(1000);
    expect(alpha?.bradleyTerryRank).toBeGreaterThan(0);
    expect(alpha?.trueSkill).not.toBe(0);
    expect(alpha?.trueSkillRank).toBeGreaterThan(0);

    const firstLineup = model.lineups[0];
    expect(firstLineup?.players).toHaveLength(3);
    expect(firstLineup?.winRate).toBeGreaterThanOrEqual(0);
    expect(model.raceCompositions.some((row) => row.composition === "PTZ")).toBe(true);
    expect(model.chartData.ratingComparison[0]).toHaveProperty("bradleyTerry");
    expect(model.chartData.ratingComparison[0]).toHaveProperty("trueSkill");
    expect(model.chartData.ratingComparison[0]).toHaveProperty("bradleyTerryRankScore");
    expect(model.chartData.ratingComparison[0]).toHaveProperty("trueSkillRankScore");
    expect(model.chartData.ratingComparison.every((row) => row.bradleyTerryRankScore >= 0 && row.bradleyTerryRankScore <= 100)).toBe(true);
    expect(model.chartData.ratingComparison.every((row) => row.trueSkillRankScore >= 0 && row.trueSkillRankScore <= 100)).toBe(true);
    expect(model.chartData.playerPentagons).toHaveLength(3);
    expect(model.chartData.playerPentagons.map((chart) => chart.title)).toEqual([
      "승부 감각 오각형",
      "종족 역량 오각형",
      "리플레이 피지컬 오각형"
    ]);
    expect(model.chartData.playerPentagons[1]?.axes).toEqual(["프로토스", "저그", "테란", "랜덤", "전체 역량"]);
    expect(model.chartData.playerPentagons.every((chart) => chart.players.length > 0)).toBe(true);
    expect(model.chartData.playerPentagons.flatMap((chart) => chart.players.flatMap((player) => player.axes)).every((axis) => axis.value >= 0 && axis.value <= 100)).toBe(true);
    expect(model.insights.bestLineup?.title).toContain("최고 조합");
    expect(model.insights.worstLineup?.title).toContain("최악 조합");
    expect(model.insights.bestDuo?.title).toContain("최강 듀오");
    expect(model.insights.randomReadyPlayer?.title).toContain("랜덤 적응");
    expect(model.insights.randomRiskPlayer?.title).toContain("랜덤 리스크");
    expect(model.insights.cards.map((card) => card.label)).toEqual(expect.not.arrayContaining(["인사이트 1", "인사이트 2", "인사이트 3"]));
    expect(model.insights.cards.length).toBeGreaterThanOrEqual(8);
    expect(model.insights.cards.every((card) => /[가-힣]/.test(`${card.title} ${card.body}`))).toBe(true);
    expect(model.insights.cards.some((card) => /꿀조합|특급 케미|비상벨|주사위/.test(`${card.title} ${card.body}`))).toBe(true);
  });
});
