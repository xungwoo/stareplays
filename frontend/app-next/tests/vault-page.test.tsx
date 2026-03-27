import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import VaultPage from "@/app/vault/page";
import { VaultDetailPanel } from "@/components/vault/vault-detail-panel";
import { VaultGameRow } from "@/components/vault/vault-game-row";
import { VaultPage as VaultPageComponent } from "@/components/vault/vault-page";
import type { VaultPageModel } from "@/types/vault";

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
    expect(screen.getByRole("link", { name: /game analyzer/i }).getAttribute("href")).toContain("/analyzer?currentUser=3x3_GG&gameId=");
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
    expect(screen.getByText(/^SELECTED_GAME$/i).closest(".mt-2")).toHaveStyle({
      backgroundColor: "#080e1f",
      border: "1px solid rgba(34,211,238,0.12)"
    });
    expect(screen.getByRole("button", { name: /^APM$/i }).parentElement?.nextElementSibling).toHaveStyle({
      backgroundColor: "#0a1428",
      border: "1px solid rgba(255,255,255,0.05)"
    });
    expect(getGameIdCell(9).closest("div.border-b")).toHaveStyle({
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
        <VaultGameRow game={game} isExpanded={true} onToggle={() => {}} />
        <VaultDetailPanel
          game={game}
          currentUser={model.currentUser}
          activeVizTab="apm"
          isFullscreen={false}
          highlightedPlayer={null}
          techFocus={null}
          onActiveVizTabChange={() => {}}
          onFullscreenToggle={() => {}}
          onTechFocusChange={() => {}}
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
    expect(screen.getByRole("link", { name: /game analyzer/i })).toHaveAttribute("href", "/analyzer?currentUser=neo_user&gameId=99");
    expect(screen.getByText(/^SELECTED_GAME$/i)).toBeInTheDocument();
    expect(screen.getByText(/^APM TIMELINE$/i)).toBeInTheDocument();
    expect(screen.getByTestId("vault-start-grid-left")).toBeInTheDocument();
    expect(screen.getByTestId("vault-start-grid-right")).toBeInTheDocument();
  });

  it("builds the analyzer deep link from the selected game id", async () => {
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
    await waitFor(() => expect(screen.getByRole("link", { name: /game analyzer/i })).toBeInTheDocument());

    expect(screen.getByRole("link", { name: /game analyzer/i })).toHaveAttribute("href", "/analyzer?currentUser=neo_user&gameId=99");
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
    expect(screen.queryByRole("link", { name: /game analyzer/i })).not.toBeInTheDocument();
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

    expect(screen.getByRole("button", { name: /^APM$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Unit Production$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Resource Spend$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Production$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Tech \/ Upgrade$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Battle Intensity$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Action Mix$/i })).toBeInTheDocument();
  });

  it("supports fullscreen toggle and Escape collapse behavior", async () => {
    const user = userEvent.setup();

    render(<VaultPageComponent model={createSingleGameModel()} />);
    await user.click(getGameIdCell(99));
    await waitFor(() => expect(screen.getByTestId("vault-detail-shell")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /fullscreen/i }));
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

    await user.click(screen.getByRole("button", { name: /^Tech \/ Upgrade$/i }));
    const techTree = screen.getByTestId("vault-tech-tree");
    await user.click(within(techTree).getByRole("button", { name: /neo_user/i }));
    expect(screen.getByTestId("vault-tech-tree-focus")).toHaveTextContent("neo_user");

    await user.click(getGameIdCell(100));
    expect(screen.getByRole("button", { name: /^APM$/i })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: /^Tech \/ Upgrade$/i }));
    expect(screen.getByTestId("vault-tech-tree-focus")).toHaveTextContent("FOCUS: NONE");
  });
});
