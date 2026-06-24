import { createSeasonAnalysisPageModel } from "@/lib/adapters/season-analysis";
import type { ApiSeasonsResponse } from "@/types/api";

const seasonsResponse: ApiSeasonsResponse = {
  seasons: [
    {
      season_label: "시즌1",
      season_no: 1,
      games: 2,
      wins_by_team: { "1": 1, "2": 1 },
      games_data: [
        {
          id: 1,
          season_label: "시즌1",
          season_no: 1,
          start_time: "2026-01-01T00:00:00Z",
          map_name: "Neo Super",
          game_length: 600,
          winner_team: 1,
          is_random_selected: true,
          season_analysis: {
            status: "succeeded",
            data_source: "detail_analysis+replay_analyzer",
            players: {
              "3x3_GG": { production: 70, resource_spend: 7000, worker_peak: 30, kills: 2, tech_and_upgrades: 3 },
              "3x3_mh": { production: 75, resource_spend: 7600, worker_peak: 31, kills: 3, tech_and_upgrades: 4 },
              "3x3_syntax": { production: 65, resource_spend: 6500, worker_peak: 28, kills: 2, tech_and_upgrades: 2 },
              "3x3_pil": { production: 68, resource_spend: 6800, worker_peak: 29, kills: 2, tech_and_upgrades: 2 },
              "3x3_smwoo": { production: 105, resource_spend: 10500, worker_peak: 40, kills: 7, tech_and_upgrades: 8 },
              "3x3_Kiyong": { production: 80, resource_spend: 7900, worker_peak: 32, kills: 3, tech_and_upgrades: 4 }
            }
          },
          edges: {
            players: [
              { name: "3x3_GG", race: "P", team: 1, apm: 150, eapm: 130 },
              { name: "3x3_mh", race: "T", team: 1, apm: 170, eapm: 140 },
              { name: "3x3_syntax", race: "Z", team: 1, apm: 120, eapm: 105 },
              { name: "3x3_pil", race: "P", team: 2, apm: 140, eapm: 120 },
              { name: "3x3_smwoo", race: "P", team: 2, apm: 190, eapm: 165 },
              { name: "3x3_Kiyong", race: "T", team: 2, apm: 180, eapm: 150 }
            ]
          }
        },
        {
          id: 2,
          season_label: "시즌1",
          season_no: 1,
          start_time: "2026-01-02T00:00:00Z",
          map_name: "Neo Super",
          game_length: 900,
          winner_team: 2,
          season_analysis: {
            status: "succeeded",
            data_source: "detail_analysis+replay_analyzer",
            players: {
              "3x3_GG": { production: 72, resource_spend: 7100, worker_peak: 30, kills: 2, tech_and_upgrades: 3 },
              "3x3_mh": { production: 74, resource_spend: 7500, worker_peak: 31, kills: 2, tech_and_upgrades: 4 },
              "3x3_syntax": { production: 66, resource_spend: 6600, worker_peak: 28, kills: 2, tech_and_upgrades: 2 },
              "3x3_pil": { production: 70, resource_spend: 7000, worker_peak: 30, kills: 3, tech_and_upgrades: 3 },
              "3x3_smwoo": { production: 110, resource_spend: 11000, worker_peak: 42, kills: 8, tech_and_upgrades: 9 },
              "3x3_Kiyong": { production: 82, resource_spend: 8000, worker_peak: 32, kills: 4, tech_and_upgrades: 4 }
            }
          },
          edges: {
            players: [
              { name: "3x3_GG", race: "P", team: 1, apm: 152, eapm: 128 },
              { name: "3x3_mh", race: "T", team: 1, apm: 168, eapm: 138 },
              { name: "3x3_syntax", race: "Z", team: 1, apm: 125, eapm: 108 },
              { name: "3x3_pil", race: "P", team: 2, apm: 145, eapm: 123 },
              { name: "3x3_smwoo", race: "P", team: 2, apm: 195, eapm: 170 },
              { name: "3x3_Kiyong", race: "T", team: 2, apm: 182, eapm: 153 }
            ]
          }
        }
      ]
    },
    {
      season_label: "시즌2",
      season_no: 2,
      games: 1,
      wins_by_team: { "1": 1, "2": 0 },
      games_data: [
        {
          id: 3,
          season_label: "시즌2",
          season_no: 2,
          start_time: "2026-02-01T00:00:00Z",
          map_name: "Fighting Spirit",
          game_length: 720,
          winner_team: 1,
          edges: {
            players: [
              { name: "3x3_GG", race: "T", team: 1, apm: 160, eapm: 140 },
              { name: "3x3_mh", race: "P", team: 1, apm: 180, eapm: 155 },
              { name: "3x3_syntax", race: "Z", team: 1, apm: 130, eapm: 110 },
              { name: "3x3_pil", race: "Z", team: 2, apm: 150, eapm: 126 },
              { name: "3x3_smwoo", race: "T", team: 2, apm: 200, eapm: 175 },
              { name: "guest", race: "P", team: 2, apm: 220, eapm: 190 }
            ]
          }
        }
      ]
    }
  ]
};

describe("season analysis adapter", () => {
  it("builds all-season records, player standings, and cumulative win-rate trends", () => {
    const model = createSeasonAnalysisPageModel({ seasonsResponse });

    expect(model.summary.totalGames).toBe(2);
    expect(model.summary.totalSeasons).toBe(2);
    expect(model.summary.totalPlayers).toBe(6);
    expect(model.gameRecords).toHaveLength(2);
    expect(model.gameRecords[0]).toMatchObject({
      id: 1,
      seasonLabel: "시즌1",
      winner: ["성우", "민혁", "명진"],
      loser: ["필균", "성민", "기용"]
    });
    expect(model.gameRecords[0].winnerPlayers).toEqual([
      { name: "성우", race: "P", isRandomSelected: true },
      { name: "민혁", race: "T", isRandomSelected: true },
      { name: "명진", race: "Z", isRandomSelected: true }
    ]);
    expect(model.gameRecords[1].winnerPlayers[0]).toMatchObject({ name: "필균", race: "P", isRandomSelected: false });

    const seongwoo = model.playerStandings.find((player) => player.name === "성우");
    expect(seongwoo).toMatchObject({
      games: 2,
      wins: 1,
      losses: 1,
      winRate: 50
    });
    expect(seongwoo?.trend.map((point) => point.winRate)).toEqual([100, 50]);

    expect(model.seasonSummaries.map((season) => season.label)).toEqual(["시즌1", "시즌2"]);
    expect(model.seasonSummaries[0].mvp.name).toBe("성민");
    expect(model.seasonSummaries[0].mvp.score).toBeGreaterThan(0);
    expect(model.summary.mvp).toBe("성민");
    expect(model.trendSeries.some((series) => series.name === "성우")).toBe(true);
    expect(model.trendPoints).toHaveLength(2);
  });

  it("filters every section to the selected season", () => {
    const model = createSeasonAnalysisPageModel({ seasonsResponse, selectedSeasonLabel: "시즌2" });

    expect(model.summary.totalGames).toBe(0);
    expect(model.selectedSeasonLabel).toBe("시즌2");
    expect(model.gameRecords).toHaveLength(0);
    expect(model.playerStandings.find((player) => player.name === "성우")).toBeUndefined();
  });
});
