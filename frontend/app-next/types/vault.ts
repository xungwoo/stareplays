import type { MatchStatus, RaceCode } from "@/types/common";

export interface VaultPlayer {
  name: string;
  race: RaceCode;
  apm: number;
  eapm: number;
  cmd: number;
  ecmd: number;
  effective: number;
  redundancy: number;
  production: number;
  isCurrentUser?: boolean;
  startLocationX?: number;
  startLocationY?: number;
}

export interface VaultGame {
  id: number;
  map: string;
  matchup: string;
  winnerTeam: VaultPlayer[];
  loserTeam: VaultPlayer[];
  analyzerStatus: MatchStatus;
  playTime: string;
  startTime: string;
  matchStory: string;
  keyPlayer?: string;
  worstPlayer?: string;
}

export interface VaultPageModel {
  currentUser: string;
  games: VaultGame[];
}
