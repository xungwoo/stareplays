import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { vi } from "vitest";

import VaultPage from "@/app/vault/page";
import { VaultDetailPanel, type VaultTechFocus, type VaultVizTab } from "@/components/vault/vault-detail-panel";
import { VaultGameRow } from "@/components/vault/vault-game-row";
import { VaultPage as VaultPageComponent } from "@/components/vault/vault-page";
import type { VaultGame, VaultPageModel } from "@/types/vault";

describe("vault page", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/v1/games?")) {
          return new Response(
            JSON.stringify({
              total: 1,
              games: [
                {
                  id: 9,
                  map_name: "Legacy Vault Map",
                  winner_team: 1,
                  game_length: 835,
                  start_time: "2026-03-23T00:00:00Z",
                  edges: {
                    players: [
                      { name: "3x3_GG", race: "P", team: 1, apm: 148, eapm: 126, cmd_count: 2050, effective_cmd_count: 1746, redundancy: 15 },
                      { name: "ally", race: "T", team: 1, apm: 141, eapm: 123, cmd_count: 1800, effective_cmd_count: 1600, redundancy: 12 },
                      { name: "enemy", race: "Z", team: 2, apm: 166, eapm: 156, cmd_count: 2200, effective_cmd_count: 2000, redundancy: 9 }
                    ]
                  }
                }
              ],
              analysis_statuses: { 9: "done" }
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" }
            }
          );
        }

        if (url.includes("/detail")) {
          return new Response(
            JSON.stringify({
              analysis_status: {
                status: "ready",
                user_message: "detail ready"
              },
              detail: {
                apm_timeline: []
              },
              tech_tree: {
                events: [
                  { player_name: "neo_user", second: 180, kind: "tech", name: "Psionic Storm" },
                  { player_name: "opponent", second: 240, kind: "upgrade", name: "Carapace" }
                ],
                summary: [
                  { player_name: "neo_user", tech_count: 2, upgrade_count: 3, prereq_build_count: 1 },
                  { player_name: "opponent", tech_count: 1, upgrade_count: 2, prereq_build_count: 0 }
                ]
              },
              resource_spend: {
                summaries: [
                  { player_name: "neo_user", total_spend: 4200 },
                  { player_name: "opponent", total_spend: 3100 }
                ],
                timelines: [
                  { player_name: "neo_user", data_points: [{ second: 10, total: 250 }, { second: 20, total: 600 }, { second: 30, total: 1200 }] },
                  { player_name: "opponent", data_points: [{ second: 10, total: 180 }, { second: 20, total: 350 }, { second: 30, total: 700 }] }
                ]
              },
              unit_production: {
                summaries: [
                  { player_name: "neo_user", total: 24, worker: 10, army: 8, tech_unit: 6 },
                  { player_name: "opponent", total: 18, worker: 9, army: 7, tech_unit: 2 }
                ],
                timelines: [
                  { player_name: "neo_user", data_points: [{ second: 10, count: 4 }, { second: 20, count: 10 }, { second: 30, count: 16 }] },
                  { player_name: "opponent", data_points: [{ second: 10, count: 3 }, { second: 20, count: 7 }, { second: 30, count: 11 }] }
                ]
              }
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" }
            }
          );
        }

        return new Response(
          JSON.stringify({
            reliability: "25%",
            reliability_m_of_n: "1/4",
            game: {
              id: 99,
              edges: {
                replay_files: [{ id: 1 }]
              }
            }
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function getGameIdCell(id: number) {
    const candidates = Array.from(document.querySelectorAll("span.text-xs.font-mono.text-slate-500"));
    const match = candidates.find((element) => element.textContent?.trim() === `#${id}`);

    if (!match) {
      throw new Error(`Unable to find game id cell #${id}`);
    }

    return match as HTMLElement;
  }

  function createSingleGameModel(): VaultPageModel {
    return {
      currentUser: "neo_user",
      games: [
        {
          id: 99,
          map: "Test Arena",
          matchup: "1v1",
          winnerTeam: [
            { name: "neo_user", race: "P", apm: 200, eapm: 180, cmd: 3000, ecmd: 2800, effective: 92, redundancy: 5, production: 140, isCurrentUser: true, startLocationX: 100, startLocationY: 100 }
          ],
          loserTeam: [
            { name: "opponent", race: "Z", apm: 150, eapm: 130, cmd: 2200, ecmd: 2000, effective: 84, redundancy: 10, production: 120, startLocationX: 4000, startLocationY: 900 }
          ],
          analyzerStatus: "DONE",
          playTime: "10:00",
          startTime: "2026-03-23 09:00",
          matchStory: "Fallback story"
        }
      ]
    };
  }

  function createTwoGameModel(): VaultPageModel {
    return {
      currentUser: "neo_user",
      games: [
        {
          id: 99,
          map: "Test Arena",
          matchup: "1v1",
          winnerTeam: [
            { name: "neo_user", race: "P", apm: 200, eapm: 180, cmd: 3000, ecmd: 2800, effective: 92, redundancy: 5, production: 140, isCurrentUser: true, startLocationX: 100, startLocationY: 100 }
          ],
          loserTeam: [
            { name: "opponent", race: "Z", apm: 150, eapm: 130, cmd: 2200, ecmd: 2000, effective: 84, redundancy: 10, production: 120, startLocationX: 4000, startLocationY: 900 }
          ],
          analyzerStatus: "DONE",
          playTime: "10:00",
          startTime: "2026-03-23 09:00",
          matchStory: "First match"
        },
        {
          id: 100,
          map: "Backup Arena",
          matchup: "2v2",
          winnerTeam: [
            { name: "ally", race: "T", apm: 180, eapm: 160, cmd: 2400, ecmd: 2200, effective: 91, redundancy: 7, production: 150, isCurrentUser: false, startLocationX: 120, startLocationY: 120 },
            { name: "neo_user", race: "P", apm: 210, eapm: 190, cmd: 3100, ecmd: 2900, effective: 93, redundancy: 4, production: 145, isCurrentUser: true, startLocationX: 140, startLocationY: 140 }
          ],
          loserTeam: [
            { name: "enemy", race: "Z", apm: 140, eapm: 120, cmd: 2000, ecmd: 1800, effective: 82, redundancy: 11, production: 118, startLocationX: 4000, startLocationY: 900 }
          ],
          analyzerStatus: "PENDING",
          playTime: "12:30",
          startTime: "2026-03-22 08:30",
          matchStory: "Second match"
        }
      ]
    };
  }

  it("renders the figma replay vault table and expanded analyzer bridge", async () => {
    render(await VaultPage({}));
    const user = userEvent.setup();

    expect(screen.getByText(/^Recent Games$/i)).toBeInTheDocument();
    expect(screen.getByText(/CURRENT_USER: 3x3_GG/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /refresh/i })).toBeInTheDocument();
    expect(screen.queryByText(/^SELECTED_GAME$/i)).not.toBeInTheDocument();

    await user.click(getGameIdCell(9));

    await waitFor(() => expect(screen.getByTestId("vault-detail-shell")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /^APM$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Open_In_Analyzer$/i }).getAttribute("href")).toContain("/analyzer?game_id=");
    expect(screen.getByRole("link", { name: /^Open_In_Analyzer$/i }).getAttribute("href")).not.toContain("currentUser=");
    expect(screen.queryByRole("link", { name: /game analyzer/i })).not.toBeInTheDocument();
  });

  it("matches the figma replay vault badge and card styling more closely", async () => {
    const { container } = render(await VaultPage({}));
    const user = userEvent.setup();

    await user.click(getGameIdCell(9));

    await waitFor(() => expect(screen.getByTestId("vault-detail-shell")).toBeInTheDocument());

    const resultBadges = screen.getAllByText(/^(WINNER|LOSER)$/i);
    expect(resultBadges.some((badge) => badge.className.includes("text-[10px]"))).toBe(true);

    const matchStoryCard = screen.getByText(/^MATCH STORY$/i).parentElement;
    expect(matchStoryCard).toHaveStyle({
      backgroundColor: "rgba(34, 211, 238, 0.04)",
      border: "1px solid rgba(34,211,238,0.1)"
    });

    expect(screen.getByRole("button", { name: /^Prev$/i })).toHaveStyle({
      color: "#94a3b8"
    });
    expect(screen.getByRole("button", { name: /^Next$/i })).toHaveStyle({
      color: "#94a3b8"
    });
    expect(container.querySelector(".rounded-xl.overflow-hidden")).toHaveStyle({
      backgroundColor: "#0d1833",
      border: "1px solid rgba(34,211,238,0.1)"
    });
    expect(screen.getByTestId("vault-inline-detail-row")).toHaveStyle({
      borderColor: "rgba(34, 211, 238, 0.12)"
    });
    expect(screen.getByText(/^analysis notice$/i).parentElement).toHaveStyle({
      backgroundColor: "#0a1428",
      border: "1px solid rgba(255,255,255,0.05)"
    });
    expect(getGameIdCell(9).closest("tr")).toHaveStyle({
      borderColor: "rgba(255,255,255,0.05)"
    });
    expect(screen.getByRole("button", { name: /^Prev$/i }).parentElement).toHaveStyle({
      borderTop: "1px solid rgba(255,255,255,0.05)"
    });
  });

  it("uses figma source inline accent and refresh styles", async () => {
    render(await VaultPage({}));

    const accent = screen.getByText(/^Recent Games$/i).previousElementSibling;
    expect(accent).toHaveStyle({ backgroundColor: "#22d3ee" });

    expect(screen.getByRole("link", { name: /^REFRESH$/i })).toHaveStyle({
      border: "1px solid rgba(255,255,255,0.1)"
    });
  });

  it("renders the extracted vault row and detail panel shells", async () => {
    const model = createSingleGameModel();
    const game = model.games[0];

    render(
      <div>
        <table>
          <tbody>
            <VaultGameRow game={game} isExpanded={true} onToggle={() => {}} />
          </tbody>
        </table>
        <VaultDetailPanel
          game={game}
          currentUser={model.currentUser}
          activeVizTab="apm"
          isFullscreen={false}
          highlightedPlayer={null}
          techFocus={null}
          techEventInfo={null}
          onActiveVizTabChange={() => {}}
          onFullscreenToggle={() => {}}
          onTechFocusChange={() => {}}
          onHighlightedPlayerChange={() => {}}
          hydratedDetail={{
            reliability: "25%",
            reliabilityMOfN: "1/4",
            replayFileCount: 2,
            analysisMessage: "detail ready",
            apmSeries: [
              {
                time: 1,
                "neo_user": 120,
                opponent: 90
              }
            ]
          }}
        />
      </div>
    );

    expect(screen.getAllByText(/^#99$/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /open_in_analyzer/i })).toHaveAttribute("href", "/analyzer?game_id=99");
    expect(screen.getByText(/^SELECTED_GAME$/i)).toBeInTheDocument();
    expect(screen.getByText(/^APM TIMELINE$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^REDUNDANCY%$/i)).toHaveLength(2);
    expect(screen.getByText(/^analysis notice$/i)).toBeInTheDocument();
    expect(screen.getByText(/^viz tabs$/i)).toBeInTheDocument();
    expect(screen.getByText(/^chart area$/i)).toBeInTheDocument();
    expect(screen.getByText(/^legend row$/i)).toBeInTheDocument();
    expect(screen.getByText(/^chart hint$/i)).toBeInTheDocument();
    expect(screen.getByText(/^tech event info$/i)).toBeInTheDocument();
    expect(screen.getByText(/^summary area$/i)).toBeInTheDocument();
    expect(screen.getByTestId("vault-start-grid-left")).toBeInTheDocument();
    expect(screen.getByTestId("vault-start-grid-right")).toBeInTheDocument();
  });

  it("toggles APM highlighted player from the legend and updates tech focus and tech marker info", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [activeVizTab, setActiveVizTab] = useState<VaultVizTab>("apm");
      const [isFullscreen, setIsFullscreen] = useState(false);
      const [highlightedPlayer, setHighlightedPlayer] = useState<string | null>(null);
      const [techFocus, setTechFocus] = useState<VaultTechFocus>(null);
      const [techEventInfo, setTechEventInfo] = useState<string | null>(null);

      return (
        <VaultDetailPanel
          game={createSingleGameModel().games[0]}
          currentUser="neo_user"
          activeVizTab={activeVizTab}
          isFullscreen={isFullscreen}
          highlightedPlayer={highlightedPlayer}
          techFocus={techFocus}
          techEventInfo={techEventInfo}
          onActiveVizTabChange={setActiveVizTab}
          onFullscreenToggle={() => setIsFullscreen((current) => !current)}
          onHighlightedPlayerChange={setHighlightedPlayer}
          onTechEventInfoChange={setTechEventInfo}
          onTechFocusChange={(focus) => {
            setTechFocus(focus);
            setHighlightedPlayer(focus?.playerName ?? null);
            setTechEventInfo(focus ? `${focus.playerName} • ${focus.kind.toUpperCase()}` : null);
          }}
          hydratedDetail={{
            reliability: "25%",
            reliabilityMOfN: "1/4",
            replayFileCount: 2,
            analysisMessage: "detail ready",
            apmSeries: [
              {
                time: 1,
                neo_user: 120,
                opponent: 90
              }
            ],
            techTreeSummaries: [
              { playerName: "neo_user", techCount: 2, upgradeCount: 3, prereqBuildCount: 1 },
              { playerName: "opponent", techCount: 1, upgradeCount: 2, prereqBuildCount: 0 }
            ],
            techTreeEvents: [
              { playerName: "neo_user", second: 180, kind: "tech", name: "Psionic Storm" },
              { playerName: "opponent", second: 240, kind: "upgrade", name: "Carapace" }
            ]
          }}
        />
      );
    }

    render(<Harness />);

    expect(screen.getByText(/^analysis notice$/i)).toBeInTheDocument();
    expect(screen.getByText(/^chart area$/i)).toBeInTheDocument();
    expect(screen.getByText(/^legend row$/i)).toBeInTheDocument();
    expect(screen.getByText(/^chart hint$/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^neo_user$/i }));
    expect(screen.getByRole("button", { name: /^neo_user$/i })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: /^Tech$/i }));
    const techTree = screen.getByTestId("vault-tech-tree");
    const techMarkers = screen.getByTestId("vault-tech-tree-markers");
    await user.click(within(techTree).getByRole("button", { name: /^neo_user TECH 2$/i }));
    expect(screen.getByTestId("vault-tech-tree-focus")).toHaveTextContent("neo_user • TECH");

    await user.click(within(techMarkers).getByRole("button", { name: /^neo_user Psionic Storm 180s$/i }));
    expect(within(techTree).getByRole("button", { name: /^neo_user TECH 2$/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("vault-tech-tree-focus")).toHaveTextContent("neo_user • Psionic Storm • 180s");
  });

  it("inserts the selected game detail as a row-adjacent table row under the clicked game", async () => {
    const user = userEvent.setup();

    render(<VaultPageComponent model={createTwoGameModel()} />);

    const table = screen.getByRole("table");
    await user.click(within(table).getByText("#99"));

    await waitFor(() => expect(screen.getByText(/^SELECTED_GAME$/i)).toBeInTheDocument());
    const bodyRows = within(table).getAllByRole("row").slice(1);

    expect(bodyRows[0]).toHaveTextContent("99");
    expect(bodyRows[1]).toHaveTextContent("Selected_Game");
    expect(bodyRows[2]).toHaveTextContent("100");
  });

  it("uses OUR_TEAM and ENEMY_TEAM semantics for the current user row", () => {
    const game: VaultGame = {
      id: 77,
      map: "Semantics Test",
      matchup: "1v1",
      winnerTeam: [
        { name: "enemy_winner", race: "T", apm: 240, eapm: 210, cmd: 3200, ecmd: 3000, effective: 95, redundancy: 4, production: 160, startLocationX: 4000, startLocationY: 900 }
      ],
      loserTeam: [
        { name: "neo_user", race: "P", apm: 180, eapm: 165, cmd: 2500, ecmd: 2300, effective: 88, redundancy: 8, production: 135, isCurrentUser: true, startLocationX: 100, startLocationY: 100 },
        { name: "enemy_support", race: "Z", apm: 172, eapm: 151, cmd: 2400, ecmd: 2200, effective: 86, redundancy: 9, production: 128, startLocationX: 130, startLocationY: 130 }
      ],
      analyzerStatus: "DONE",
      playTime: "09:45",
      startTime: "2026-03-21 10:00",
      matchStory: "Semantics"
    };

    render(
      <table>
        <tbody>
          <VaultGameRow game={game} isExpanded={false} onToggle={() => {}} />
        </tbody>
      </table>
    );

    expect(screen.getByText(/^OUR_TEAM$/i)).toBeInTheDocument();
    expect(screen.getByText(/^ENEMY_TEAM$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^YOU$/i)).toHaveLength(1);
    expect(screen.getByText("neo_user").closest("td")).toHaveTextContent("OUR_TEAM");
  });

  it("renders the legacy visualization section headings, exact tab copy, and fullscreen text", async () => {
    const user = userEvent.setup();

    render(<VaultPageComponent model={createSingleGameModel()} />);
    await user.click(getGameIdCell(99));
    await waitFor(() => expect(screen.getByTestId("vault-detail-shell")).toBeInTheDocument());

    expect(screen.getByText(/^SELECTED_GAME$/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Open_In_Analyzer$/i })).toBeInTheDocument();
    expect(screen.getByText(/^Game_Detail_Visualization$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^APM$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Unit_Production$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Resource_Spend$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Production$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Tech$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Battle$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Actions$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^크게 보기$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Tech \/ Upgrade$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Battle Intensity$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Action Mix$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/^analysis notice$/i).parentElement).toHaveStyle({
      backgroundColor: "rgb(10, 20, 40)",
      border: "1px solid rgba(255, 255, 255, 0.05)"
    });
  });

  it("switches the fullscreen label and exits fullscreen with Escape", async () => {
    const user = userEvent.setup();

    render(<VaultPageComponent model={createSingleGameModel()} />);
    await user.click(getGameIdCell(99));
    await waitFor(() => expect(screen.getByTestId("vault-detail-shell")).toBeInTheDocument());

    const fullscreenButton = screen.getByRole("button", { name: /^크게 보기$/i });
    await user.click(fullscreenButton);

    expect(screen.getByRole("button", { name: /^작게 보기$/i })).toBeInTheDocument();
    expect(screen.getByTestId("vault-detail-shell")).toHaveAttribute("data-fullscreen", "true");

    await user.keyboard("{Escape}");

    expect(screen.getByRole("button", { name: /^크게 보기$/i })).toBeInTheDocument();
    expect(screen.getByTestId("vault-detail-shell")).not.toHaveAttribute("data-fullscreen", "true");
    expect(document.body).not.toHaveClass("viz-fullscreen-lock");
  });

  it("builds the analyzer deep link using game_id query semantics", async () => {
    const model: VaultPageModel = {
      currentUser: "neo_user",
      games: [
        {
          id: 99,
          map: "Test Arena",
          matchup: "1v1",
          winnerTeam: [
            { name: "neo_user", race: "P", apm: 200, eapm: 180, cmd: 3000, ecmd: 2800, effective: 92, redundancy: 5, production: 140, isCurrentUser: true, startLocationX: 100, startLocationY: 100 }
          ],
          loserTeam: [
            { name: "opponent", race: "Z", apm: 150, eapm: 130, cmd: 2200, ecmd: 2000, effective: 84, redundancy: 10, production: 120, startLocationX: 4000, startLocationY: 900 }
          ],
          analyzerStatus: "DONE",
          playTime: "10:00",
          startTime: "2026-03-23 09:00",
          matchStory: "Test match"
        }
      ]
    };

    render(<VaultPageComponent model={model} />);
    const user = userEvent.setup();

    await user.click(getGameIdCell(99));
    await waitFor(() => expect(screen.getByRole("link", { name: /open_in_analyzer/i })).toBeInTheDocument());

    expect(screen.getByRole("link", { name: /open_in_analyzer/i })).toHaveAttribute("href", "/analyzer?game_id=99");
    expect(screen.getByRole("link", { name: /open_in_analyzer/i }).getAttribute("href")).not.toContain("gameId=");
  });

  it("starts with no selected game and keeps the detail shell hidden until the user selects a row", () => {
    const model: VaultPageModel = {
      currentUser: "neo_user",
      games: [
        {
          id: 99,
          map: "Test Arena",
          matchup: "1v1",
          winnerTeam: [
            { name: "neo_user", race: "P", apm: 200, eapm: 180, cmd: 3000, ecmd: 2800, effective: 92, redundancy: 5, production: 140, isCurrentUser: true, startLocationX: 100, startLocationY: 100 }
          ],
          loserTeam: [
            { name: "opponent", race: "Z", apm: 150, eapm: 130, cmd: 2200, ecmd: 2000, effective: 84, redundancy: 10, production: 120, startLocationX: 4000, startLocationY: 900 }
          ],
          analyzerStatus: "DONE",
          playTime: "10:00",
          startTime: "2026-03-23 09:00",
          matchStory: "Test match"
        }
      ]
    };

    render(<VaultPageComponent model={model} />);

    expect(screen.queryByText(/^SELECTED_GAME$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /open_in_analyzer/i })).not.toBeInTheDocument();
  });

  it("shows the legacy FETCHING_GAME placeholder and rehydrates selected rows with live api data", async () => {
    let resolveGameResponse: ((value: Response) => void) | undefined;
    let resolveDetailResponse: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/v1/games/99/detail")) {
        return new Promise<Response>((resolve) => {
          resolveDetailResponse = resolve;
        });
      }

      if (url.endsWith("/api/v1/games/99")) {
        return new Promise<Response>((resolve) => {
          resolveGameResponse = resolve;
        });
      }

      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const model: VaultPageModel = {
      currentUser: "neo_user",
      games: [
        {
          id: 99,
          map: "Test Arena",
          matchup: "1v1",
          winnerTeam: [
            { name: "neo_user", race: "P", apm: 200, eapm: 180, cmd: 3000, ecmd: 2800, effective: 92, redundancy: 5, production: 140, isCurrentUser: true, startLocationX: 100, startLocationY: 100 }
          ],
          loserTeam: [
            { name: "opponent", race: "Z", apm: 150, eapm: 130, cmd: 2200, ecmd: 2000, effective: 84, redundancy: 10, production: 120, startLocationX: 4000, startLocationY: 900 }
          ],
          analyzerStatus: "DONE",
          playTime: "10:00",
          startTime: "2026-03-23 09:00",
          matchStory: "Fallback story"
        }
      ]
    };

    render(<VaultPageComponent model={model} />);
    const user = userEvent.setup();

    await user.click(getGameIdCell(99));

    expect(screen.getByText(/FETCHING_GAME\.\.\./i)).toBeInTheDocument();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/v1/games/99"), expect.any(Object)));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/v1/games/99/detail"), expect.any(Object)));

    resolveGameResponse?.(
      new Response(
        JSON.stringify({
          reliability: "25%",
          reliability_m_of_n: "1/4",
          game: {
            id: 99,
            edges: {
              replay_files: [{ id: 1 }, { id: 2 }]
            }
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    resolveDetailResponse?.(
      new Response(
        JSON.stringify({
          analysis_status: {
            status: "ready",
            user_message: "최신 분석 데이터입니다."
          },
          detail: {
            apm_timeline: [
              { player_name: "neo_user", data_points: [{ frame: 24, apm: 120 }, { frame: 48, apm: 160 }] },
              { player_name: "opponent", data_points: [{ frame: 24, apm: 90 }, { frame: 48, apm: 110 }] }
            ]
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await waitFor(() => expect(screen.getByText(/^DETAIL_STATUS$/i).nextElementSibling).toHaveTextContent("LIVE_DETAIL_READY"));
    expect(screen.getByText(/^RELIABILITY$/i).nextElementSibling).toHaveTextContent("1/4 • 25%");
    expect(screen.getByText(/^REPLAY_FILES$/i).nextElementSibling).toHaveTextContent("2");
  });

  it("re-fetches game detail when the same row is reselected after collapse", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/v1/games/99/detail")) {
        return new Response(JSON.stringify({ detail: { apm_timeline: [] } }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/api/v1/games/99")) {
        return new Response(
          JSON.stringify({
            reliability: "25%",
            reliability_m_of_n: "1/4",
            game: { id: 99, edges: { replay_files: [{ id: 1 }] } }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<VaultPageComponent model={createSingleGameModel()} />);

    await user.click(getGameIdCell(99));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    await user.click(getGameIdCell(99));
    await waitFor(() => expect(screen.queryByText(/^SELECTED_GAME$/i)).not.toBeInTheDocument());

    await user.click(getGameIdCell(99));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
  });

  it("renders the selected game around start-position sides instead of winner and loser columns", async () => {
    const model: VaultPageModel = {
      currentUser: "3x3_GG",
      games: [
        {
          id: 1,
          map: "OP3060 CLAN 6슈빨무",
          matchup: "3v3",
          winnerTeam: [
            { name: "3x3_GG", race: "P", apm: 148, eapm: 126, cmd: 2050, ecmd: 1746, effective: 85.2, redundancy: 15, production: 203, isCurrentUser: true, startLocationX: 4000, startLocationY: 100 },
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
          startTime: "2026-03-22 00:05:48",
          matchStory: "Test story"
        }
      ]
    };

    render(<VaultPageComponent model={model} />);
    const user = userEvent.setup();

    await user.click(getGameIdCell(1));
    await waitFor(() => expect(screen.getByTestId("vault-detail-shell")).toBeInTheDocument());

    const leftColumn = screen.getByTestId("vault-start-grid-left");
    const rightColumn = screen.getByTestId("vault-start-grid-right");

    expect(within(leftColumn).getAllByTestId("start-grid-player-name").map((node) => node.textContent)).toEqual(["3x3_Kiyong", "3x3_syntax", "3x3_mh"]);
    expect(within(rightColumn).getAllByTestId("start-grid-player-name").map((node) => node.textContent)).toEqual(["3x3_GG", "3x3_smwoo", "3x3_pil"]);
  });

  it("clears the selected row when clicked again and hides the detail section entirely", async () => {
    const user = userEvent.setup();

    render(<VaultPageComponent model={createSingleGameModel()} />);

    await user.click(getGameIdCell(99));
    expect(screen.getByText(/^SELECTED_GAME$/i)).toBeInTheDocument();
    await user.click(getGameIdCell(99));

    await waitFor(() => expect(screen.queryByText(/^SELECTED_GAME$/i)).not.toBeInTheDocument());
    expect(screen.queryByText(/^NO_GAME_SELECTED$/i)).not.toBeInTheDocument();
  });

  it("renders the legacy inline viz tab set exactly", async () => {
    render(<VaultPageComponent model={createSingleGameModel()} />);
    const user = userEvent.setup();

    await user.click(getGameIdCell(99));
    await waitFor(() => expect(screen.getByTestId("vault-detail-shell")).toBeInTheDocument());

    const expectedTabLabels = ["APM", "Unit_Production", "Resource_Spend", "Production", "Tech", "Battle", "Actions"];
    const tabButtons = screen
      .getAllByRole("button")
      .filter((button) => expectedTabLabels.includes(button.textContent?.trim() ?? ""));

    expect(tabButtons.map((button) => button.textContent?.trim())).toEqual(expectedTabLabels);
    expect(screen.queryByRole("button", { name: /^Unit Production$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Resource Spend$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Tech \/ Upgrade$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Battle Intensity$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Action Mix$/i })).not.toBeInTheDocument();
  });

  it("renders distinct hydrated content for the non-APM visualization tabs", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/games/99")) {
        return new Response(
          JSON.stringify({
            reliability: "42%",
            reliability_m_of_n: "2/5",
            game: {
              id: 99,
              edges: {
                replay_files: [{ id: 1 }, { id: 2 }, { id: 3 }]
              }
            }
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.includes("/api/v1/games/99/detail")) {
        return new Response(
          JSON.stringify({
            analysis_status: {
              status: "ready",
              user_message: "detail ready"
            },
            detail: {
              apm_timeline: [
                { player_name: "neo_user", data_points: [{ frame: 24, apm: 120 }, { frame: 48, apm: 160 }] },
                { player_name: "opponent", data_points: [{ frame: 24, apm: 90 }, { frame: 48, apm: 110 }] }
              ]
            },
            tech_tree: {
              events: [
                { player_name: "neo_user", second: 180, kind: "tech", name: "Psionic Storm" },
                { player_name: "neo_user", second: 210, kind: "upgrade", name: "Singularity Charge" },
                { player_name: "opponent", second: 240, kind: "tech", name: "Lurker Aspect" }
              ],
              summary: [
                { player_name: "neo_user", tech_count: 2, upgrade_count: 3, prereq_build_count: 1 },
                { player_name: "opponent", tech_count: 1, upgrade_count: 1, prereq_build_count: 0 }
              ]
            },
            resource_spend: {
              summaries: [
                { player_name: "neo_user", total_spend: 4200 },
                { player_name: "opponent", total_spend: 3100 }
              ],
              timelines: [
                { player_name: "neo_user", data_points: [{ second: 10, total: 250 }, { second: 20, total: 600 }, { second: 30, total: 1200 }] },
                { player_name: "opponent", data_points: [{ second: 10, total: 180 }, { second: 20, total: 350 }, { second: 30, total: 700 }] }
              ]
            },
            unit_production: {
              summaries: [
                { player_name: "neo_user", total: 24, worker: 10, army: 8, tech_unit: 6 },
                { player_name: "opponent", total: 18, worker: 9, army: 7, tech_unit: 2 }
              ],
              timelines: [
                { player_name: "neo_user", data_points: [{ second: 10, count: 4 }, { second: 20, count: 10 }, { second: 30, count: 16 }] },
                { player_name: "opponent", data_points: [{ second: 10, count: 3 }, { second: 20, count: 7 }, { second: 30, count: 11 }] }
              ]
            },
            compressed_build_orders: [
              {
                player_name: "neo_user",
                events: [
                  { frame: 240, event_type: "build", unit: "Gateway" },
                  { frame: 480, event_type: "tech", tech: "Citadel of Adun" }
                ]
              },
              {
                player_name: "opponent",
                events: [{ frame: 120, event_type: "build", unit: "Hatchery" }]
              }
            ],
            build_orders: [
              {
                player_name: "neo_user",
                events: [{ frame: 120, event_type: "build", unit: "Probe" }]
              },
              {
                player_name: "opponent",
                events: [{ frame: 240, event_type: "build", unit: "Drone" }]
              }
            ]
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();

    render(<VaultPageComponent model={createSingleGameModel()} />);
    await user.click(getGameIdCell(99));
    await waitFor(() => expect(screen.getByTestId("vault-detail-shell")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /^Unit_Production$/i }));
    const unitProductionChart = screen.getByLabelText(/^Unit Production Chart$/i);
    expect(unitProductionChart).toBeInTheDocument();
    expect(unitProductionChart.querySelectorAll("path").length).toBeGreaterThan(0);
    expect(unitProductionChart.querySelectorAll('rect[rx="4"]').length).toBe(0);
    const unitProductionTable = screen.getByTestId("vault-unit-production-summary");
    expect(within(unitProductionTable).getAllByRole("columnheader").map((header) => header.textContent?.trim())).toEqual([
      "PLAYER",
      "TOTAL",
      "WORKER",
      "ARMY",
      "TECH_UNIT"
    ]);

    await user.click(screen.getByRole("button", { name: /^Resource_Spend$/i }));
    const resourceSpendChart = screen.getByLabelText(/^Resource Spend Timeline$/i);
    expect(resourceSpendChart).toBeInTheDocument();
    expect(screen.queryByText(/resource spend ledger/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Production$/i }));
    const productionTimeline = screen.getByLabelText(/^Build Order Timeline$/i);
    expect(productionTimeline).toBeInTheDocument();
    expect(within(productionTimeline).getByRole("button", { name: /^neo_user 00:10 Gateway$/i })).toBeInTheDocument();
    expect(within(productionTimeline).getByRole("button", { name: /^neo_user 00:20 Citadel of Adun$/i })).toBeInTheDocument();
    expect(within(productionTimeline).queryByText(/BUILD 01/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Tech$/i }));
    const techChart = screen.getByLabelText(/^Tech Marker Chart$/i);
    expect(techChart).toBeInTheDocument();
    expect(within(techChart).getByRole("button", { name: /^neo_user Psionic Storm 180s$/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Battle$/i }));
    const battleChart = screen.getByLabelText(/^Battle APM Timeline$/i);
    expect(battleChart).toBeInTheDocument();
    expect(battleChart.querySelectorAll("path")).toHaveLength(1);
    expect(screen.getByText(/^SUMMED APM$/i)).toBeInTheDocument();
    expect(screen.getByText(/210\.0 \/ 270\.0 \/ 270\.0/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Actions$/i }));
    const actionMixMatrix = screen.getByLabelText(/^Action Mix Matrix$/i);
    expect(actionMixMatrix).toBeInTheDocument();
    expect(within(actionMixMatrix).getAllByText(/DOMINANT TECH/i)).toHaveLength(2);
  });

  it("supports fullscreen toggle and Escape collapse behavior", async () => {
    const user = userEvent.setup();

    render(<VaultPageComponent model={createSingleGameModel()} />);
    await user.click(getGameIdCell(99));
    await waitFor(() => expect(screen.getByTestId("vault-detail-shell")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /^크게 보기$/i }));
    expect(screen.getByTestId("vault-detail-shell")).toHaveAttribute("data-fullscreen", "true");
    expect(document.body).toHaveClass("viz-fullscreen-lock");

    await user.keyboard("{Escape}");
    expect(screen.getByTestId("vault-detail-shell")).not.toHaveAttribute("data-fullscreen", "true");
    expect(document.body).not.toHaveClass("viz-fullscreen-lock");
  });

  it("resets the tech-tree filter and highlighted player when changing games", async () => {
    const user = userEvent.setup();
    const model: VaultPageModel = {
      currentUser: "neo_user",
      games: [
        ...createSingleGameModel().games,
        {
          id: 100,
          map: "Second Arena",
          matchup: "1v1",
          winnerTeam: [
            { name: "neo_user", race: "P", apm: 205, eapm: 181, cmd: 3100, ecmd: 2820, effective: 91, redundancy: 4, production: 142, isCurrentUser: true, startLocationX: 120, startLocationY: 120 }
          ],
          loserTeam: [
            { name: "second_opponent", race: "T", apm: 151, eapm: 129, cmd: 2210, ecmd: 1990, effective: 83, redundancy: 11, production: 121, startLocationX: 3980, startLocationY: 920 }
          ],
          analyzerStatus: "DONE",
          playTime: "11:00",
          startTime: "2026-03-23 10:00",
          matchStory: "Second fallback story"
        }
      ]
    };

    render(<VaultPageComponent model={model} />);

    await user.click(getGameIdCell(99));
    await waitFor(() => expect(screen.getByTestId("vault-detail-shell")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /^Tech$/i }));
    const techTree = screen.getByTestId("vault-tech-tree");
    await user.click(within(techTree).getByRole("button", { name: /^neo_user TECH 2$/i }));
    expect(screen.getByTestId("vault-tech-tree-focus")).toHaveTextContent("neo_user • TECH");

    await user.click(getGameIdCell(100));
    expect(screen.getByRole("button", { name: /^APM$/i })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: /^Tech$/i }));
    expect(screen.getByTestId("vault-tech-tree-focus")).toHaveTextContent("NO TECH EVENT SELECTED");
  });

  it("clears cached hydrated detail when a selected game refetch fails", async () => {
    let shouldFailDetailFetch = false;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/v1/games/99/detail")) {
        if (shouldFailDetailFetch) {
          return new Response(JSON.stringify({ error: "detail failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }

        return new Response(
          JSON.stringify({
            analysis_status: {
              status: "ready",
              user_message: "live detail"
            },
            detail: {
              apm_timeline: [
                { player_name: "neo_user", data_points: [{ frame: 24, apm: 120 }] },
                { player_name: "opponent", data_points: [{ frame: 24, apm: 90 }] }
              ]
            }
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.endsWith("/api/v1/games/99")) {
        return new Response(
          JSON.stringify({
            reliability: "25%",
            reliability_m_of_n: "1/4",
            game: {
              id: 99,
              edges: {
                replay_files: [{ id: 1 }, { id: 2 }]
              }
            }
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    });

    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<VaultPageComponent model={createSingleGameModel()} />);

    await user.click(getGameIdCell(99));
    await waitFor(() => expect(screen.getByText(/^DETAIL_STATUS$/i).nextElementSibling).toHaveTextContent("LIVE_DETAIL_READY"));
    expect(screen.getByText(/^RELIABILITY$/i).nextElementSibling).toHaveTextContent("1/4 • 25%");

    await user.click(getGameIdCell(99));
    await waitFor(() => expect(screen.queryByText(/^SELECTED_GAME$/i)).not.toBeInTheDocument());

    shouldFailDetailFetch = true;
    await user.click(getGameIdCell(99));

    await waitFor(() => expect(screen.getByText(/^DETAIL_STATUS$/i).nextElementSibling).toHaveTextContent("DETAIL_FALLBACK"));
    expect(screen.getByTestId("vault-detail-error")).toBeInTheDocument();
    expect(screen.getByText(/unable to load selected game detail/i)).toBeInTheDocument();
    expect(screen.getByText(/^RELIABILITY$/i).nextElementSibling).toHaveTextContent("UNAVAILABLE");
    expect(screen.queryByText("1/4 • 25%")).not.toBeInTheDocument();
    expect(screen.queryByText("live detail")).not.toBeInTheDocument();
  });
});
