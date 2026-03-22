import type { VaultGame, VaultPlayer } from "@/types/vault";

export interface StartGridEntry {
  player: VaultPlayer;
  result: "WINNER" | "LOSER";
}

export interface StartGridBoard {
  leftColumn: StartGridEntry[];
  rightColumn: StartGridEntry[];
}

function hasStartLocation(player: VaultPlayer): boolean {
  return Number.isFinite(player.startLocationX) && Number.isFinite(player.startLocationY);
}

function sortByYThenX(left: StartGridEntry, right: StartGridEntry): number {
  return (
    Number(left.player.startLocationY ?? 0) - Number(right.player.startLocationY ?? 0) ||
    Number(left.player.startLocationX ?? 0) - Number(right.player.startLocationX ?? 0)
  );
}

export function getStartGridBoard(game: VaultGame): StartGridBoard {
  const players: StartGridEntry[] = [
    ...game.winnerTeam.map((player) => ({ player, result: "WINNER" as const })),
    ...game.loserTeam.map((player) => ({ player, result: "LOSER" as const }))
  ];

  if (!players.every((entry) => hasStartLocation(entry.player))) {
    const midpoint = Math.ceil(players.length / 2);
    return {
      leftColumn: players.slice(0, midpoint),
      rightColumn: players.slice(midpoint)
    };
  }

  const sortedByX = players.slice().sort((left, right) => {
    return (
      Number(left.player.startLocationX ?? 0) - Number(right.player.startLocationX ?? 0) ||
      Number(left.player.startLocationY ?? 0) - Number(right.player.startLocationY ?? 0)
    );
  });

  const midpoint = Math.ceil(sortedByX.length / 2);
  return {
    leftColumn: sortedByX.slice(0, midpoint).sort(sortByYThenX),
    rightColumn: sortedByX.slice(midpoint).sort(sortByYThenX)
  };
}
