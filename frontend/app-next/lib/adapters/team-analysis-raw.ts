import { createTeamAnalysisPageModel } from "@/lib/adapters/team-analysis";
import type { ApiGamesListResponse } from "@/types/api";
import type { TeamAnalysisPageModel } from "@/types/team-analysis";

export interface TeamAnalysisRawPayload {
  schemaVersion: "stareplays.team-analysis.raw.v2";
  generatedAt: string;
  scope: {
    teamSize: "3x3";
    seasonLabel: string | null;
  };
  compatibility: {
    minMcpVersion: string;
    recommendedMcpVersion: string;
  };
  source: {
    totalGames: number;
    includedGameIds: number[];
    seasons: string[];
  };
  analysis: TeamAnalysisPageModel;
  llm: {
    promptTitle: string;
    promptContext: string;
    analysisGuidance: string[];
    relatedLinks: Array<{
      label: string;
      url: string;
      description: string;
    }>;
    suggestedQuestions: string[];
  };
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))]
    .sort((left, right) => left.localeCompare(right, "ko"));
}

export function createTeamAnalysisRawPayload({
  gamesResponse,
  seasonLabel = null,
  generatedAt = new Date().toISOString()
}: {
  gamesResponse?: ApiGamesListResponse | null;
  seasonLabel?: string | null;
  generatedAt?: string;
}): TeamAnalysisRawPayload {
  const analysis = createTeamAnalysisPageModel({ gamesResponse });
  const games = gamesResponse?.games ?? [];
  const seasonText = seasonLabel ? `${seasonLabel} 기준` : "전체 시즌 기준";
  const appBaseUrl = "https://stareplays.up.railway.app";
  const seasonHref = seasonLabel ? `${appBaseUrl}/seasons/${encodeURIComponent(seasonLabel)}` : `${appBaseUrl}/seasons`;

  return {
    schemaVersion: "stareplays.team-analysis.raw.v2",
    generatedAt,
    scope: {
      teamSize: "3x3",
      seasonLabel
    },
    compatibility: {
      minMcpVersion: "0.1.0",
      recommendedMcpVersion: "0.2.0"
    },
    source: {
      totalGames: games.length,
      includedGameIds: games.map((game) => Number(game.id)).filter((id) => Number.isFinite(id)),
      seasons: uniqueSorted(games.map((game) => game.season_label))
    },
    analysis,
    llm: {
      promptTitle: `3x3 팀 전적 분석 (${seasonText})`,
      promptContext: [
        "이 데이터는 StarCraft 3x3 팀 경기 raw snapshot과 파생 분석입니다.",
        "선수명은 한국어 표시명을 우선 사용합니다.",
        "답변할 때 표본 경기 수, 승률, 조합, 종족, APM/EAPM, 분당 유닛생산, 자원 소모량 근거를 함께 제시하세요.",
        "player.isRandomSelected는 해당 선수가 랜덤을 선택했는지 나타냅니다. 실제 종족 통계와 선택 룰을 혼동하지 마세요.",
        "Bradley-Terry와 TrueSkill은 절대 단위가 다르므로 순위나 상대 비교로 해석하세요."
      ].join("\n"),
      analysisGuidance: [
        "player.isRandomSelected=true인 선수는 실제 종족이 P/T/Z로 기록되어도 선택은 랜덤입니다.",
        "analysis.players[].randomSelectedGames/randomSelectedWins/randomSelectedWinRate는 실제 랜덤 선택 표본에서 계산된 값입니다.",
        "선수별 랜덤 선택 표본 수를 함께 언급해 종족 통계의 해석 범위를 분리하세요.",
        "player.isRandomSelected=false인 선수는 실제 종족을 선택한 것으로 해석하세요."
      ],
      relatedLinks: [
        {
          label: seasonLabel ? `${seasonLabel} 시즌 전적` : "전체 시즌 전적",
          url: seasonHref,
          description: "시즌별 경기 전적, 선수별 추세, 경기별 종족/랜덤 선택 정보를 확인합니다."
        },
        {
          label: "3v3 랭킹",
          url: `${appBaseUrl}/rankings`,
          description: "전체 랭킹, 종족별 랭킹, 종족 조합 승률을 확인합니다."
        },
        {
          label: "팀 분석",
          url: seasonLabel ? `${appBaseUrl}/team-analysis?season_label=${encodeURIComponent(seasonLabel)}` : `${appBaseUrl}/team-analysis`,
          description: "선수, 조합, 종족 구성 기반 3x3 팀 분석 화면입니다."
        }
      ],
      suggestedQuestions: [
        "이번 시즌 최적 3인 조합을 추천해줘.",
        "랜덤 선택 표본이 있는 선수들의 성과를 비교해줘.",
        "승률은 낮지만 개선 가능성이 큰 선수를 찾아줘.",
        "종족 조합 기준으로 가장 안정적인 운영 패턴을 설명해줘.",
        "APM/EAPM/분당 유닛생산/자원 소모량 지표와 실제 승률이 어긋나는 선수를 분석해줘.",
        "특정 선수와 가장 잘 맞는 파트너 조합을 추천해줘."
      ]
    }
  };
}
