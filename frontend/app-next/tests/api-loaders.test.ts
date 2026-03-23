import { CURRENT_USER } from "@/lib/fixtures/common";
import { buildCurrentUserSessionCookie } from "@/lib/utils/current-user-session";
import { loadAnalyzerPageModel } from "@/lib/loaders/analyzer";
import { loadDashboardPageModel } from "@/lib/loaders/dashboard";
import { loadRankingsPageModel } from "@/lib/loaders/rankings";
import { loadVaultPageModel } from "@/lib/loaders/vault";

function createJsonResponse(payload: unknown) {
  return {
    ok: true,
    json: async () => payload
  } as Response;
}

describe("api loaders", () => {
  it("maps Fiber API payloads into the dashboard view model", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/rankings/3v3")) {
        return createJsonResponse({
          total: 2,
          rankings: [
            { rank: 1, name: CURRENT_USER, games: 43, wins: 24, losses: 19, draws: 0, win_rate: 55.8, avg_apm: 171, avg_eapm: 151.7 },
            { rank: 2, name: "3x3_smwoo", games: 43, wins: 24, losses: 19, draws: 0, win_rate: 55.8, avg_apm: 214.7, avg_eapm: 181.7 }
          ]
        });
      }

      if (url.includes(`/players/${encodeURIComponent(CURRENT_USER)}/stats`)) {
        return createJsonResponse({
          player_name: CURRENT_USER,
          total_games: 43,
          wins: 24,
          losses: 19,
          draws: 0,
          win_rate: 55.8,
          average_apm: 153,
          average_eapm: 133.1,
          favorite_race: "Protoss",
          race_stats: {
            Protoss: { wins: 22, losses: 17, total: 39, win_rate: 56.4 }
          },
          matchup_stats: {
            "vs Zerg": { wins: 14, losses: 10, total: 24, win_rate: 58.3 }
          },
          map_stats: {
            "OP3060 CLAN 6슈빨무": { wins: 17, losses: 13, total: 30, win_rate: 56.7 }
          }
        });
      }

      if (url.includes("/users/suggest")) {
        return createJsonResponse({
          users: [CURRENT_USER, "3x3_mh", "3x3_smwoo"]
        });
      }

      if (url.includes("/games?")) {
        return createJsonResponse({
          total: 2,
          games: [
            {
              id: 48,
              map_name: "OP3060 CLAN 6슈빨무",
              winner_team: 1,
              game_length: 835,
              start_time: "2026-03-22T00:05:48Z",
              edges: {
                players: [
                  { name: CURRENT_USER, race: "P", team: 1, apm: 148, eapm: 126, cmd_count: 2050, effective_cmd_count: 1746, redundancy: 15 },
                  { name: "3x3_mh", race: "P", team: 1, apm: 148, eapm: 136, cmd_count: 2054, effective_cmd_count: 1884, redundancy: 8 },
                  { name: "3x3_smwoo", race: "P", team: 1, apm: 182, eapm: 161, cmd_count: 2500, effective_cmd_count: 2208, redundancy: 12 },
                  { name: "3x3_Kiyong", race: "P", team: 2, apm: 171, eapm: 161, cmd_count: 2354, effective_cmd_count: 2216, redundancy: 6 },
                  { name: "3x3_pil", race: "Z", team: 2, apm: 145, eapm: 121, cmd_count: 2015, effective_cmd_count: 1671, redundancy: 17 },
                  { name: "3x3_syntax", race: "P", team: 2, apm: 142, eapm: 120, cmd_count: 1965, effective_cmd_count: 1666, redundancy: 15 }
                ]
              }
            },
            {
              id: 47,
              map_name: "New Super 빠른무한",
              winner_team: 2,
              game_length: 1020,
              start_time: "2026-03-21T23:45:50Z",
              edges: {
                players: []
              }
            }
          ],
          analysis_statuses: {
            48: "succeeded",
            47: "queued"
          }
        });
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    const model = await loadDashboardPageModel({
      fetchImpl: fetchMock,
      apiBaseUrl: "http://127.0.0.1:3000",
      currentUser: CURRENT_USER
    });

    expect(model.playerStats.favoriteRace).toBe("P");
    expect(model.uploadCandidates).toEqual([CURRENT_USER, "3x3_mh", "3x3_smwoo"]);
    expect(model.metrics[0]?.value).toBe("43");
    expect(model.metrics[1]?.value).toBe("55.8%");
    expect(model.metrics[2]?.value).toBe("214.7");
    expect(model.metrics[3]?.value).toBe("50%");
  });

  it("prefers the current user cookie before fixture fallback in the dashboard loader", async () => {
    const currentUserCookie = buildCurrentUserSessionCookie("cookie-user");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/rankings/3v3")) {
        return createJsonResponse({
          total: 1,
          rankings: [{ rank: 1, name: "cookie-user", games: 3, wins: 2, losses: 1, draws: 0, win_rate: 66.7, avg_apm: 150, avg_eapm: 120 }]
        });
      }

      if (url.includes(`/players/${encodeURIComponent("cookie-user")}/stats`)) {
        return createJsonResponse({
          player_name: "cookie-user",
          total_games: 3,
          wins: 2,
          losses: 1,
          draws: 0,
          win_rate: 66.7,
          average_apm: 150,
          average_eapm: 120,
          favorite_race: "T"
        });
      }

      if (url.includes("/users/suggest")) {
        return createJsonResponse({ users: ["cookie-user"] });
      }

      if (url.includes(`/games?`) && url.includes(`user_name=${encodeURIComponent("cookie-user")}`)) {
        return createJsonResponse({ total: 0, games: [], analysis_statuses: {} });
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    const model = await loadDashboardPageModel({
      fetchImpl: fetchMock,
      apiBaseUrl: "http://127.0.0.1:3000",
      currentUserCookie
    });

    expect(model.currentUser).toBe("cookie-user");
    expect(model.playerStats.name).toBe("cookie-user");
    expect(model.uploadCandidates).toEqual(["cookie-user"]);
  });

  it("maps rankings and race-matchup snapshots into the rankings page model", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/rankings/3v3")) {
        return createJsonResponse({
          total: 2,
          rankings: [
            { rank: 1, name: CURRENT_USER, games: 43, wins: 24, losses: 19, draws: 0, win_rate: 55.8, avg_apm: 171, avg_eapm: 151.7 },
            { rank: 2, name: "3x3_smwoo", games: 43, wins: 24, losses: 19, draws: 0, win_rate: 55.8, avg_apm: 214.7, avg_eapm: 181.7 }
          ]
        });
      }

      if (url.includes("/analyzer/race-matchups")) {
        return createJsonResponse({
          qualified_games: 48,
          rows: [
            { team_a: "PPT", team_b: "PPZ", games: 14, team_a_wins: 10, team_b_wins: 4, team_a_win_rate: 71.4, team_b_win_rate: 28.6 }
          ]
        });
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    const model = await loadRankingsPageModel({
      fetchImpl: fetchMock,
      apiBaseUrl: "http://127.0.0.1:3000",
      currentUser: CURRENT_USER
    });

    expect(model.rankings).toHaveLength(2);
    expect(model.rankings[0]?.isCurrentUser).toBe(true);
    expect(model.rankings[0]?.favoriteRace).toBe("P");
    expect(model.raceCompositions[0]?.teamA).toEqual(["P", "P", "T"]);
    expect(model.summary[0]?.value).toBe("43");
    expect(model.summary[1]?.value).toBe("2");
  });

  it("prefers the current user cookie before fixture fallback in the rankings loader", async () => {
    const currentUserCookie = buildCurrentUserSessionCookie("cookie-user");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/rankings/3v3")) {
        return createJsonResponse({
          total: 1,
          rankings: [
            { rank: 1, name: "cookie-user", games: 7, wins: 5, losses: 2, draws: 0, win_rate: 71.4, avg_apm: 200, avg_eapm: 180 }
          ]
        });
      }

      if (url.includes("/analyzer/race-matchups")) {
        return createJsonResponse({
          qualified_games: 7,
          rows: [{ team_a: "PPT", team_b: "PPZ", games: 7, team_a_wins: 5, team_b_wins: 2, team_a_win_rate: 71.4, team_b_win_rate: 28.6 }]
        });
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    const model = await loadRankingsPageModel({
      fetchImpl: fetchMock,
      apiBaseUrl: "http://127.0.0.1:3000",
      currentUserCookie
    });

    expect(model.rankings[0]?.isCurrentUser).toBe(true);
    expect(model.summary[0]?.value).toBe("7");
  });

  it("preserves the resolved current user when the rankings loader falls back to fixtures", async () => {
    const model = await loadRankingsPageModel({
      fetchImpl: vi.fn(async () => {
        throw new Error("offline");
      }),
      apiBaseUrl: "http://127.0.0.1:3000",
      currentUserCookie: buildCurrentUserSessionCookie("cookie-user")
    });

    expect(model.currentUser).toBe("cookie-user");
  });

  it("maps recent games from the Fiber API into the vault model", async () => {
    const fetchMock = vi.fn(async () =>
      createJsonResponse({
        total: 1,
        games: [
          {
            id: 48,
            map_name: "OP3060 CLAN 6슈빨무",
            winner_team: 1,
            game_length: 835,
            start_time: "2026-03-22T00:05:48Z",
            edges: {
              players: [
                { name: CURRENT_USER, race: "P", team: 1, apm: 148, eapm: 126, cmd_count: 2050, effective_cmd_count: 1746, redundancy: 15 },
                { name: "3x3_mh", race: "P", team: 1, apm: 148, eapm: 136, cmd_count: 2054, effective_cmd_count: 1884, redundancy: 8 },
                { name: "3x3_smwoo", race: "P", team: 1, apm: 182, eapm: 161, cmd_count: 2500, effective_cmd_count: 2208, redundancy: 12 },
                { name: "3x3_Kiyong", race: "P", team: 2, apm: 171, eapm: 161, cmd_count: 2354, effective_cmd_count: 2216, redundancy: 6 },
                { name: "3x3_pil", race: "Z", team: 2, apm: 145, eapm: 121, cmd_count: 2015, effective_cmd_count: 1671, redundancy: 17 },
                { name: "3x3_syntax", race: "P", team: 2, apm: 142, eapm: 120, cmd_count: 1965, effective_cmd_count: 1666, redundancy: 15 }
              ]
            }
          }
        ],
        analysis_statuses: {
          48: "succeeded"
        }
      }));

    const model = await loadVaultPageModel({
      fetchImpl: fetchMock,
      apiBaseUrl: "http://127.0.0.1:3000",
      currentUser: CURRENT_USER
    });

    expect(model.games).toHaveLength(1);
    expect(model.games[0]?.analyzerStatus).toBe("DONE");
    expect(model.games[0]?.winnerTeam[0]?.name).toBe(CURRENT_USER);
    expect(model.games[0]?.loserTeam[1]?.race).toBe("Z");
  });

  it("prefers the current user cookie before fixture fallback in the vault loader", async () => {
    const currentUserCookie = buildCurrentUserSessionCookie("cookie-user");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (!url.includes(`user_name=${encodeURIComponent("cookie-user")}`)) {
        throw new Error(`Unexpected url: ${url}`);
      }

      return createJsonResponse({
        total: 1,
        games: [
          {
            id: 48,
            map_name: "OP3060 CLAN 6슈빨무",
            winner_team: 1,
            game_length: 835,
            start_time: "2026-03-22T00:05:48Z",
            edges: {
              players: [
                { name: "cookie-user", race: "P", team: 1, apm: 148, eapm: 126, cmd_count: 2050, effective_cmd_count: 1746, redundancy: 15 },
                { name: "3x3_mh", race: "P", team: 1, apm: 148, eapm: 136, cmd_count: 2054, effective_cmd_count: 1884, redundancy: 8 },
                { name: "3x3_Kiyong", race: "P", team: 2, apm: 171, eapm: 161, cmd_count: 2354, effective_cmd_count: 2216, redundancy: 6 }
              ]
            }
          }
        ],
        analysis_statuses: { 48: "succeeded" }
      });
    });

    const model = await loadVaultPageModel({
      fetchImpl: fetchMock,
      apiBaseUrl: "http://127.0.0.1:3000",
      currentUserCookie
    });

    expect(model.currentUser).toBe("cookie-user");
    expect(model.games[0]?.winnerTeam[0]?.isCurrentUser).toBe(true);
  });

  it("builds analyzer insight from detail and analyzer payloads", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/games?")) {
        return createJsonResponse({
          total: 1,
          games: [
            {
              id: 48,
              map_name: "OP3060 CLAN 6슈빨무",
              winner_team: 1,
              game_length: 835,
              start_time: "2026-03-22T00:05:48Z",
              edges: {
                players: [
                  { name: CURRENT_USER, race: "P", team: 1, apm: 148, eapm: 126, cmd_count: 2050, effective_cmd_count: 1746, redundancy: 15 },
                  { name: "3x3_mh", race: "P", team: 1, apm: 148, eapm: 136, cmd_count: 2054, effective_cmd_count: 1884, redundancy: 8 },
                  { name: "3x3_smwoo", race: "P", team: 1, apm: 182, eapm: 161, cmd_count: 2500, effective_cmd_count: 2208, redundancy: 12 },
                  { name: "3x3_Kiyong", race: "P", team: 2, apm: 171, eapm: 161, cmd_count: 2354, effective_cmd_count: 2216, redundancy: 6 },
                  { name: "3x3_pil", race: "Z", team: 2, apm: 145, eapm: 121, cmd_count: 2015, effective_cmd_count: 1671, redundancy: 17 },
                  { name: "3x3_syntax", race: "P", team: 2, apm: 142, eapm: 120, cmd_count: 1965, effective_cmd_count: 1666, redundancy: 15 }
                ]
              }
            }
          ],
          analysis_statuses: {
            48: "succeeded"
          }
        });
      }

      if (url.includes("/games/48/detail")) {
        return createJsonResponse({
          detail: {
            apm_timeline: [
              { player_name: CURRENT_USER, data_points: [{ frame: 238, apm: 120 }, { frame: 476, apm: 160 }] },
              { player_name: "3x3_mh", data_points: [{ frame: 238, apm: 110 }, { frame: 476, apm: 145 }] }
            ]
          },
          tech_tree: {
            events: [
              { player_name: CURRENT_USER, second: 181, kind: "prereq_building", name: "Cybernetics Core" },
              { player_name: CURRENT_USER, second: 361, kind: "tech", name: "Psionic Storm" }
            ],
            summary: [
              { player_name: CURRENT_USER, tech_count: 1, upgrade_count: 2, prereq_build_count: 1 },
              { player_name: "3x3_Kiyong", tech_count: 1, upgrade_count: 1, prereq_build_count: 1 }
            ]
          },
          resource_spend: {
            summaries: [
              { player_name: CURRENT_USER, total_spend: 3000 },
              { player_name: "3x3_mh", total_spend: 2100 },
              { player_name: "3x3_smwoo", total_spend: 2500 },
              { player_name: "3x3_Kiyong", total_spend: 2600 },
              { player_name: "3x3_pil", total_spend: 1800 },
              { player_name: "3x3_syntax", total_spend: 1700 }
            ],
            timelines: [
              { player_name: CURRENT_USER, data_points: [{ second: 10, total: 250 }, { second: 20, total: 400 }] },
              { player_name: "3x3_mh", data_points: [{ second: 10, total: 200 }, { second: 20, total: 350 }] },
              { player_name: "3x3_Kiyong", data_points: [{ second: 10, total: 150 }, { second: 20, total: 260 }] },
              { player_name: "3x3_pil", data_points: [{ second: 10, total: 100 }, { second: 20, total: 180 }] }
            ]
          },
          unit_production: {
            summaries: [
              { player_name: CURRENT_USER, total: 12, worker: 4, army: 8, tech_unit: 1 },
              { player_name: "3x3_mh", total: 9, worker: 3, army: 6, tech_unit: 0 },
              { player_name: "3x3_Kiyong", total: 8, worker: 2, army: 6, tech_unit: 1 },
              { player_name: "3x3_pil", total: 6, worker: 2, army: 4, tech_unit: 0 }
            ],
            timelines: [
              { player_name: CURRENT_USER, data_points: [{ second: 10, count: 4 }, { second: 20, count: 8 }] },
              { player_name: "3x3_mh", data_points: [{ second: 10, count: 3 }, { second: 20, count: 6 }] },
              { player_name: "3x3_Kiyong", data_points: [{ second: 10, count: 2 }, { second: 20, count: 5 }] },
              { player_name: "3x3_pil", data_points: [{ second: 10, count: 2 }, { second: 20, count: 4 }] }
            ]
          }
        });
      }

      if (url.includes("/games/48/analyzer")) {
        return createJsonResponse({
          status: "succeeded",
          result: {
            summary: {
              teams: [
                { team: 1, kills: 18, deaths: 10 },
                { team: 2, kills: 10, deaths: 18 }
              ],
              players: [
                { player_name: CURRENT_USER, team: 1, final: { kills: 8, deaths: 2, worker_peak: 28, supply_peak_used: 120, vision_score_final: 14, enemy_zone_coverage: 0.4 } },
                { player_name: "3x3_mh", team: 1, final: { kills: 5, deaths: 3, worker_peak: 22, supply_peak_used: 98, vision_score_final: 9, enemy_zone_coverage: 0.2 } },
                { player_name: "3x3_Kiyong", team: 2, final: { kills: 4, deaths: 6, worker_peak: 20, supply_peak_used: 96, vision_score_final: 7, enemy_zone_coverage: 0.15 } }
              ]
            },
            analysis_phase: {
              winner_team_candidate: 1
            },
            match_flow: {
              events: [
                { second: 181, player_name: CURRENT_USER, team: 1, type: "power_spike", title: "Cybernetics Core", importance: 72 },
                { second: 361, player_name: CURRENT_USER, team: 1, type: "tech", title: "Psionic Storm", importance: 80 }
              ]
            },
            player_timeseries: {
              players: [
                {
                  player_name: CURRENT_USER,
                  team: 1,
                  kd: [{ second: 10, kills: 1, deaths: 0 }, { second: 20, kills: 3, deaths: 1 }],
                  worker: [{ second: 10, count: 12 }, { second: 20, count: 18 }]
                },
                {
                  player_name: "3x3_Kiyong",
                  team: 2,
                  kd: [{ second: 10, kills: 0, deaths: 1 }, { second: 20, kills: 1, deaths: 3 }],
                  worker: [{ second: 10, count: 10 }, { second: 20, count: 14 }]
                }
              ]
            }
          }
        });
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    const model = await loadAnalyzerPageModel({
      fetchImpl: fetchMock,
      apiBaseUrl: "http://127.0.0.1:3000",
      currentUser: CURRENT_USER
    });

    expect(model.selectedGame.keyPlayer).toBe(CURRENT_USER);
    expect(model.selectedGame.worstPlayer).toBe("3x3_Kiyong");
    expect(model.timeline[0]?.event).toBe("Cybernetics Core");
    expect(model.comparison.kills.winner).toBe(18);
    expect(model.resourceSeries[0]).toEqual({ time: 1, winner: 450, loser: 250 });
    expect(model.unitProductionSeries[0]).toEqual({ time: 1, winner: 7, loser: 4 });
  });

  it("uses the requested analyzer game id when provided", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/games?")) {
        return createJsonResponse({
          total: 2,
          games: [
            {
              id: 47,
              map_name: "Alpha Ridge",
              winner_team: 1,
              game_length: 760,
              start_time: "2026-03-22T00:05:48Z",
              edges: { players: [] }
            },
            {
              id: 48,
              map_name: "Beta Mesa",
              winner_team: 2,
              game_length: 810,
              start_time: "2026-03-22T00:15:48Z",
              edges: { players: [] }
            }
          ],
          analysis_statuses: { 47: "succeeded", 48: "succeeded" }
        });
      }

      if (url.includes("/games/47/detail") || url.includes("/games/48/detail")) {
        return createJsonResponse({ detail: {}, tech_tree: {}, resource_spend: {}, unit_production: {} });
      }

      if (url.includes("/games/47/analyzer") || url.includes("/games/48/analyzer")) {
        return createJsonResponse({ status: "succeeded", result: { summary: { teams: [], players: [] }, analysis_phase: {}, match_flow: {}, player_timeseries: { players: [] } } });
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    const model = await loadAnalyzerPageModel({
      fetchImpl: fetchMock,
      apiBaseUrl: "http://127.0.0.1:3000",
      currentUser: CURRENT_USER,
      selectedGameId: 48
    } as any);

    expect(model.selectedGame.id).toBe(48);
    expect(model.selectedGame.map).toBe("Beta Mesa");
  });

  it("prefers the current user cookie before fixture fallback in the analyzer loader", async () => {
    const currentUserCookie = buildCurrentUserSessionCookie("cookie-user");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/games?")) {
        if (!url.includes(`user_name=${encodeURIComponent("cookie-user")}`)) {
          throw new Error(`Unexpected url: ${url}`);
        }

        return createJsonResponse({
          total: 1,
          games: [
            {
              id: 48,
              map_name: "OP3060 CLAN 6슈빨무",
              winner_team: 1,
              game_length: 835,
              start_time: "2026-03-22T00:05:48Z",
              edges: {
                players: [
                  { name: "cookie-user", race: "P", team: 1, apm: 148, eapm: 126, cmd_count: 2050, effective_cmd_count: 1746, redundancy: 15 },
                  { name: "3x3_mh", race: "P", team: 1, apm: 148, eapm: 136, cmd_count: 2054, effective_cmd_count: 1884, redundancy: 8 },
                  { name: "3x3_Kiyong", race: "P", team: 2, apm: 171, eapm: 161, cmd_count: 2354, effective_cmd_count: 2216, redundancy: 6 }
                ]
              }
            }
          ],
          analysis_statuses: { 48: "succeeded" }
        });
      }

      if (url.includes("/games/48/detail")) {
        return createJsonResponse({ detail: {}, tech_tree: {}, resource_spend: {}, unit_production: {} });
      }

      if (url.includes("/games/48/analyzer")) {
        return createJsonResponse({ status: "succeeded", result: { summary: { teams: [], players: [] }, analysis_phase: {}, match_flow: {}, player_timeseries: { players: [] } } });
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    const model = await loadAnalyzerPageModel({
      fetchImpl: fetchMock,
      apiBaseUrl: "http://127.0.0.1:3000",
      currentUserCookie
    });

    expect(model.currentUser).toBe("cookie-user");
    expect(model.selectedGame.winnerTeam[0]?.isCurrentUser).toBe(true);
  });

  it("falls back to fixture-backed analyzer data when API calls fail", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("backend unavailable");
    });

    const model = await loadAnalyzerPageModel({
      fetchImpl: fetchMock,
      apiBaseUrl: "http://127.0.0.1:3000",
      currentUser: CURRENT_USER
    });

    expect(model.selectedGame.id).toBe(48);
    expect(model.timeline.length).toBeGreaterThan(0);
    expect(model.games.length).toBeGreaterThan(0);
  });
});

describe("route entrypoints", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unmock("next/headers");
    vi.unmock("@/lib/loaders/dashboard");
    vi.unmock("@/lib/loaders/vault");
    vi.unmock("@/lib/loaders/analyzer");
    vi.unmock("@/lib/loaders/rankings");
  });

  it.each([
    { label: "dashboard", loaderPath: "@/lib/loaders/dashboard", pagePath: "@/app/page" },
    { label: "vault", loaderPath: "@/lib/loaders/vault", pagePath: "@/app/vault/page" },
    { label: "analyzer", loaderPath: "@/lib/loaders/analyzer", pagePath: "@/app/analyzer/page" },
    { label: "rankings", loaderPath: "@/lib/loaders/rankings", pagePath: "@/app/rankings/page" }
  ])("passes request current-user state into the $label loader", async ({ loaderPath, pagePath }) => {
    const loaderMock = vi.fn(async () => ({ ok: true }));

    vi.doMock("next/headers", () => ({
      cookies: () => ({
        get: (name: string) => (name === "current_user" ? { value: "cookie-user" } : undefined)
      })
    }));
    vi.doMock(loaderPath, () => {
      const exportName =
        loaderPath === "@/lib/loaders/dashboard"
          ? "loadDashboardPageModel"
          : loaderPath === "@/lib/loaders/vault"
            ? "loadVaultPageModel"
            : loaderPath === "@/lib/loaders/analyzer"
              ? "loadAnalyzerPageModel"
              : "loadRankingsPageModel";

      return { [exportName]: loaderMock };
    });

    const pageModule = await import(pagePath);
    await pageModule.default();
    await pageModule.default({ searchParams: { currentUser: "query-user" } });
    if (pagePath === "@/app/analyzer/page") {
      await pageModule.default({ searchParams: { currentUser: "query-user", gameId: "48" } });
    }

    expect(loaderMock).toHaveBeenNthCalledWith(1, {
      currentUser: undefined,
      currentUserCookie: "cookie-user"
    });
    expect(loaderMock).toHaveBeenNthCalledWith(2, {
      currentUser: "query-user",
      currentUserCookie: "cookie-user"
    });
    if (pagePath === "@/app/analyzer/page") {
      expect(loaderMock).toHaveBeenNthCalledWith(3, {
        currentUser: "query-user",
        currentUserCookie: "cookie-user",
        selectedGameId: 48
      });
    }
  });
});
