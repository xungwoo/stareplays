export function createPromptBundle(rawPayload, { seasonLabel } = {}) {
  const summary = rawPayload?.analysis?.summary ?? {};
  const players = rawPayload?.analysis?.players ?? [];
  const lineups = rawPayload?.analysis?.lineups ?? [];
  const insights = rawPayload?.analysis?.insights?.cards ?? [];
  const analysisGuidance = rawPayload?.llm?.analysisGuidance ?? [];
  const suggestedQuestions = rawPayload?.llm?.suggestedQuestions ?? [];
  const title = rawPayload?.llm?.promptTitle ?? "3x3 팀 전적 분석";
  const seasonText = seasonLabel || rawPayload?.scope?.seasonLabel || "전체 시즌";
  const randomSelectedGames = rawPayload?.source?.randomSelectedGames ?? rawPayload?.analysis?.summary?.randomSelectedGames ?? null;

  return [
    `# ${title}`,
    "",
    `대상: ${seasonText}`,
    "",
    "## 분석 지침",
    rawPayload?.llm?.promptContext ?? "제공된 JSON 데이터만 근거로 분석하세요.",
    "",
    "## 핵심 요약",
    `- 분석 경기: ${summary.gamesAnalyzed ?? 0}`,
    `- 추적 선수: ${summary.playersTracked ?? players.length}`,
    `- 최고 선수: ${summary.topPlayer ?? "-"}`,
    `- 최고 조합: ${summary.topLineup ?? "-"}`,
    ...(randomSelectedGames == null ? [] : [`- 랜덤 선택 경기: ${randomSelectedGames}`]),
    "",
    "## 추가 분석 지침",
    ...(analysisGuidance.length > 0 ? analysisGuidance.map((item) => `- ${item}`) : ["- Raw JSON의 features와 compatibility를 확인하고, 알 수 없는 신규 필드는 원문 근거로만 해석하세요."]),
    "",
    "## 선수 요약",
    ...players.map((player) => `- ${player.name}: ${player.wins}-${player.losses}, 승률 ${player.winRate}%, APM ${player.averageApm}, 생산능력 ${player.productionAbility}`),
    "",
    "## 상위 조합",
    ...lineups.slice(0, 8).map((lineup) => `- ${lineup.players.join(" + ")} (${lineup.composition}): ${lineup.wins}-${lineup.losses}, 승률 ${lineup.winRate}%`),
    "",
    "## 기존 인사이트",
    ...insights.slice(0, 8).map((card) => `- ${card.title}: ${card.body}`),
    "",
    "## 추천 질문",
    ...suggestedQuestions.map((question) => `- ${question}`),
    "",
    "## Raw JSON",
    "```json",
    JSON.stringify(rawPayload, null, 2),
    "```"
  ].join("\n");
}
