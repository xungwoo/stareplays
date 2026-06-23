import { createTeamAnalysisPageModel } from "@/lib/adapters/team-analysis";
import type { ApiGamesListResponse } from "@/types/api";
import type { TeamAnalysisPageModel } from "@/types/team-analysis";

export interface TeamAnalysisRawPayload {
  schemaVersion: "stareplays.team-analysis.raw.v1";
  generatedAt: string;
  scope: {
    teamSize: "3x3";
    seasonLabel: string | null;
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

  return {
    schemaVersion: "stareplays.team-analysis.raw.v1",
    generatedAt,
    scope: {
      teamSize: "3x3",
      seasonLabel
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
        "답변할 때 표본 경기 수, 승률, 조합, 종족, APM/EAPM/생산능력 근거를 함께 제시하세요.",
        "Bradley-Terry와 TrueSkill은 절대 단위가 다르므로 순위나 상대 비교로 해석하세요."
      ].join("\n"),
      suggestedQuestions: [
        "이번 시즌 최적 3인 조합을 추천해줘.",
        "승률은 낮지만 개선 가능성이 큰 선수를 찾아줘.",
        "종족 조합 기준으로 가장 안정적인 운영 패턴을 설명해줘.",
        "APM/EAPM/생산능력 지표와 실제 승률이 어긋나는 선수를 분석해줘.",
        "특정 선수와 가장 잘 맞는 파트너 조합을 추천해줘."
      ]
    }
  };
}
