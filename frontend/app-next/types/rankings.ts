import type { MetricItem, RaceCode } from "@/types/common";

export interface RankingRow {
  rank: number;
  user: string;
  winRate: number;
  wins: number;
  losses: number;
  draws: number;
  games: number;
  avgApm: number;
  avgEapm: number;
  isCurrentUser?: boolean;
  favoriteRace: RaceCode;
}

export interface RaceCompositionRow {
  teamA: RaceCode[];
  teamB: RaceCode[];
  games: number;
  teamAWinPct: number;
  teamBWinPct: number;
  teamAWins: number;
  teamBWins: number;
}

export interface RaceRankingRow {
  race: RaceCode | "R";
  rank: number;
  user: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  avgApm: number;
}

export interface RankingsPageModel {
  currentUser: string;
  tabs: Array<{
    id: "rankings" | "race_rankings" | "race_comp";
    label: string;
  }>;
  summary: MetricItem[];
  rankings: RankingRow[];
  raceRankings: RaceRankingRow[];
  raceCompositions: RaceCompositionRow[];
}
