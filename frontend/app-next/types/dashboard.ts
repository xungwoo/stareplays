import type { MetricItem, QuickLink, RaceCode } from "@/types/common";

export interface DashboardStatRow {
  label: string;
  record: string;
  winRate: number;
}

export type DashboardActionStatus = "idle" | "submitting" | "success" | "error";

export interface DashboardPreviewSummary {
  totalFiles: number;
  successCount: number;
  failedCount: number;
  commonPlayers: string[];
  items: Array<{
    filename: string;
    ok: boolean;
    mapName: string;
    startTime: string;
    playerCount: number;
    parsedPlayers: string[];
    error: string | null;
  }>;
}

export interface DashboardUploadSummary {
  uploadedGameId: number | null;
  uploadedMapName: string | null;
  vaultHref: string;
  analyzerHref: string;
}

export interface DashboardPlayerStats {
  name: string;
  favoriteRace: RaceCode;
  favoriteRaceLabel: string;
  winRate: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  avgApm: number;
  avgEapm: number;
  raceStats: DashboardStatRow[];
  matchupStats: DashboardStatRow[];
  mapStats: DashboardStatRow[];
}

export interface DashboardPageModel {
  currentUser: string;
  uploadPlaceholder: string;
  quickTips: string[];
  hero: {
    eyebrow: string;
    title: string;
    description: string;
  };
  quickLinks: QuickLink[];
  metrics: MetricItem[];
  uploadCandidates: string[];
  playerStats: DashboardPlayerStats;
}
