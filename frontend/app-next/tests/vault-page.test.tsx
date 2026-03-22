import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import VaultPage from "@/app/vault/page";
import { VaultPage as VaultPageComponent } from "@/components/vault/vault-page";
import type { VaultPageModel } from "@/types/vault";

describe("vault page", () => {
  it("renders the figma replay vault table and expanded analyzer bridge", async () => {
    render(await VaultPage());

    expect(screen.getByText(/^Recent Games$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument();
    expect(screen.getByText(/^SELECTED_GAME$/i)).toBeInTheDocument();
    expect(screen.getByText(/^APM TIMELINE$/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /game analyzer/i })).toBeInTheDocument();
  });

  it("matches the figma replay vault badge and card styling more closely", async () => {
    const { container } = render(await VaultPage());

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
    expect(screen.getByText(/^APM TIMELINE$/i).nextElementSibling).toHaveStyle({
      backgroundColor: "#0a1428",
      border: "1px solid rgba(255,255,255,0.05)"
    });
    expect(screen.getAllByText(/^#48$/i)[0].closest("div.border-b")).toHaveStyle({
      borderColor: "rgba(255,255,255,0.05)"
    });
    expect(screen.getByRole("button", { name: /^Prev$/i }).parentElement).toHaveStyle({
      borderTop: "1px solid rgba(255,255,255,0.05)"
    });
  });

  it("uses figma source inline accent and refresh styles", async () => {
    render(await VaultPage());

    const accent = screen.getByText(/^Recent Games$/i).previousElementSibling;
    expect(accent).toHaveStyle({ backgroundColor: "#22d3ee" });

    expect(screen.getByRole("button", { name: /^REFRESH$/i })).toHaveStyle({
      border: "1px solid rgba(255,255,255,0.1)"
    });
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
    await user.click(screen.getByText(/^#1$/i));

    const leftColumn = screen.getByTestId("vault-start-grid-left");
    const rightColumn = screen.getByTestId("vault-start-grid-right");

    expect(within(leftColumn).getAllByTestId("start-grid-player-name").map((node) => node.textContent)).toEqual(["3x3_Kiyong", "3x3_syntax", "3x3_mh"]);
    expect(within(rightColumn).getAllByTestId("start-grid-player-name").map((node) => node.textContent)).toEqual(["3x3_GG", "3x3_smwoo", "3x3_pil"]);
  });
});
