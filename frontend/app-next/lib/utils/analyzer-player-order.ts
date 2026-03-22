import type { VaultGame, VaultPlayer } from "@/types/vault";

export function getOrderedGamePlayers(game: VaultGame): VaultPlayer[] {
  return [...game.winnerTeam, ...game.loserTeam];
}
