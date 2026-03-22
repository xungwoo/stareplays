import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import RankingsPage from "@/app/rankings/page";

describe("rankings page", () => {
  it("renders the figma rankings tables and switches tabs", async () => {
    render(await RankingsPage());
    const user = userEvent.setup();

    expect(screen.getByRole("button", { name: /rankings_3v3/i })).toBeInTheDocument();
    expect(screen.getByText(/^Total Games$/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /race_composition_winrate/i }));
    expect(screen.getByText(/race_composition_winrate \(3v3\)/i)).toBeInTheDocument();
    expect(screen.getByText(/^MATCHUP$/i)).toBeInTheDocument();
  });

  it("keeps the rankings win-rate row density aligned with the figma source", async () => {
    render(await RankingsPage());

    const percentage = screen.getAllByText("51.2%")[0];
    expect(percentage).not.toHaveClass("w-12");
    expect(percentage).not.toHaveClass("text-right");
  });

  it("uses direct panel styling for figma-like rankings cards", async () => {
    render(await RankingsPage());

    expect(screen.getByText(/^Total Games$/i).parentElement?.parentElement).toHaveStyle({
      backgroundColor: "#0d1833",
      border: "1px solid rgba(34,211,238,0.1)"
    });
  });

  it("uses figma source inline accent and refresh styles", async () => {
    render(await RankingsPage());

    const rankingsAccent = screen.getByRole("heading", { name: /^Rankings_3v3$/i }).previousElementSibling;
    expect(rankingsAccent).toHaveStyle({ backgroundColor: "#22d3ee" });

    expect(screen.getByRole("button", { name: /^REFRESH$/i })).toHaveStyle({
      border: "1px solid rgba(255,255,255,0.1)"
    });
  });

  it("uses source-style inline cyan emphasis for race composition wins", async () => {
    render(await RankingsPage());
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /race_composition_winrate/i }));
    expect(screen.getAllByText(/^10$/i)[0]).toHaveStyle({
      color: "#22d3ee"
    });
  });
});
