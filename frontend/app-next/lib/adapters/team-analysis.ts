import { VAULT_GAMES_FIXTURE } from "@/lib/fixtures/vault";
import { formatStartTime, getRaceLetter } from "@/lib/utils/format";
import { getPlayerColor } from "@/lib/utils/player-colors";
import { displayLineupName, displayPlayerName, displayPlayerNames } from "@/lib/utils/player-display";
import type { ApiGamePlayer, ApiGameSummary, ApiGamesListResponse } from "@/types/api";
import type { RaceCode } from "@/types/common";
import type { TeamAnalysisDuo, TeamAnalysisInsightCard, TeamAnalysisLineup, TeamAnalysisPageModel, TeamAnalysisPlayer, TeamAnalysisPlayerPentagon, TeamAnalysisRaceComposition, TeamAnalysisRaceStat, TeamAnalysisRecentMatch } from "@/types/team-analysis";
import type { VaultGame, VaultPlayer } from "@/types/vault";

type TeamSide = {
  players: NormalizedPlayer[];
  isWinner: boolean;
};

type NormalizedPlayer = {
  name: string;
  race: RaceCode;
  isRandomSelected: boolean;
  apm: number;
  eapm: number;
  cmdCount: number;
  effectiveCmdCount: number;
  unitProduction: number;
  resourceSpend: number;
};

type NormalizedMatch = {
  id: number;
  map: string;
  startTime: string;
  gameLength: number;
  winner: NormalizedPlayer[];
  loser: NormalizedPlayer[];
};

type PlayerAccumulator = {
  name: string;
  games: number;
  wins: number;
  losses: number;
  randomSelectedGames: number;
  randomSelectedWins: number;
  apmTotal: number;
  eapmTotal: number;
  commandTotal: number;
  effectiveCommandTotal: number;
  minuteTotal: number;
  unitProductionTotal: number;
  unitProductionGames: number;
  resourceSpendTotal: number;
  resourceSpendGames: number;
  races: Map<RaceCode, { games: number; wins: number; losses: number }>;
  partnerWins: Map<string, number>;
};

type TrainingFeedbackCandidate = {
  score: number;
  text: string;
};

const INITIAL_TRUESKILL_MU = 25;
const INITIAL_TRUESKILL_SIGMA = 8.333;
const MIN_PLAYER_RACE_GAMES = 3;
const MIN_LINEUP_GAMES = 3;

function minCompositionGames(matches: NormalizedMatch[]): number {
  return Math.max(3, Math.ceil(matches.length * 0.05));
}

function toNumber(value: unknown, fallback = 0): number {
  const candidate = Number(value);

  return Number.isFinite(candidate) ? candidate : fallback;
}

function round(value: number, digits = 1): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function winRate(wins: number, games: number): number {
  return games > 0 ? round((wins / games) * 100, 1) : 0;
}

function isTrackedPlayer(name: string): boolean {
  return name.trim().toLowerCase().startsWith("3x3");
}

function sortNames(names: string[]): string[] {
  return [...names].sort((left, right) => left.localeCompare(right));
}

function lineupKey(players: NormalizedPlayer[]): string {
  return sortNames(players.map((player) => player.name)).join(" + ");
}

function raceComposition(players: NormalizedPlayer[]): string {
  return players.map((player) => player.race).sort().join("");
}

function normalizeApiPlayer(player: ApiGamePlayer, game: ApiGameSummary): NormalizedPlayer {
  const playerName = player.name?.trim() || "Unknown";
  const analysis = game.season_analysis?.players?.[playerName];

  return {
    name: playerName,
    race: getRaceLetter(player.race ?? "P"),
    isRandomSelected: player.is_random_selected === true,
    apm: toNumber(player.apm),
    eapm: toNumber(player.eapm),
    cmdCount: toNumber(player.cmd_count),
    effectiveCmdCount: toNumber(player.effective_cmd_count),
    unitProduction: toNumber(analysis?.production),
    resourceSpend: toNumber(analysis?.resource_spend)
  };
}

function getApiTeams(game: ApiGameSummary): TeamSide[] {
	const players = Array.isArray(game.edges?.players) ? game.edges.players : [];
	const winnerTeamNumber = toNumber(game.winner_team);
	const teams = new Map<number, ApiGamePlayer[]>();

  players.forEach((player) => {
    const team = toNumber(player.team);
    if (team <= 0) return;
    teams.set(team, [...(teams.get(team) ?? []), player]);
  });

	return Array.from(teams.entries()).map(([team, teamPlayers]) => ({
		players: teamPlayers.map((player) => normalizeApiPlayer(player, game)).filter((player) => isTrackedPlayer(player.name)),
		isWinner: team === winnerTeamNumber
	}));
}

function normalizeApiGame(game: ApiGameSummary): NormalizedMatch | null {
	const teams = getApiTeams(game).filter((team) => team.players.length === 3);
	const winner = teams.find((team) => team.isWinner)?.players ?? [];
	const loser = teams.find((team) => !team.isWinner)?.players ?? [];

	if (teams.length !== 2 || winner.length !== 3 || loser.length !== 3) return null;

	return {
    id: toNumber(game.id),
    map: game.map_name?.trim() || "Unknown Map",
    startTime: formatStartTime(game.start_time ?? ""),
    gameLength: toNumber(game.game_length),
    winner,
    loser
  };
}

function normalizeVaultPlayer(player: VaultPlayer): NormalizedPlayer {
  return {
    name: player.name,
    race: player.race,
    isRandomSelected: false,
    apm: player.apm,
    eapm: player.eapm,
    cmdCount: player.apm,
    effectiveCmdCount: player.eapm,
    unitProduction: player.production,
    resourceSpend: 0
  };
}

function normalizeVaultGame(game: VaultGame): NormalizedMatch | null {
  const winner = game.winnerTeam.map(normalizeVaultPlayer).filter((player) => isTrackedPlayer(player.name));
  const loser = game.loserTeam.map(normalizeVaultPlayer).filter((player) => isTrackedPlayer(player.name));

  if (winner.length === 0 || loser.length === 0) return null;

  return {
    id: game.id,
    map: game.map,
    startTime: game.startTime,
    gameLength: 900,
    winner,
    loser
  };
}

function getMatches(gamesResponse?: ApiGamesListResponse | null): NormalizedMatch[] {
  const apiGames = gamesResponse?.games?.map(normalizeApiGame).filter((game): game is NormalizedMatch => game != null) ?? [];

  if (apiGames.length > 0) {
    return apiGames;
  }

  return VAULT_GAMES_FIXTURE.map(normalizeVaultGame).filter((game): game is NormalizedMatch => game != null);
}

function getOrCreatePlayer(accumulators: Map<string, PlayerAccumulator>, player: NormalizedPlayer): PlayerAccumulator {
  const existing = accumulators.get(player.name);
  if (existing) return existing;

  const created: PlayerAccumulator = {
    name: player.name,
    games: 0,
    wins: 0,
    losses: 0,
    randomSelectedGames: 0,
    randomSelectedWins: 0,
    apmTotal: 0,
    eapmTotal: 0,
    commandTotal: 0,
    effectiveCommandTotal: 0,
    minuteTotal: 0,
    unitProductionTotal: 0,
    unitProductionGames: 0,
    resourceSpendTotal: 0,
    resourceSpendGames: 0,
    races: new Map(),
    partnerWins: new Map()
  };
  accumulators.set(player.name, created);
  return created;
}

function recordPlayer(accumulator: PlayerAccumulator, player: NormalizedPlayer, won: boolean, teammates: NormalizedPlayer[], gameLength: number) {
  accumulator.games += 1;
  accumulator.wins += won ? 1 : 0;
  accumulator.losses += won ? 0 : 1;
  accumulator.randomSelectedGames += player.isRandomSelected ? 1 : 0;
  accumulator.randomSelectedWins += player.isRandomSelected && won ? 1 : 0;
  accumulator.apmTotal += player.apm;
  accumulator.eapmTotal += player.eapm;
  accumulator.commandTotal += player.cmdCount;
  accumulator.effectiveCommandTotal += player.effectiveCmdCount;
  accumulator.minuteTotal += Math.max(gameLength / 60, 1);
  if (player.unitProduction > 0) {
    accumulator.unitProductionTotal += player.unitProduction;
    accumulator.unitProductionGames += 1;
  }
  if (player.resourceSpend > 0) {
    accumulator.resourceSpendTotal += player.resourceSpend;
    accumulator.resourceSpendGames += 1;
  }

  const race = accumulator.races.get(player.race) ?? { games: 0, wins: 0, losses: 0 };
  race.games += 1;
  race.wins += won ? 1 : 0;
  race.losses += won ? 0 : 1;
  accumulator.races.set(player.race, race);

  if (won) {
    teammates
      .filter((teammate) => teammate.name !== player.name)
      .forEach((teammate) => {
        accumulator.partnerWins.set(teammate.name, (accumulator.partnerWins.get(teammate.name) ?? 0) + 1);
      });
  }
}

function updateLineup(
  lineups: Map<string, { players: string[]; composition: string; games: number; wins: number; losses: number; apmTotal: number }>,
  players: NormalizedPlayer[],
  won: boolean
) {
  const key = lineupKey(players);
  const existing = lineups.get(key) ?? {
    players: sortNames(players.map((player) => player.name)),
    composition: raceComposition(players),
    games: 0,
    wins: 0,
    losses: 0,
    apmTotal: 0
  };

  existing.games += 1;
  existing.wins += won ? 1 : 0;
  existing.losses += won ? 0 : 1;
  existing.apmTotal += players.reduce((sum, player) => sum + player.apm, 0) / Math.max(players.length, 1);
  lineups.set(key, existing);
}

function updateComposition(
  compositions: Map<string, { composition: string; games: number; wins: number; losses: number }>,
  players: NormalizedPlayer[],
  won: boolean
) {
  const composition = raceComposition(players);
  const existing = compositions.get(composition) ?? { composition, games: 0, wins: 0, losses: 0 };
  existing.games += 1;
  existing.wins += won ? 1 : 0;
  existing.losses += won ? 0 : 1;
  compositions.set(composition, existing);
}

function updateDuos(duos: Map<string, { players: string[]; games: number; wins: number; losses: number }>, players: NormalizedPlayer[], won: boolean) {
  for (let left = 0; left < players.length; left += 1) {
    for (let right = left + 1; right < players.length; right += 1) {
      const pair = sortNames([players[left]?.name ?? "", players[right]?.name ?? ""]).filter(Boolean);
      if (pair.length !== 2) continue;

      const key = pair.join(" + ");
      const existing = duos.get(key) ?? { players: pair, games: 0, wins: 0, losses: 0 };
      existing.games += 1;
      existing.wins += won ? 1 : 0;
      existing.losses += won ? 0 : 1;
      duos.set(key, existing);
    }
  }
}

function buildBradleyTerryScores(matches: NormalizedMatch[], playerNames: string[]): Map<string, number> {
  const scores = new Map(playerNames.map((name) => [name, 0]));
  const learningRate = 0.08;

  for (let iteration = 0; iteration < 80; iteration += 1) {
    matches.forEach((match) => {
      const winners = match.winner.map((player) => player.name);
      const losers = match.loser.map((player) => player.name);
      const winnerScore = winners.reduce((sum, name) => sum + (scores.get(name) ?? 0), 0) / Math.max(winners.length, 1);
      const loserScore = losers.reduce((sum, name) => sum + (scores.get(name) ?? 0), 0) / Math.max(losers.length, 1);
      const expected = 1 / (1 + Math.exp(loserScore - winnerScore));
      const error = 1 - expected;
      const winnerDelta = (learningRate * error) / Math.max(winners.length, 1);
      const loserDelta = (learningRate * error) / Math.max(losers.length, 1);

      winners.forEach((name) => scores.set(name, (scores.get(name) ?? 0) + winnerDelta));
      losers.forEach((name) => scores.set(name, (scores.get(name) ?? 0) - loserDelta));
    });
  }

  return scores;
}

function buildTrueSkillScores(matches: NormalizedMatch[], playerNames: string[]) {
  const ratings = new Map(playerNames.map((name) => [name, { mu: INITIAL_TRUESKILL_MU, sigma: INITIAL_TRUESKILL_SIGMA }]));
  const kFactor = 1.35;

  matches.forEach((match) => {
    const winners = match.winner.map((player) => player.name);
    const losers = match.loser.map((player) => player.name);
    const winnerMu = winners.reduce((sum, name) => sum + (ratings.get(name)?.mu ?? INITIAL_TRUESKILL_MU), 0) / Math.max(winners.length, 1);
    const loserMu = losers.reduce((sum, name) => sum + (ratings.get(name)?.mu ?? INITIAL_TRUESKILL_MU), 0) / Math.max(losers.length, 1);
    const expected = 1 / (1 + Math.exp((loserMu - winnerMu) / 8));
    const delta = kFactor * (1 - expected);

    winners.forEach((name) => {
      const rating = ratings.get(name) ?? { mu: INITIAL_TRUESKILL_MU, sigma: INITIAL_TRUESKILL_SIGMA };
      ratings.set(name, { mu: rating.mu + delta, sigma: Math.max(3, rating.sigma * 0.96) });
    });
    losers.forEach((name) => {
      const rating = ratings.get(name) ?? { mu: INITIAL_TRUESKILL_MU, sigma: INITIAL_TRUESKILL_SIGMA };
      ratings.set(name, { mu: rating.mu - delta, sigma: Math.max(3, rating.sigma * 0.96) });
    });
  });

  return ratings;
}

function raceStatsFrom(accumulator: PlayerAccumulator): TeamAnalysisRaceStat[] {
  return Array.from(accumulator.races.entries())
    .map(([race, stat]) => ({
      race,
      games: stat.games,
      wins: stat.wins,
      losses: stat.losses,
      winRate: winRate(stat.wins, stat.games),
      qualified: stat.games >= MIN_PLAYER_RACE_GAMES
    }))
    .sort((left, right) => right.games - left.games || left.race.localeCompare(right.race));
}

function bestRaceFrom(stats: TeamAnalysisRaceStat[]): RaceCode {
  const qualified = stats.filter((stat) => stat.qualified);
  return [...(qualified.length > 0 ? qualified : stats)].sort((left, right) => right.winRate - left.winRate || right.games - left.games || left.race.localeCompare(right.race))[0]?.race ?? "P";
}

function worstRaceFrom(stats: TeamAnalysisRaceStat[]): RaceCode {
  const qualified = stats.filter((stat) => stat.qualified);
  return [...(qualified.length > 0 ? qualified : stats)].sort((left, right) => left.winRate - right.winRate || right.games - left.games || left.race.localeCompare(right.race))[0]?.race ?? "P";
}

function raceStrengthLabel(stats: TeamAnalysisRaceStat[], race: RaceCode): string {
  const stat = stats.find((candidate) => candidate.race === race);
  if (!stat) return `${race} 데이터 없음`;

  const suffix = stat.qualified ? "" : ` / 표본 ${stat.games}경기`;
  return `${race} ${formatPercentValue(stat.winRate)}${suffix}`;
}

function rankPlayers(players: TeamAnalysisPlayer[], key: keyof Pick<TeamAnalysisPlayer, "averageApm" | "bradleyTerry" | "trueSkill">) {
  const sorted = [...players].sort((left, right) => Number(right[key]) - Number(left[key]) || left.name.localeCompare(right.name));
  sorted.forEach((player, index) => {
    if (key === "averageApm") player.apmRank = index + 1;
    if (key === "bradleyTerry") player.bradleyTerryRank = index + 1;
    if (key === "trueSkill") player.trueSkillRank = index + 1;
  });
}

function raceLabel(race: RaceCode): string {
  if (race === "P") return "프로토스";
  if (race === "Z") return "저그";
  if (race === "T") return "테란";

  return "랜덤";
}

function feedbackGap(value: number, values: number[]): number {
  const normalized = normalizeMetric(value, values);

  return Number.isFinite(normalized) ? Math.max(0, 100 - normalized) : 0;
}

function buildTrainingFeedback(player: TeamAnalysisPlayer, peers: TeamAnalysisPlayer[]): string[] {
  const apmValues = peers.map((peer) => peer.averageApm);
  const eapmValues = peers.map((peer) => peer.averageEapm);
  const productionValues = peers.map((peer) => peer.unitProduction);
  const resourceValues = peers.map((peer) => peer.resourceSpend);
  const winRateValues = peers.map((peer) => peer.winRate);
  const candidates: TrainingFeedbackCandidate[] = [];
  const weakRace = player.raceStats.find((stat) => stat.race === player.worstRace);

  candidates.push({
    score: feedbackGap(player.averageApm, apmValues),
    text: `APM이 느린 편입니다. 피지컬을 올리려면 초반 5분 생산-정찰-부대지정 루틴을 쉬지 않고 반복하는 훈련이 좋습니다.`
  });
  candidates.push({
    score: feedbackGap(player.averageEapm, eapmValues),
    text: `EAPM이 아쉽습니다. 손은 움직이는데 결과로 이어지는 명령이 부족할 수 있어서, 화면 전환 후 한 번에 정확히 찍는 연습을 추천합니다.`
  });
  candidates.push({
    score: feedbackGap(player.unitProduction, productionValues),
    text: `유닛 생산량이 낮은 편입니다. 교전 직전에도 게이트, 해처리, 팩토리 큐가 비지 않도록 생산 단축키 루틴부터 고정하면 효과가 큽니다.`
  });
  candidates.push({
    score: Math.max(0, 80 - player.commandEfficiency),
    text: `명령 효율이 흔들립니다. 의미 없는 반복 클릭을 줄이고, 이동-생산-교전 명령을 짧고 선명하게 끊어 치는 훈련이 맞습니다.`
  });
  candidates.push({
    score: feedbackGap(player.resourceSpend, resourceValues),
    text: `자원 소모량이 낮은 편입니다. 돈이 남는 타이밍을 줄이려면 생산 건물 추가, 업그레이드 예약, 멀티 타이밍을 체크리스트로 묶어보세요.`
  });
  candidates.push({
    score: feedbackGap(player.winRate, winRateValues),
    text: `승률 지표가 낮은 편입니다. 무리한 교전보다 팀 합류 타이밍과 생존 우선 판단을 먼저 다듬는 쪽이 승수 올리기에 빠릅니다.`
  });

  if (weakRace) {
    const sampleNote = weakRace.qualified ? "" : " 표본은 적지만";
    candidates.push({
      score: Math.max(35, 100 - weakRace.winRate),
      text: `${raceLabel(weakRace.race)} 경기에서${sampleNote} 약점 신호가 보입니다. 초반 빌드 하나를 고정해서 운영 전환까지 같은 루트로 5판 이상 반복해보세요.`
    });
  }

  if (player.randomSelectedGames > 0 && player.randomSelectedWinRate < player.winRate) {
    candidates.push({
      score: Math.max(40, player.winRate - player.randomSelectedWinRate),
      text: `랜덤 선택 경기 승률이 평소보다 낮습니다. 랜덤은 감으로 열기보다 종족별 첫 3분 대응표를 만들어두는 게 좋습니다.`
    });
  }

  const unique = new Map<string, TrainingFeedbackCandidate>();
  candidates.forEach((candidate) => {
    if (candidate.score <= 0) return;
    const existing = unique.get(candidate.text);
    if (!existing || existing.score < candidate.score) unique.set(candidate.text, candidate);
  });

  const feedback = Array.from(unique.values())
    .sort((left, right) => right.score - left.score || left.text.localeCompare(right.text, "ko"))
    .slice(0, 3)
    .map((candidate) => candidate.text);

  return feedback.length > 0 ? feedback : ["지표상 큰 구멍은 없습니다. 지금은 새 빌드보다 잘 되는 루틴을 더 안정적으로 반복하는 훈련이 좋습니다."];
}

function buildPlayers(matches: NormalizedMatch[]): TeamAnalysisPlayer[] {
  const accumulators = new Map<string, PlayerAccumulator>();

  matches.forEach((match) => {
    match.winner.forEach((player) => recordPlayer(getOrCreatePlayer(accumulators, player), player, true, match.winner, match.gameLength));
    match.loser.forEach((player) => recordPlayer(getOrCreatePlayer(accumulators, player), player, false, match.loser, match.gameLength));
  });

  const playerNames = Array.from(accumulators.keys()).sort();
  const bradleyTerryScores = buildBradleyTerryScores(matches, playerNames);
  const trueSkillScores = buildTrueSkillScores(matches, playerNames);
  const players = Array.from(accumulators.values()).map((accumulator) => {
    const raceStats = raceStatsFrom(accumulator);
    const trueSkillRating = trueSkillScores.get(accumulator.name) ?? { mu: INITIAL_TRUESKILL_MU, sigma: INITIAL_TRUESKILL_SIGMA };
    const conservativeTrueSkill = trueSkillRating.mu - 3 * trueSkillRating.sigma;
    const bestRace = bestRaceFrom(raceStats);
    const worstRace = worstRaceFrom(raceStats);
    const partnerWins = Array.from(accumulator.partnerWins.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 2)
      .map(([name]) => name);

    return {
      name: accumulator.name,
      games: accumulator.games,
      wins: accumulator.wins,
      losses: accumulator.losses,
      winRate: winRate(accumulator.wins, accumulator.games),
      randomSelectedGames: accumulator.randomSelectedGames,
      randomSelectedWins: accumulator.randomSelectedWins,
      randomSelectedWinRate: winRate(accumulator.randomSelectedWins, accumulator.randomSelectedGames),
      averageApm: round(accumulator.apmTotal / Math.max(accumulator.games, 1), 1),
      averageEapm: round(accumulator.eapmTotal / Math.max(accumulator.games, 1), 1),
      commandEfficiency: round((accumulator.effectiveCommandTotal / Math.max(accumulator.commandTotal, 1)) * 100, 1),
      unitProduction: round(accumulator.unitProductionTotal / Math.max(accumulator.unitProductionGames, 1), 1),
      resourceSpend: round(accumulator.resourceSpendTotal / Math.max(accumulator.resourceSpendGames, 1), 1),
      apmRank: 0,
      bradleyTerry: round(1000 + (bradleyTerryScores.get(accumulator.name) ?? 0) * 180, 1),
      bradleyTerryRank: 0,
      trueSkill: round(conservativeTrueSkill, 1),
      trueSkillMu: round(trueSkillRating.mu, 1),
      trueSkillSigma: round(trueSkillRating.sigma, 1),
      trueSkillRank: 0,
      bestRace,
      worstRace,
      strength: raceStrengthLabel(raceStats, bestRace),
      weakness: raceStrengthLabel(raceStats, worstRace),
      trainingFeedback: [] as string[],
      raceStats,
      bestPartners: partnerWins
    };
  });

  rankPlayers(players, "averageApm");
  rankPlayers(players, "bradleyTerry");
  rankPlayers(players, "trueSkill");
  players.forEach((player) => {
    player.trainingFeedback = buildTrainingFeedback(player, players);
  });

  return players.sort((left, right) => right.trueSkill - left.trueSkill || right.bradleyTerry - left.bradleyTerry || left.name.localeCompare(right.name));
}

function buildLineups(matches: NormalizedMatch[]): TeamAnalysisLineup[] {
  const lineups = new Map<string, { players: string[]; composition: string; games: number; wins: number; losses: number; apmTotal: number }>();

  matches.forEach((match) => {
    updateLineup(lineups, match.winner, true);
    updateLineup(lineups, match.loser, false);
  });

  return Array.from(lineups.values())
    .map((lineup) => ({
      players: lineup.players,
      composition: lineup.composition,
      games: lineup.games,
      wins: lineup.wins,
      losses: lineup.losses,
      winRate: winRate(lineup.wins, lineup.games),
      averageApm: round(lineup.apmTotal / Math.max(lineup.games, 1), 1)
    }))
    .sort((left, right) => right.winRate - left.winRate || right.games - left.games || left.players.join("").localeCompare(right.players.join("")));
}

function buildRaceCompositions(matches: NormalizedMatch[]): TeamAnalysisRaceComposition[] {
  const compositions = new Map<string, { composition: string; games: number; wins: number; losses: number }>();
  const minGames = minCompositionGames(matches);

  matches.forEach((match) => {
    updateComposition(compositions, match.winner, true);
    updateComposition(compositions, match.loser, false);
  });

  return Array.from(compositions.values())
    .map((composition) => ({
      ...composition,
      winRate: winRate(composition.wins, composition.games),
      qualified: composition.games >= minGames,
      note: composition.games >= minGames ? `${composition.games}경기 표본` : `표본 부족 (${composition.games}/${minGames})`
    }))
    .sort((left, right) => Number(right.qualified) - Number(left.qualified) || right.winRate - left.winRate || right.games - left.games || left.composition.localeCompare(right.composition));
}

function buildSingleRaceRecords(matches: NormalizedMatch[]): Array<{ race: RaceCode; games: number; wins: number; losses: number; winRate: number }> {
  const records = new Map<RaceCode, { race: RaceCode; games: number; wins: number; losses: number }>();

  matches.forEach((match) => {
    match.winner.forEach((player) => {
      const record = records.get(player.race) ?? { race: player.race, games: 0, wins: 0, losses: 0 };
      record.games += 1;
      record.wins += 1;
      records.set(player.race, record);
    });
    match.loser.forEach((player) => {
      const record = records.get(player.race) ?? { race: player.race, games: 0, wins: 0, losses: 0 };
      record.games += 1;
      record.losses += 1;
      records.set(player.race, record);
    });
  });

  return (["P", "T", "Z"] as RaceCode[]).map((race) => {
    const record = records.get(race) ?? { race, games: 0, wins: 0, losses: 0 };

    return {
      ...record,
      winRate: winRate(record.wins, record.games)
    };
  });
}

function buildDuos(matches: NormalizedMatch[]): TeamAnalysisDuo[] {
  const duos = new Map<string, { players: string[]; games: number; wins: number; losses: number }>();

  matches.forEach((match) => {
    updateDuos(duos, match.winner, true);
    updateDuos(duos, match.loser, false);
  });

  return Array.from(duos.values())
    .map((duo) => ({
      ...duo,
      winRate: winRate(duo.wins, duo.games)
    }))
    .sort((left, right) => right.winRate - left.winRate || right.games - left.games || left.players.join("").localeCompare(right.players.join("")));
}

function buildRecentMatches(matches: NormalizedMatch[]): TeamAnalysisRecentMatch[] {
  return [...matches]
    .reverse()
    .map((match) => ({
      id: match.id,
      map: match.map,
      winner: displayLineupName(sortNames(match.winner.map((player) => player.name))),
      loser: displayLineupName(sortNames(match.loser.map((player) => player.name))),
      startTime: match.startTime,
      winnerTeam: sortNames(match.winner.map((player) => player.name)).map((name) => {
        const player = match.winner.find((candidate) => candidate.name === name);

        return {
          name: displayPlayerName(name),
          race: player?.race ?? "P",
          randomSelected: player?.isRandomSelected === true,
          apm: player?.apm ?? 0,
          eapm: player?.eapm ?? 0
        };
      }),
      loserTeam: sortNames(match.loser.map((player) => player.name)).map((name) => {
        const player = match.loser.find((candidate) => candidate.name === name);

        return {
          name: displayPlayerName(name),
          race: player?.race ?? "P",
          randomSelected: player?.isRandomSelected === true,
          apm: player?.apm ?? 0,
          eapm: player?.eapm ?? 0
        };
      })
    }));
}

function formatPercentValue(value: number): string {
  return `${value.toFixed(1)}%`;
}

function normalizeMetric(value: number, values: number[]): number {
  const finiteValues = values.filter((candidate) => Number.isFinite(candidate));
  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);

  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return 0;
  if (max === min) return 70;

  return round(((value - min) / (max - min)) * 100, 1);
}

function normalizeMetricBand(value: number, values: number[], floor = 35, ceiling = 96): number {
  const normalized = normalizeMetric(value, values);
  if (normalized === 0) return floor;
  if (normalized === 100) return ceiling;

  return round(floor + (normalized / 100) * (ceiling - floor), 1);
}

function normalizePositiveMetricBand(value: number, values: number[], floor = 35, ceiling = 96): number {
  if (value <= 0 || values.every((candidate) => candidate <= 0)) return 0;

  return normalizeMetricBand(value, values, floor, ceiling);
}

function randomSelectionScore(player: TeamAnalysisPlayer): number {
  if (player.randomSelectedGames <= 0) return 0;
  if (player.randomSelectedGames >= MIN_PLAYER_RACE_GAMES) return player.randomSelectedWinRate;

  return round(player.randomSelectedWinRate * (player.randomSelectedGames / MIN_PLAYER_RACE_GAMES), 1);
}

function raceCapabilityScore(player: TeamAnalysisPlayer, race: RaceCode): number {
  const stat = player.raceStats.find((candidate) => candidate.race === race);
  if (!stat) return 50;
  if (stat.qualified) return stat.winRate;

  return round(stat.winRate * (stat.games / MIN_PLAYER_RACE_GAMES), 1);
}

function teamAdaptabilityScore(player: TeamAnalysisPlayer): number {
  const partnerCountScore = Math.min(42, player.bestPartners.length * 21);
  const randomScore = player.randomSelectedGames > 0 ? player.randomSelectedWinRate * 0.24 : player.winRate * 0.12;
  const raceCoverageScore = Math.min(22, player.raceStats.filter((stat) => stat.games > 0).length * 7.4);
  const performanceScore = player.winRate * 0.24;

  return Math.min(100, round(partnerCountScore + randomScore + raceCoverageScore + performanceScore, 1));
}

function buildPlayerPentagons(players: TeamAnalysisPlayer[]): TeamAnalysisPlayerPentagon[] {
  const topPlayers = players.slice(0, 6);
  const apmValues = players.map((player) => player.averageApm);
  const eapmValues = players.map((player) => player.averageEapm);
  const btValues = players.map((player) => player.bradleyTerry);
  const tsValues = players.map((player) => player.trueSkill);
  const productionValues = players.map((player) => player.unitProduction);
  const resourceValues = players.map((player) => player.resourceSpend);
  const tones: TeamAnalysisPlayerPentagon["players"][number]["tone"][] = ["cyan", "emerald", "violet", "amber", "rose", "cyan"];

  return [
    {
      title: "승부 감각 오각형",
      description: "승률, Bradley-Terry, TrueSkill, 주종 강점, 팀 적응력을 묶어 장기 결과 감각을 봅니다.",
      axes: ["승률", "BT", "TrueSkill", "주종", "팀 적응력"],
      players: topPlayers.map((player, index) => ({
        name: player.name,
        tone: tones[index % tones.length],
        color: getPlayerColor(player.name),
        axes: [
          { label: "승률", value: player.winRate },
          { label: "BT", value: normalizeMetricBand(player.bradleyTerry, btValues) },
          { label: "TrueSkill", value: normalizeMetricBand(player.trueSkill, tsValues) },
          { label: "주종", value: Math.max(...player.raceStats.filter((stat) => stat.qualified).map((stat) => stat.winRate), player.winRate) },
          { label: "팀 적응력", value: teamAdaptabilityScore(player) }
        ]
      }))
    },
    {
      title: "종족 역량 오각형",
      description: "프로토스, 저그, 테란별 실제 승률과 선수별 랜덤 선택 승률, 전체 승률을 비교합니다. 전적 없는 종족은 50 기준선으로 표시합니다.",
      axes: ["프로토스", "저그", "테란", "랜덤", "전체 역량"],
      players: topPlayers.map((player, index) => ({
        name: player.name,
        tone: tones[index % tones.length],
        color: getPlayerColor(player.name),
        axes: [
          { label: "프로토스", value: raceCapabilityScore(player, "P") },
          { label: "저그", value: raceCapabilityScore(player, "Z") },
          { label: "테란", value: raceCapabilityScore(player, "T") },
          { label: "랜덤", value: randomSelectionScore(player) },
          { label: "전체 역량", value: player.winRate }
        ]
      }))
    },
    {
      title: "리플레이 피지컬 오각형",
      description: "APM, EAPM, 명령 효율, 유닛 생산량, 자원 소모량을 리플레이 수치로 비교합니다.",
      axes: ["APM", "EAPM", "명령효율", "유닛 생산량", "자원 소모량"],
      players: topPlayers.map((player, index) => ({
        name: player.name,
        tone: tones[index % tones.length],
        color: getPlayerColor(player.name),
        axes: [
          { label: "APM", value: normalizeMetricBand(player.averageApm, apmValues) },
          { label: "EAPM", value: normalizeMetricBand(player.averageEapm, eapmValues) },
          { label: "명령효율", value: player.commandEfficiency },
          { label: "유닛 생산량", value: normalizePositiveMetricBand(player.unitProduction, productionValues) },
          { label: "자원 소모량", value: normalizePositiveMetricBand(player.resourceSpend, resourceValues) }
        ]
      }))
    }
  ];
}

function lineupLabel(lineup: TeamAnalysisLineup | null | undefined): string {
  return lineup ? displayLineupName(lineup.players) : "데이터 없음";
}

function buildCurrentLineupScore(lineups: TeamAnalysisLineup[]): TeamAnalysisPageModel["summary"]["currentLineupScore"] {
  const [first, second] = [...lineups].sort((left, right) => right.wins - left.wins || right.games - left.games || right.winRate - left.winRate);

  if (!first || !second) {
    return {
      value: "데이터 없음",
      hint: "비교할 조합 표본이 부족합니다"
    };
  }

  return {
    value: `${first.wins}승 vs ${second.wins}승`,
    hint: `${displayLineupName(first.players)} ${first.wins}-${first.losses} / ${displayLineupName(second.players)} ${second.wins}-${second.losses}`
  };
}

function buildWeakestRaceSummary(records: ReturnType<typeof buildSingleRaceRecords>): TeamAnalysisPageModel["summary"]["weakestRace"] {
  const weakest = [...records]
    .filter((record) => record.games > 0)
    .sort((left, right) => left.winRate - right.winRate || right.games - left.games || left.race.localeCompare(right.race))[0] ?? { race: "P" as RaceCode, games: 0, wins: 0, losses: 0, winRate: 0 };

  return {
    race: weakest.race,
    value: `${raceLabel(weakest.race)} ${formatPercentValue(weakest.winRate)}`,
    hint: `${weakest.wins}-${weakest.losses}, ${weakest.games}경기 기준 단일 종족 승률`
  };
}

function makeInsightCard(card: TeamAnalysisInsightCard): TeamAnalysisInsightCard {
  return card;
}

function buildInsights(players: TeamAnalysisPlayer[], lineups: TeamAnalysisLineup[], raceCompositions: TeamAnalysisRaceComposition[], duos: TeamAnalysisDuo[]): TeamAnalysisPageModel["insights"] {
  const qualifiedLineups = lineups.filter((lineup) => lineup.games >= MIN_LINEUP_GAMES);
  const bestLineup = qualifiedLineups[0] ?? lineups[0] ?? null;
  const worstLineup = [...(qualifiedLineups.length > 0 ? qualifiedLineups : lineups)].filter((lineup) => lineup.games > 0).sort((left, right) => left.winRate - right.winRate || right.games - left.games)[0] ?? null;
  const bestDuo = duos.find((duo) => duo.games >= MIN_LINEUP_GAMES) ?? duos[0] ?? null;
  const randomPlayers = players.filter((player) => player.randomSelectedGames > 0);
  const randomReadyPlayer = [...randomPlayers].sort((left, right) => right.randomSelectedWinRate - left.randomSelectedWinRate || right.randomSelectedWins - left.randomSelectedWins || right.randomSelectedGames - left.randomSelectedGames)[0] ?? null;
  const randomRiskPlayer = [...randomPlayers].sort((left, right) => left.randomSelectedWinRate - right.randomSelectedWinRate || right.randomSelectedGames - left.randomSelectedGames || left.winRate - right.winRate)[0] ?? null;
  const bestRace = raceCompositions.find((composition) => composition.qualified) ?? raceCompositions[0] ?? null;
  const productionLeader = [...players].sort((left, right) => right.unitProduction - left.unitProduction || right.averageEapm - left.averageEapm)[0] ?? null;
  const resourceLeader = [...players].sort((left, right) => right.resourceSpend - left.resourceSpend || right.averageEapm - left.averageEapm)[0] ?? null;
  const retryLineup = [...lineups].filter((lineup) => lineup.games >= 2 && lineup.losses > 0).sort((left, right) => right.wins - left.wins || right.winRate - left.winRate)[0] ?? null;
  const coinflipDuo = [...duos].filter((duo) => duo.games >= 2 && duo.winRate >= 45 && duo.winRate <= 60).sort((left, right) => right.games - left.games || right.winRate - left.winRate)[0] ?? null;

  const cards = [
    bestLineup
      ? makeInsightCard({
        id: "best-lineup",
        label: "BEST 조합",
        title: `최고 조합 꿀조합 인증: ${lineupLabel(bestLineup)}`,
        body: `${bestLineup.wins}-${bestLineup.losses}, 승률 ${formatPercentValue(bestLineup.winRate)}입니다. 이 조합은 일단 꺼내면 분위기가 “오늘 좀 된다” 쪽으로 기웁니다.`,
        tone: "emerald"
      })
      : null,
    worstLineup
      ? makeInsightCard({
        id: "worst-lineup",
        label: "위험 조합",
        title: `최악 조합 비상벨: ${lineupLabel(worstLineup)}`,
        body: `${worstLineup.wins}-${worstLineup.losses}, 승률 ${formatPercentValue(worstLineup.winRate)}입니다. 이 조합은 한 번 더 만나면 작전회의부터 열고 가는 편이 좋습니다.`,
        tone: "rose"
      })
      : null,
    bestDuo
      ? makeInsightCard({
        id: "best-duo",
        label: "듀오 케미",
        title: `최강 듀오 특급 케미: ${displayLineupName(bestDuo.players)}`,
        body: `함께 뛴 경기 기준 ${bestDuo.wins}-${bestDuo.losses}, 승률 ${formatPercentValue(bestDuo.winRate)}입니다. 한 자리를 바꿔도 이 둘은 붙여두면 팀 온도가 올라갑니다.`,
        tone: "cyan"
      })
      : null,
    randomReadyPlayer
      ? makeInsightCard({
        id: "random-ready",
        label: "랜덤 에이스",
        title: `랜덤 적응 주사위 에이스: ${displayPlayerName(randomReadyPlayer.name)}`,
        body: `실제 랜덤 선택 ${randomReadyPlayer.randomSelectedGames}경기에서 ${randomReadyPlayer.randomSelectedWins}승, 승률 ${formatPercentValue(randomReadyPlayer.randomSelectedWinRate)}입니다. 랜덤 축은 종족 편차가 아니라 실제 랜덤 선택 표본으로 봅니다.`,
        tone: "violet"
      })
      : null,
    randomRiskPlayer
      ? makeInsightCard({
        id: "random-risk",
        label: "랜덤 주의",
        title: `랜덤 리스크 주의보: ${displayPlayerName(randomRiskPlayer.name)}`,
        body: `실제 랜덤 선택 ${randomRiskPlayer.randomSelectedGames}경기에서 ${randomRiskPlayer.randomSelectedWins}승, 승률 ${formatPercentValue(randomRiskPlayer.randomSelectedWinRate)}입니다. 랜덤 선택 표본 기준으로 보완이 필요한 선수입니다.`,
        tone: "amber"
      })
      : null,
    bestRace
      ? makeInsightCard({
        id: "race-comp",
        label: "종족 체급",
        title: `종족 조합 체급: ${bestRace.composition}`,
        body: `${bestRace.note}에서 ${bestRace.wins}-${bestRace.losses}, 승률 ${formatPercentValue(bestRace.winRate)}입니다. 표본 기준을 통과한 조합만 “최강” 후보로 보고, 부족한 조합은 참고 기록으로만 둡니다.`,
        tone: bestRace.qualified ? "emerald" : "amber"
      })
      : null,
    productionLeader
      ? makeInsightCard({
        id: "tempo-leader",
        label: "생산 리듬",
        title: `유닛 생산 리듬왕: ${displayPlayerName(productionLeader.name)}`,
        body: `평균 유닛 생산량 ${productionLeader.unitProduction}입니다. build order 기반 생산 이벤트를 집계한 값이라 실제 병력 충원 리듬에 가깝습니다.`,
        tone: "cyan"
      })
      : null,
    resourceLeader
      ? makeInsightCard({
        id: "production-leader",
        label: "자원 소모",
        title: `자원 회전력 상위권: ${displayPlayerName(resourceLeader.name)}`,
        body: `평균 자원 소모량 ${resourceLeader.resourceSpend}입니다. build order 비용표 기반 합산값이라 돈을 얼마나 꾸준히 굴렸는지 보는 보조 지표입니다.`,
        tone: "violet"
      })
      : null,
    retryLineup
      ? makeInsightCard({
        id: "retry-lineup",
        label: "재등판 후보",
        title: `져도 다시 볼 조합: ${lineupLabel(retryLineup)}`,
        body: `${retryLineup.games}경기 중 ${retryLineup.wins}승입니다. 완벽하진 않아도 표본이 쌓이면 해볼 만한 냄새가 납니다.`,
        tone: "amber"
      })
      : null,
    coinflipDuo
      ? makeInsightCard({
        id: "coinflip-duo",
        label: "반반 듀오",
        title: `동전 던지기 듀오: ${displayLineupName(coinflipDuo.players)}`,
        body: `${coinflipDuo.games}경기 ${formatPercentValue(coinflipDuo.winRate)} 승률입니다. 조합 자체보다 세 번째 자리에 누가 오느냐가 판을 흔들 가능성이 큽니다.`,
        tone: "rose"
      })
      : null
  ].filter((card): card is TeamAnalysisInsightCard => card != null);

  return {
    bestLineup: cards.find((card) => card.id === "best-lineup") ?? null,
    worstLineup: cards.find((card) => card.id === "worst-lineup") ?? null,
    bestDuo: cards.find((card) => card.id === "best-duo") ?? null,
    randomReadyPlayer: cards.find((card) => card.id === "random-ready") ?? null,
    randomRiskPlayer: cards.find((card) => card.id === "random-risk") ?? null,
    cards,
    duos: duos.map((duo) => ({
      ...duo,
      players: displayPlayerNames(duo.players)
    }))
  };
}

export function createTeamAnalysisPageModel({ gamesResponse }: { gamesResponse?: ApiGamesListResponse | null } = {}): TeamAnalysisPageModel {
  const matches = getMatches(gamesResponse);
  const players = buildPlayers(matches);
  const lineups = buildLineups(matches);
  const raceCompositions = buildRaceCompositions(matches);
  const singleRaceRecords = buildSingleRaceRecords(matches);
  const duos = buildDuos(matches);
  const insights = buildInsights(players, lineups, raceCompositions, duos);
  const displayPlayers = players.map((player) => ({
    ...player,
    name: displayPlayerName(player.name),
    bestPartners: displayPlayerNames(player.bestPartners)
  }));
  const displayLineups = lineups.map((lineup) => ({
    ...lineup,
    players: displayPlayerNames(lineup.players)
  }));
  const topPlayer = displayPlayers[0]?.name ?? "NO_DATA";
  const topLineup = displayLineups[0]?.players.join(" + ") ?? "NO_DATA";
  const strongestComposition = raceCompositions.find((composition) => composition.qualified)?.composition ?? "표본 부족";
  const currentLineupScore = buildCurrentLineupScore(displayLineups);
  const weakestRace = buildWeakestRaceSummary(singleRaceRecords);

  return {
    summary: {
      gamesAnalyzed: matches.length,
      playersTracked: players.length,
      lineupsTracked: lineups.length,
      topPlayer,
      topLineup,
      strongestComposition,
      currentLineupScore,
      weakestRace
    },
    players: displayPlayers,
    lineups: displayLineups,
    raceCompositions,
    recentMatches: buildRecentMatches(matches),
    insights,
    chartData: {
      ratingComparison: displayPlayers.map((player) => ({
        name: player.name,
        bradleyTerry: player.bradleyTerry,
        trueSkill: player.trueSkill,
        bradleyTerryRank: player.bradleyTerryRank,
        trueSkillRank: player.trueSkillRank,
        winRate: player.winRate,
        averageApm: player.averageApm
      })),
      raceComposition: raceCompositions.map((composition) => ({
        composition: composition.composition,
        winRate: composition.winRate,
        games: composition.games
      })),
      apmLeaderboard: [...players]
        .sort((left, right) => left.apmRank - right.apmRank)
        .map((player) => ({
          name: displayPlayerName(player.name),
          averageApm: player.averageApm,
          winRate: player.winRate
        })),
      playerPentagons: buildPlayerPentagons(displayPlayers)
    }
  };
}
