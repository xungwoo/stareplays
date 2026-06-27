import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TeamAnalysisPage } from "@/components/team-analysis/team-analysis-page";
import { createTeamAnalysisPageModel } from "@/lib/adapters/team-analysis";

describe("team analysis page", () => {
  it("renders the all-season team-analysis contract with long-term model and lineup insights", async () => {
    const model = createTeamAnalysisPageModel();
    const user = userEvent.setup();

    render(<TeamAnalysisPage model={model} />);

    expect(screen.getByRole("heading", { name: /3x3 팀 전적 인텔리전스/i })).toBeInTheDocument();
    expect(screen.getByText(/평점 모델 원점수/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Bradley-Terry/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/TrueSkill/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId("bt-rating-line-chart")).toBeInTheDocument();
    expect(screen.getByTestId("trueskill-rating-line-chart")).toBeInTheDocument();
    expect(screen.queryByText(/100점은 해당 모델 1위/i)).not.toBeInTheDocument();
    expect(screen.getByText(/5분위 점수로 바꾸지 않고 실제 점수 추이/i)).toBeInTheDocument();
    expect(screen.getByText(/핵심 인사이트/i)).toBeInTheDocument();
    expect(screen.getByText(/최고 조합/i)).toBeInTheDocument();
    expect(screen.getByText(/최악 조합/i)).toBeInTheDocument();
    expect(screen.getAllByTestId("player-radar-chart")).toHaveLength(3);
    expect(screen.getByRole("heading", { name: /승부 감각 오각형/i })).toBeInTheDocument();
    expect(screen.getAllByText(/팀 적응력/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /종족 역량 오각형/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /리플레이 피지컬 오각형/i })).toBeInTheDocument();
    expect(screen.getAllByTestId("player-radar-chart")[0]).toHaveClass("h-[230px]");
    expect(screen.getByRole("button", { name: /전체 선수 보기/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^플레이어 누적 승률 추이$/i })).toBeInTheDocument();
    expect(screen.getByTestId("all-season-player-winrate-trend")).toHaveClass("mb-4");
    expect(screen.getByTestId("season-player-winrate-trend-chart")).toBeInTheDocument();
    expect(screen.getAllByTestId("player-radar-polygon").length).toBe(
      model.chartData.playerPentagons.reduce((total, chart) => total + chart.players.length, 0)
    );
    const focusedRadarPlayer = model.chartData.playerPentagons[0]?.players[0]?.name ?? "";
    await user.click(screen.getByRole("button", { name: new RegExp(`${focusedRadarPlayer} 선택`, "i") }));
    expect(screen.getAllByTestId("player-radar-polygon")).toHaveLength(3);
    expect(screen.getAllByText(/프로토스/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/분당 생산|자원 소모량/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/생산능력|템포안정|분당 유효명령|손효율/i)).not.toBeInTheDocument();
    expect(screen.getByText(/선수 역량 매트릭스/i)).toBeInTheDocument();
    expect(screen.getByText(/조합별 성적/i)).toBeInTheDocument();
    expect(screen.getByText(/전체 시즌 기준 관측된 3인 조합/i)).toBeInTheDocument();
    expect(screen.getAllByTestId("lineup-performance-row")[0]).toHaveClass("grid");
    expect(screen.getAllByTestId("lineup-performance-row")[0]).toHaveClass("xl:grid-cols-[minmax(260px,1fr)_auto_auto]");
    expect(screen.getByRole("button", { name: /분당 유닛생산 정렬/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /P승률 정렬/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /T승률 정렬/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Z승률 정렬/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^듀오 궁합$/i })).toBeInTheDocument();
    expect(screen.getAllByText(/종족 조합/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/^MVP$/i)).toBeInTheDocument();
    expect(screen.getByText(/^최강 조합$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^현재 팀 전적$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^최약 종족$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^추적 조합$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^평점 모델$/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/AI 훈련 피드백/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/훈련|연습|보강|다듬/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/최근 3x3 분석 입력/i)).not.toBeInTheDocument();

    const playerPentagonHeading = screen.getByRole("heading", { name: /선수 역량 오각형/i });
    const trendHeading = screen.getByRole("heading", { name: /^플레이어 누적 승률 추이$/i });
    const ratingHeading = screen.getByRole("heading", { name: /평점 모델 원점수/i });
    const matrixHeading = screen.getByRole("heading", { name: /선수 역량 매트릭스/i });
    const lineupHeading = screen.getByRole("heading", { name: /조합별 성적/i });
    const duoHeading = screen.getByRole("heading", { name: /^듀오 궁합$/i });
    const insightHeading = screen.getByRole("heading", { name: /핵심 인사이트/i });
    const playerInsightHeading = screen.getByRole("heading", { name: /선수 강점 \/ 약점 카드/i });

    expect(playerPentagonHeading.compareDocumentPosition(trendHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(trendHeading.compareDocumentPosition(ratingHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ratingHeading.compareDocumentPosition(matrixHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(matrixHeading.compareDocumentPosition(lineupHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(lineupHeading.compareDocumentPosition(duoHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(duoHeading.compareDocumentPosition(insightHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(insightHeading.compareDocumentPosition(playerInsightHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const playerRows = screen.getAllByTestId("team-analysis-player-row");
    expect(playerRows.length).toBeGreaterThan(0);
    expect(within(playerRows[0] as HTMLElement).getByText(/성우|민혁|성민|기용|명진|필균/i)).toBeInTheDocument();
    expect(screen.queryByText(/^guest_/i)).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: /^승률 정렬$/i })).toBeInTheDocument();

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
    expect(screen.getAllByRole("columnheader", { name: /^선수$/i }).find((header) => header.getAttribute("aria-sort") === "descending")).toBeTruthy();
  });

  it("renders the selected-season team-analysis contract with current team record and raw match details", () => {
    const baseModel = createTeamAnalysisPageModel();
    const model = {
      ...baseModel,
      recentMatches: [...baseModel.recentMatches].sort((left, right) => left.startTime.localeCompare(right.startTime)),
      scope: {
        selectedSeasonLabel: "시즌8",
        isAllSeasons: false,
        options: [
          { label: "전체", href: "/team-analysis?scope=all", selected: false },
          { label: "시즌8", href: "/team-analysis?season_label=%EC%8B%9C%EC%A6%8C8", selected: true },
          { label: "시즌7", href: "/team-analysis?season_label=%EC%8B%9C%EC%A6%8C7", selected: false }
        ]
      }
    };

    render(<TeamAnalysisPage model={model} />);

    expect(screen.getByRole("link", { name: "전체" })).toHaveAttribute("href", "/team-analysis?scope=all");
    expect(screen.getByRole("link", { name: "시즌8" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText(/시즌8 기준으로 3x3 플레이어/i)).toBeInTheDocument();
    expect(screen.getByText(/^현재 팀 전적$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^최강 조합$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/선택 시즌 기준 종족 조합별 승률/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^플레이어 누적 승률 추이$/i })).toBeInTheDocument();
    expect(screen.getByTestId("season-player-winrate-trend-chart")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^종족별 성적$/i })).toBeInTheDocument();
    expect(screen.getByTestId("season-performance-grid")).toHaveClass("xl:grid-cols-[0.9fr_1.1fr]");
    expect(screen.getByTestId("season-performance-left-stack")).toHaveClass("xl:col-span-1");
    expect(screen.getByTestId("season-lineup-panel")).toHaveClass("xl:col-span-1");
    expect(screen.getByTestId("season-lineup-panel")).toHaveClass("xl:row-span-2");
    expect(screen.getByTestId("season-lineup-panel").firstElementChild).toHaveClass("h-full");
    expect(screen.getAllByTestId("season-race-record-row")).toHaveLength(3);
    expect(screen.getAllByTestId("lineup-performance-row")[0]).toHaveClass("xl:grid-cols-[minmax(76px,auto)_auto_minmax(92px,1fr)_auto]");
    expect(screen.getByRole("heading", { name: /선수 역량 매트릭스/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /분당 유닛생산 정렬/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /P전적 정렬/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /T전적 정렬/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Z전적 정렬/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^전적 정렬$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /BT 정렬/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /TrueSkill 정렬/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /선수별 종족 전적/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /경기 전적 Raw/i })).toBeInTheDocument();
    expect(screen.getAllByText(/P|T|Z/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\d+-\d+ \/ \d+\.\d%/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("columnheader", { name: /승리팀/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /패배팀/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /핵심 인사이트/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/평점 모델 원점수/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^듀오 궁합$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /승부 감각 오각형/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: /팀별 평균 피지컬 오각형/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /리플레이 피지컬 오각형/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Winner Team/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Loser Team/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => /\+\d+\.\d%/.test(element?.textContent ?? "")).length).toBeGreaterThan(0);
    expect(screen.queryByText(/A Team|B Team/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("season-radar-row")).toHaveClass("items-stretch");
    expect(screen.getByTestId("team-pentagon-panel")).toHaveClass("h-full");
    expect(screen.getByTestId("player-pentagon-panel")).toHaveClass("h-full");
    const selectedSeasonRadars = screen.getAllByTestId("player-radar-chart");
    expect(selectedSeasonRadars).toHaveLength(3);
    expect(selectedSeasonRadars[0]).toHaveAccessibleName("팀별 평균 피지컬 오각형");
    const rawRows = screen.getAllByTestId("season-raw-match-row");
    const rawTimes = rawRows.map((row) => within(row).getByTestId("season-raw-match-time").textContent ?? "");
    expect(rawTimes).toEqual([...rawTimes].sort((left, right) => Date.parse(right) - Date.parse(left)));
  });
});
