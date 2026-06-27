import type { RaceCode } from "@/types/common";

export interface TeamAnalysisRaceStat {
  race: RaceCode;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  qualified: boolean;
}

export interface TeamAnalysisPlayer {
  name: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  randomSelectedGames: number;
  randomSelectedWins: number;
  randomSelectedWinRate: number;
  averageApm: number;
  averageEapm: number;
  commandEfficiency: number;
  effectiveCommandsPerMinute: number;
  handEfficiency: number;
  apmRank: number;
  bradleyTerry: number;
  bradleyTerryRank: number;
  trueSkill: number;
  trueSkillMu: number;
  trueSkillSigma: number;
  trueSkillRank: number;
  bestRace: RaceCode;
  worstRace: RaceCode;
  strength: string;
  weakness: string;
  trainingFeedback: string[];
  raceStats: TeamAnalysisRaceStat[];
  bestPartners: string[];
}

export interface TeamAnalysisLineup {
  players: string[];
  composition: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  averageApm: number;
}

export interface TeamAnalysisDuo {
  players: string[];
  games: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface TeamAnalysisInsightCard {
  id: string;
  label: string;
  title: string;
  body: string;
  tone: "cyan" | "violet" | "emerald" | "amber" | "rose";
}

export interface TeamAnalysisPlayerPentagon {
  title: string;
  description: string;
  axes: string[];
  players: Array<{
    name: string;
    tone: "cyan" | "violet" | "emerald" | "amber" | "rose";
    color: string;
    axes: Array<{
      label: string;
      value: number;
    }>;
  }>;
}

export interface TeamAnalysisRaceComposition {
  composition: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  qualified: boolean;
  note: string;
}

export interface TeamAnalysisRecentMatch {
  id: number;
  map: string;
  winner: string;
  loser: string;
  startTime: string;
}

export interface TeamAnalysisPageModel {
  summary: {
    gamesAnalyzed: number;
    playersTracked: number;
    lineupsTracked: number;
    topPlayer: string;
    topLineup: string;
    strongestComposition: string;
  };
  players: TeamAnalysisPlayer[];
  lineups: TeamAnalysisLineup[];
  raceCompositions: TeamAnalysisRaceComposition[];
  recentMatches: TeamAnalysisRecentMatch[];
  insights: {
    bestLineup: TeamAnalysisInsightCard | null;
    worstLineup: TeamAnalysisInsightCard | null;
    bestDuo: TeamAnalysisInsightCard | null;
    randomReadyPlayer: TeamAnalysisInsightCard | null;
    randomRiskPlayer: TeamAnalysisInsightCard | null;
    cards: TeamAnalysisInsightCard[];
    duos: TeamAnalysisDuo[];
  };
  chartData: {
    ratingComparison: Array<{
      name: string;
      bradleyTerry: number;
      trueSkill: number;
      bradleyTerryRank: number;
      trueSkillRank: number;
      bradleyTerryRankScore: number;
      trueSkillRankScore: number;
      winRate: number;
      averageApm: number;
    }>;
    raceComposition: Array<{
      composition: string;
      winRate: number;
      games: number;
    }>;
    apmLeaderboard: Array<{
      name: string;
      averageApm: number;
      winRate: number;
    }>;
    playerPentagons: TeamAnalysisPlayerPentagon[];
  };
}
