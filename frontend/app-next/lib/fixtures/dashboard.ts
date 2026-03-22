import type { DashboardPageModel } from "@/types/dashboard";
import { CURRENT_USER } from "@/lib/fixtures/common";

export const DASHBOARD_FIXTURE: DashboardPageModel = {
  currentUser: CURRENT_USER,
  uploadPlaceholder: "SELECT_PLAYER_FROM_PARSED_REPLAY",
  quickTips: [
    "리플레이 파일(.rep)을 업로드하세요",
    "Replay Vault에서 게임 목록을 확인하세요",
    "Game Analyzer로 상세 분석을 확인하세요",
    "Rankings에서 개인 통계를 확인하세요"
  ],
  hero: {
    eyebrow: "StaReplays Dashboard",
    title: "StarCraft Replay Intelligence",
    description:
      "업로드, 리플레이 보관, 경기 분석, 랭킹 탐색까지 하나의 전장형 워크스페이스에서 이어집니다."
  },
  quickLinks: [
    {
      href: "/vault",
      label: "Replay Vault",
      description: "최근 경기와 상세 확장 패널을 확인합니다."
    },
    {
      href: "/analyzer",
      label: "Game Analyzer",
      description: "한 경기의 흐름과 플레이어 수행 지표를 깊게 파고듭니다."
    },
    {
      href: "/rankings",
      label: "Rankings",
      description: "3v3 순위와 종족 조합 승률을 확인합니다."
    }
  ],
  metrics: [
    { label: "Tracked Games", value: "43", accent: "cyan", hint: "Qualified 3v3 snapshots" },
    { label: "Current User Win Rate", value: "55.8%", accent: "emerald", hint: "3x3_GG" },
    { label: "Peak Avg APM", value: "214.7", accent: "amber", hint: "3x3_smwoo" },
    { label: "Analyzer Coverage", value: "92%", accent: "violet", hint: "DONE + PENDING" }
  ],
  uploadCandidates: ["3x3_GG", "3x3_mh", "3x3_smwoo", "3x3_Kiyong", "3x3_pil", "3x3_syntax"],
  playerStats: {
    name: "3x3_GG",
    favoriteRace: "P",
    favoriteRaceLabel: "PROTOSS",
    winRate: 55.8,
    games: 43,
    wins: 24,
    losses: 19,
    draws: 0,
    avgApm: 153,
    avgEapm: 133.1,
    raceStats: [
      { label: "Protoss", record: "22-17", winRate: 56.4 },
      { label: "Terran", record: "2-0", winRate: 100 },
      { label: "Zerg", record: "0-2", winRate: 0 }
    ],
    matchupStats: [
      { label: "vs Protoss", record: "55-43", winRate: 56.1 },
      { label: "vs Zerg", record: "14-10", winRate: 58.3 },
      { label: "vs Terran", record: "3-4", winRate: 42.9 }
    ],
    mapStats: [
      { label: "OP3060 CLAN 6슈빨무", record: "17-13", winRate: 56.7 },
      { label: "New Super 빠른무한", record: "7-6", winRate: 53.8 }
    ]
  }
};
