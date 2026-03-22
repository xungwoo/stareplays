import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import HomePage from "@/app/page";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DASHBOARD_FIXTURE } from "@/lib/fixtures/dashboard";

describe("dashboard page", () => {
  it("renders the figma dashboard upload and stats workspace", async () => {
    const { container } = render(await HomePage());

    expect(screen.getByText(/^Replay Upload$/i)).toBeInTheDocument();
    expect(screen.getByText(/플레이어 선택 \(Simple Login\)/i)).toBeInTheDocument();
    expect(screen.getByText(/select_player_from_parsed_replay/i)).toBeInTheDocument();
    expect(screen.getByText(/^HOW TO USE$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Player Stats Query$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^QUERY$/i })).toHaveClass("transition-all");
    expect(screen.getByText(/^Win Rate Progress$/i)).toBeInTheDocument();
    expect(screen.getByText(DASHBOARD_FIXTURE.playerStats.favoriteRaceLabel)).toHaveClass("text-amber-400");
    expect(screen.getByText(/^CURRENT_USER:$/i).nextElementSibling).toHaveTextContent(DASHBOARD_FIXTURE.currentUser);
    expect(screen.getByText(/^Player Stats Query$/i).parentElement).toHaveClass("p-5");
    expect(screen.getByText(/^Player Stats Query$/i).parentElement).toHaveStyle({
      backgroundColor: "#0d1833",
      border: "1px solid rgba(34,211,238,0.1)"
    });
    expect(screen.getByText(/^HOW TO USE$/i).parentElement).toHaveStyle({
      border: "1px solid rgba(34,211,238,0.1)"
    });
    const winRateStatLabel = screen
      .getAllByText(/^Win Rate$/i)
      .find((element) => element.tagName === "SPAN");

    expect(winRateStatLabel?.parentElement).toHaveStyle({
      backgroundColor: "#0a1428",
      border: "1px solid rgba(255,255,255,0.06)"
    });
    expect(winRateStatLabel?.nextElementSibling).toHaveStyle({
      color: "#22d3ee"
    });
    expect(container.querySelector('label[for="replay-file"]')).toHaveStyle({
      border: "2px dashed rgba(255,255,255,0.1)",
      backgroundColor: "rgba(255,255,255,0.02)"
    });
    expect(container.querySelector('label[for="replay-file"] svg')).toHaveClass("text-cyan-400");
    expect(screen.getByText(/^READY$/i).parentElement).toHaveStyle({
      backgroundColor: "#0a1428",
      border: "1px solid rgba(255,255,255,0.05)"
    });
    expect(screen.getByLabelText(/플레이어 이름 입력/i)).toHaveStyle({
      backgroundColor: "#0a1428",
      border: "1px solid rgba(255,255,255,0.1)",
      color: "#e2e8f0"
    });
    expect(screen.getByRole("button", { name: /^QUERY$/i })).toHaveStyle({
      background: "linear-gradient(90deg, #0891b2, #1d4ed8)",
      border: "1px solid rgba(34,211,238,0.3)"
    });
    expect(screen.getByText(/^CURRENT_USER:$/i).nextElementSibling).toHaveStyle({
      backgroundColor: "rgba(34,211,238,0.1)",
      color: "#22d3ee",
      border: "1px solid rgba(34,211,238,0.2)"
    });
    expect(screen.getByText(/^CURRENT_USER:$/i).nextElementSibling).not.toHaveClass("tracking-wider");
    expect(container.querySelector(".h-3.overflow-hidden.rounded-full")).toHaveStyle({
      backgroundColor: "#0a1428"
    });
    expect(screen.getByText(/^PLAYER$/i).nextElementSibling?.querySelector("span")).toHaveStyle({
      color: "#22d3ee"
    });
    expect(screen.getByText(`${DASHBOARD_FIXTURE.playerStats.winRate.toFixed(1)}%`, {
      selector: "p"
    })).toHaveStyle({
      color: "#22d3ee"
    });

    const progressLabels = [...container.querySelectorAll("span")].filter((element) => {
      return element.textContent?.startsWith("WIN ") || element.textContent?.startsWith("LOSS ");
    });

    expect(progressLabels.some((element) => element.textContent?.startsWith("WIN ") && element.className.includes("text-emerald-400"))).toBe(true);
    expect(progressLabels.some((element) => element.textContent?.startsWith("LOSS ") && element.className.includes("text-red-400"))).toBe(true);
    expect(screen.getByText("56.4%")).toHaveStyle({
      color: "#34d399"
    });
  });

  it("updates the upload module when a replay file is selected and analyzed", async () => {
    vi.useFakeTimers();
    render(<DashboardPage model={DASHBOARD_FIXTURE} />);

    const fileInput = document.querySelector("#replay-file") as HTMLInputElement;
    const analyzeButton = screen.getByRole("button", { name: /analyze_replay/i });

    expect(analyzeButton).toBeDisabled();
    expect(analyzeButton).toHaveClass("transition-all", "duration-200");
    expect(screen.getByText(/^READY$/i)).toBeInTheDocument();

    fireEvent.change(fileInput, {
      target: {
        files: [new File(["mock replay"], "test-game.rep", { type: "application/octet-stream" })]
      }
    });

    const selectedFileName = screen.getByText("test-game.rep");

    expect(selectedFileName).toBeInTheDocument();
    expect(selectedFileName).toHaveClass("text-cyan-300");
    expect(analyzeButton).toBeEnabled();

    fireEvent.click(analyzeButton);
    expect(screen.getByText(/분석 중/i)).toBeInTheDocument();
    expect(screen.getByText(/analyzing replay/i)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText(/업로드 완료/i)).toBeInTheDocument();
    expect(screen.getByText(/upload complete — 게임 목록에서 확인하세요/i)).toBeInTheDocument();
    expect(document.querySelector("svg.text-emerald-400")).toBeInTheDocument();
    vi.useRealTimers();
  });
});
