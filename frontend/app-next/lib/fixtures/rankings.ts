import type { RankingRow, RaceCompositionRow } from "@/types/rankings";

export const RANKINGS_FIXTURE: RankingRow[] = [
  { rank: 1, user: "3x3_GG", winRate: 55.8, wins: 24, losses: 19, draws: 0, games: 43, avgApm: 171, avgEapm: 151.7, isCurrentUser: true, favoriteRace: "P" },
  { rank: 2, user: "3x3_smwoo", winRate: 55.8, wins: 24, losses: 19, draws: 0, games: 43, avgApm: 214.7, avgEapm: 181.7, favoriteRace: "P" },
  { rank: 3, user: "3x3_mh", winRate: 51.2, wins: 22, losses: 21, draws: 0, games: 43, avgApm: 186.4, avgEapm: 156, favoriteRace: "P" },
  { rank: 4, user: "3x3_pil", winRate: 48.8, wins: 21, losses: 22, draws: 0, games: 43, avgApm: 187.9, avgEapm: 176, favoriteRace: "Z" },
  { rank: 5, user: "3x3_Kiyong", winRate: 44.2, wins: 19, losses: 24, draws: 0, games: 43, avgApm: 191, avgEapm: 181.6, favoriteRace: "P" },
  { rank: 6, user: "3x3_syntax", winRate: 44.2, wins: 19, losses: 24, draws: 0, games: 43, avgApm: 161.8, avgEapm: 128.8, favoriteRace: "P" }
];

export const RACE_COMPOSITIONS_FIXTURE: RaceCompositionRow[] = [
  { teamA: ["P", "P", "T"], teamB: ["P", "P", "Z"], games: 14, teamAWinPct: 71.4, teamBWinPct: 28.6, teamAWins: 10, teamBWins: 4 },
  { teamA: ["P", "P", "P"], teamB: ["P", "P", "T"], games: 7, teamAWinPct: 71.4, teamBWinPct: 28.6, teamAWins: 5, teamBWins: 2 },
  { teamA: ["P", "P", "P"], teamB: ["P", "P", "Z"], games: 6, teamAWinPct: 33.3, teamBWinPct: 66.7, teamAWins: 2, teamBWins: 4 },
  { teamA: ["P", "P", "T"], teamB: ["P", "P", "T"], games: 5, teamAWinPct: 60, teamBWinPct: 40, teamAWins: 3, teamBWins: 2 },
  { teamA: ["P", "P", "P"], teamB: ["P", "P", "P"], games: 3, teamAWinPct: 33.3, teamBWinPct: 66.7, teamAWins: 1, teamBWins: 2 }
];
