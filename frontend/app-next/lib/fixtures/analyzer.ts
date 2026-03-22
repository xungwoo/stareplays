import { CURRENT_USER } from "@/lib/fixtures/common";
import { VAULT_GAMES_FIXTURE } from "@/lib/fixtures/vault";
import type { AnalyzerApmPoint, SeriesPoint, TeamComparison, TimelineEvent } from "@/types/analyzer";

export const ANALYZER_TIMELINE_FIXTURE: TimelineEvent[] = [
  { time: "03:01", event: "Cybernetics Core", player: "3x3_GG", type: "BUILDING", team: "WINNER" },
  { time: "03:42", event: "Singularity Charge", player: "3x3_GG", type: "UPGRADE", team: "WINNER" },
  { time: "04:48", event: "Templar Archives", player: "3x3_mh", type: "BUILDING", team: "WINNER" },
  { time: "05:02", event: "Protoss Ground Armor", player: "3x3_Kiyong", type: "UPGRADE", team: "LOSER" },
  { time: "06:01", event: "Psionic Storm", player: "3x3_GG", type: "UPGRADE", team: "WINNER" },
  { time: "07:41", event: "Psionic Storm", player: "3x3_Kiyong", type: "UPGRADE", team: "LOSER" },
  { time: "08:22", event: "Psionic Storm", player: "3x3_mh", type: "UPGRADE", team: "WINNER" },
  { time: "09:11", event: "Psionic Storm", player: "3x3_syntax", type: "UPGRADE", team: "LOSER" }
];

export const ANALYZER_COMPARISON_FIXTURE: TeamComparison = {
  kills: { loser: 26, winner: 0 },
  workerPeak: { loser: 60, winner: 21 },
  totalSpend: { loser: 64100, winner: 86025 },
  techUpg: { loser: 19, winner: 28 }
};

const PLAYER_BASELINES: Record<string, number> = {
  "3x3_GG": 148,
  "3x3_mh": 148,
  "3x3_smwoo": 182,
  "3x3_Kiyong": 171,
  "3x3_pil": 145,
  "3x3_syntax": 142
};

export function generateApmSeries(minutes: number): AnalyzerApmPoint[] {
  const points: AnalyzerApmPoint[] = [];

  for (let time = 1; time <= minutes; time += 1) {
    const point: AnalyzerApmPoint = { time };
    Object.entries(PLAYER_BASELINES).forEach(([player, base]) => {
      point[player] = Math.max(60, Math.round(base + Math.sin(time * 0.8 + base * 0.05) * 40 + Math.cos(time * 1.3) * 25));
    });
    points.push(point);
  }

  return points;
}

function buildSeries(minutes: number, winnerBase: number, loserBase: number, winnerSlope: number, loserSlope: number): SeriesPoint[] {
  return Array.from({ length: minutes }, (_, index) => {
    const time = index + 1;

    return {
      time,
      winner: Math.max(0, Math.round(winnerBase + time * winnerSlope + Math.sin(time * 0.55) * (winnerSlope / 3))),
      loser: Math.max(0, Math.round(loserBase + time * loserSlope + Math.cos(time * 0.47) * (loserSlope / 3)))
    };
  });
}

export function generateResourceSeries(minutes: number): SeriesPoint[] {
  return buildSeries(minutes, 2000, 1800, 5800, 4700);
}

export function generateUnitProductionSeries(minutes: number): SeriesPoint[] {
  return buildSeries(minutes, 7, 5, 15, 11);
}

export function generateBattleSeries(minutes: number): SeriesPoint[] {
  return Array.from({ length: minutes }, (_, index) => {
    const time = index + 1;
    const peakAt = Math.round(minutes * 0.7);
    const distance = Math.abs(time - peakAt);

    return {
      time,
      winner: Math.max(0, Math.round(20 + (100 - distance * 8) + Math.sin(time * 1.1) * 20)),
      loser: Math.max(0, Math.round(25 + (90 - distance * 9) + Math.cos(time * 0.9) * 18))
    };
  });
}

export const ANALYZER_GAMES_FIXTURE = VAULT_GAMES_FIXTURE;
export const ANALYZER_DEFAULT_GAME_ID = 48;
export const ANALYZER_CURRENT_USER = CURRENT_USER;
