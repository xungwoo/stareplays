import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TeamAnalysisPage } from "@/components/team-analysis/team-analysis-page";
import { createTeamAnalysisPageModel } from "@/lib/adapters/team-analysis";

describe("team analysis page", () => {
  it("renders a new shadcn and Tremor inspired team matchup dashboard", async () => {
    const model = createTeamAnalysisPageModel();
    const user = userEvent.setup();

    render(<TeamAnalysisPage model={model} />);

    expect(screen.getByRole("heading", { name: /3x3 팀 전적 인텔리전스/i })).toBeInTheDocument();
    expect(screen.getByText(/평점 모델 순위 비교/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Bradley-Terry/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/TrueSkill/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/100점은 해당 모델 1위/i)).toBeInTheDocument();
    expect(screen.getByText(/핵심 인사이트/i)).toBeInTheDocument();
    expect(screen.getByText(/최고 조합/i)).toBeInTheDocument();
    expect(screen.getByText(/최악 조합/i)).toBeInTheDocument();
    expect(screen.getAllByTestId("player-radar-chart")).toHaveLength(3);
    expect(screen.getByRole("heading", { name: /승부 감각 오각형/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /종족 역량 오각형/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /리플레이 피지컬 오각형/i })).toBeInTheDocument();
    expect(screen.getAllByTestId("player-radar-chart")[0]).toHaveClass("h-[230px]");
    expect(screen.getByRole("button", { name: /전체 선수 보기/i })).toBeInTheDocument();
    expect(screen.getAllByTestId("player-radar-polygon").length).toBe(
      model.chartData.playerPentagons.reduce((total, chart) => total + chart.players.length, 0)
    );
    const focusedRadarPlayer = model.chartData.playerPentagons[0]?.players[0]?.name ?? "";
    await user.click(screen.getByRole("button", { name: new RegExp(`${focusedRadarPlayer} 선택`, "i") }));
    expect(screen.getAllByTestId("player-radar-polygon")).toHaveLength(3);
    expect(screen.getAllByText(/프로토스/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/생산능력/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/선수 역량 매트릭스/i)).toBeInTheDocument();
    expect(screen.getByText(/조합별 성적/i)).toBeInTheDocument();
    expect(screen.getAllByText(/종족 조합/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/최근 3x3 분석 입력/i)).not.toBeInTheDocument();

    const playerRows = screen.getAllByTestId("team-analysis-player-row");
    expect(playerRows.length).toBeGreaterThan(0);
    expect(within(playerRows[0] as HTMLElement).getByText(/성우|민혁|성민|기용|명진|필균/i)).toBeInTheDocument();
    expect(screen.queryByText(/^guest_/i)).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: /승률 정렬/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /APM 정렬/i }));
    const apmDescRows = screen.getAllByTestId("team-analysis-player-row");
    const highestApmPlayer = [...model.players].sort((left, right) => right.averageApm - left.averageApm)[0]?.name ?? "";
    expect(within(apmDescRows[0] as HTMLElement).getByText(highestApmPlayer)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /APM 정렬/i }));
    const apmAscRows = screen.getAllByTestId("team-analysis-player-row");
    const lowestApmPlayer = [...model.players].sort((left, right) => left.averageApm - right.averageApm)[0]?.name ?? "";
    expect(within(apmAscRows[0] as HTMLElement).getByText(lowestApmPlayer)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /선수 정렬/i }));
    const nameSortedRows = screen.getAllByTestId("team-analysis-player-row");
    expect(within(nameSortedRows[0] as HTMLElement).getByText("필균")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^선수$/i })).toHaveAttribute("aria-sort", "descending");
  });
});
