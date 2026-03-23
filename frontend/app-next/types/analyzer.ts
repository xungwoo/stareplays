import type { MatchStatus, RaceCode } from "@/types/common";
import type { VaultGame, VaultPlayer } from "@/types/vault";

export interface TimelineEvent {
  time: string;
  event: string;
  player: string;
  type: "BUILDING" | "UPGRADE" | "UNIT";
  team: "WINNER" | "LOSER";
}

export interface TeamComparison {
  kills: { loser: number; winner: number };
  workerPeak: { loser: number; winner: number };
  totalSpend: { loser: number; winner: number };
  techUpg: { loser: number; winner: number };
}

export interface SeriesPoint {
  time: number;
  winner: number;
  loser: number;
}

export interface AnalyzerApmPoint {
  time: number;
  [playerName: string]: number;
}

export interface AnalyzerGameInsight {
  players: VaultPlayer[];
  timeline: TimelineEvent[];
  comparison: TeamComparison;
  apmSeries: AnalyzerApmPoint[];
  resourceSeries: SeriesPoint[];
  unitProductionSeries: SeriesPoint[];
  keyPlayer?: string;
  worstPlayer?: string;
}

export interface AnalyzerPageModel {
  currentUser: string;
  selectedGameId?: number;
  games: VaultGame[];
  selectedGame: VaultGame;
  players: VaultPlayer[];
  tabs: Array<{
    id: "match_flow" | "apm" | "resource" | "unit_prod" | "tech";
    label: string;
  }>;
  timeline: TimelineEvent[];
  comparison: TeamComparison;
  apmSeries: AnalyzerApmPoint[];
  resourceSeries: SeriesPoint[];
  unitProductionSeries: SeriesPoint[];
  insightsByGameId: Record<number, AnalyzerGameInsight>;
}
