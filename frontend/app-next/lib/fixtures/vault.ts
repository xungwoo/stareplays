import { CURRENT_USER } from "@/lib/fixtures/common";
import type { VaultGame } from "@/types/vault";

export const VAULT_GAMES_FIXTURE: VaultGame[] = [
  {
    id: 48,
    map: "OP3060 CLAN 6슈빨무",
    matchup: "3v3",
    winnerTeam: [
      { name: "3x3_GG", race: "P", apm: 148, eapm: 126, cmd: 2050, ecmd: 1746, effective: 85.2, redundancy: 15, production: 203, isCurrentUser: true, startLocationX: 4000, startLocationY: 100 },
      { name: "3x3_mh", race: "P", apm: 148, eapm: 136, cmd: 2054, ecmd: 1884, effective: 91.7, redundancy: 8, production: 200, startLocationX: 100, startLocationY: 900 },
      { name: "3x3_smwoo", race: "P", apm: 182, eapm: 161, cmd: 2500, ecmd: 2208, effective: 88.3, redundancy: 12, production: 211, startLocationX: 4000, startLocationY: 500 }
    ],
    loserTeam: [
      { name: "3x3_Kiyong", race: "P", apm: 171, eapm: 161, cmd: 2354, ecmd: 2216, effective: 94.1, redundancy: 6, production: 176, startLocationX: 100, startLocationY: 100 },
      { name: "3x3_pil", race: "Z", apm: 145, eapm: 121, cmd: 2015, ecmd: 1671, effective: 82.9, redundancy: 17, production: 194, startLocationX: 4000, startLocationY: 900 },
      { name: "3x3_syntax", race: "P", apm: 142, eapm: 120, cmd: 1965, ecmd: 1666, effective: 84.8, redundancy: 15, production: 153, startLocationX: 100, startLocationY: 500 }
    ],
    analyzerStatus: "DONE",
    playTime: "13:55",
    startTime: "2026-03-22 00:05:48",
    matchStory:
      "Loser side가 교전 교환비에서 앞섰다. Winner side가 더 많은 자원을 전장과 테크에 투입했다. 3x3_syntax가 시야 장악과 운영 지표에서 가장 눈에 띄었다.",
    keyPlayer: "3x3_syntax",
    worstPlayer: "3x3_pil"
  },
  {
    id: 47,
    map: "OP3060 CLAN 6슈빨무",
    matchup: "3v3",
    winnerTeam: [
      { name: "3x3_GG", race: "P", apm: 138, eapm: 122, cmd: 1900, ecmd: 1680, effective: 88.4, redundancy: 12, production: 195, isCurrentUser: true, startLocationX: 4000, startLocationY: 100 },
      { name: "3x3_smwoo", race: "P", apm: 166, eapm: 148, cmd: 2280, ecmd: 2034, effective: 89.2, redundancy: 11, production: 218, startLocationX: 4000, startLocationY: 500 },
      { name: "3x3_mh", race: "T", apm: 163, eapm: 152, cmd: 2241, ecmd: 2088, effective: 93.2, redundancy: 7, production: 225, startLocationX: 100, startLocationY: 900 }
    ],
    loserTeam: [
      { name: "3x3_Kiyong", race: "P", apm: 157, eapm: 149, cmd: 2156, ecmd: 2046, effective: 94.9, redundancy: 5, production: 181, startLocationX: 100, startLocationY: 100 },
      { name: "3x3_pil", race: "Z", apm: 131, eapm: 118, cmd: 1800, ecmd: 1621, effective: 90.1, redundancy: 10, production: 177, startLocationX: 4000, startLocationY: 900 },
      { name: "3x3_syntax", race: "P", apm: 141, eapm: 121, cmd: 1937, ecmd: 1662, effective: 85.8, redundancy: 14, production: 160, startLocationX: 100, startLocationY: 500 }
    ],
    analyzerStatus: "DONE",
    playTime: "18:47",
    startTime: "2026-03-21 23:45:50",
    matchStory: "Winner side가 초반 경제 선점에 성공했다. 3x3_mh의 테란 운영이 팀 승리에 핵심적인 역할을 했다.",
    keyPlayer: "3x3_mh",
    worstPlayer: "3x3_pil"
  },
  {
    id: 50,
    map: "OP3060 CLAN 6슈빨무",
    matchup: "3v3",
    winnerTeam: [
      { name: "3x3_syntax", race: "P", apm: 141, eapm: 126, cmd: 1938, ecmd: 1731, effective: 89.3, redundancy: 11, production: 162, startLocationX: 100, startLocationY: 500 },
      { name: "3x3_Kiyong", race: "P", apm: 178, eapm: 170, cmd: 2447, ecmd: 2336, effective: 95.5, redundancy: 5, production: 188, startLocationX: 100, startLocationY: 100 },
      { name: "3x3_pil", race: "T", apm: 170, eapm: 155, cmd: 2336, ecmd: 2129, effective: 91.2, redundancy: 9, production: 212, startLocationX: 4000, startLocationY: 900 }
    ],
    loserTeam: [
      { name: "3x3_smwoo", race: "P", apm: 186, eapm: 165, cmd: 2556, ecmd: 2267, effective: 88.7, redundancy: 11, production: 224, startLocationX: 4000, startLocationY: 500 },
      { name: "3x3_mh", race: "Z", apm: 167, eapm: 150, cmd: 2295, ecmd: 2061, effective: 89.8, redundancy: 10, production: 199, startLocationX: 100, startLocationY: 900 },
      { name: CURRENT_USER, race: "P", apm: 122, eapm: 100, cmd: 1676, ecmd: 1374, effective: 81.9, redundancy: 18, production: 178, isCurrentUser: true, startLocationX: 4000, startLocationY: 100 }
    ],
    analyzerStatus: "DONE",
    playTime: "15:55",
    startTime: "2026-03-21 23:28:41",
    matchStory: "Winner side가 모든 교전에서 우세를 점했다. 3x3_Kiyong이 가장 높은 효율로 게임을 지배했다.",
    keyPlayer: "3x3_Kiyong",
    worstPlayer: "3x3_GG"
  },
  {
    id: 42,
    map: "OP3060 CLAN 6슈빨무",
    matchup: "3v3",
    winnerTeam: [
      { name: "3x3_Kiyong", race: "P", apm: 357, eapm: 357, cmd: 4907, ecmd: 4907, effective: 100, redundancy: 0, production: 0, startLocationX: 100, startLocationY: 100 },
      { name: "3x3_syntax", race: "P", apm: 0, eapm: 0, cmd: 0, ecmd: 0, effective: 0, redundancy: 0, production: 0, startLocationX: 100, startLocationY: 500 },
      { name: "3x3_pil", race: "P", apm: 0, eapm: 0, cmd: 0, ecmd: 0, effective: 0, redundancy: 0, production: 0, startLocationX: 4000, startLocationY: 900 }
    ],
    loserTeam: [
      { name: "3x3_mh", race: "P", apm: 0, eapm: 0, cmd: 0, ecmd: 0, effective: 0, redundancy: 0, production: 0, startLocationX: 100, startLocationY: 900 },
      { name: "3x3_smwoo", race: "P", apm: 0, eapm: 0, cmd: 0, ecmd: 0, effective: 0, redundancy: 0, production: 0, startLocationX: 4000, startLocationY: 500 },
      { name: CURRENT_USER, race: "P", apm: 0, eapm: 0, cmd: 0, ecmd: 0, effective: 0, redundancy: 0, production: 0, isCurrentUser: true, startLocationX: 4000, startLocationY: 100 }
    ],
    analyzerStatus: "INVALID",
    playTime: "00:01",
    startTime: "2026-03-14 00:41:15",
    matchStory: "비정상 게임 - 분석 불가"
  }
];
