const KNOWN_PLAYER_COLORS: Record<string, string> = {
  "3x3_GG": "#22d3ee",
  "3x3_mh": "#f59e0b",
  "3x3_smwoo": "#34d399",
  "3x3_Kiyong": "#f87171",
  "3x3_pil": "#a78bfa",
  "3x3_syntax": "#fb923c",
  "성우": "#22d3ee",
  "민혁": "#f59e0b",
  "성민": "#34d399",
  "기용": "#f87171",
  "필균": "#a78bfa",
  "명진": "#fb923c"
};

const FALLBACK_PLAYER_PALETTE = [
  "#22d3ee",
  "#f59e0b",
  "#34d399",
  "#f87171",
  "#a78bfa",
  "#fb923c",
  "#60a5fa",
  "#f472b6",
  "#2dd4bf",
  "#eab308"
];

function hashPlayerName(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getPlayerColor(name: string | undefined): string {
  const normalized = name?.trim();
  if (!normalized) {
    return "#94a3b8";
  }

  const known = KNOWN_PLAYER_COLORS[normalized];
  if (known) {
    return known;
  }

  return FALLBACK_PLAYER_PALETTE[hashPlayerName(normalized) % FALLBACK_PLAYER_PALETTE.length];
}

export function getPlayerChipStyle(name: string | undefined) {
  const color = getPlayerColor(name);

  return {
    color,
    backgroundColor: `${color}1f`,
    borderColor: `${color}66`
  };
}
