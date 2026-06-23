const PLAYER_DISPLAY_NAMES: Record<string, string> = {
  "3x3_mh": "민혁",
  "3x3_smwoo": "성민",
  "3x3_Kiyong": "기용",
  "3x3_syntax": "명진",
  "3x3_pil": "필균",
  "3x3_GG": "성우"
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

const NORMALIZED_DISPLAY_NAMES = new Map(
  Object.entries(PLAYER_DISPLAY_NAMES).map(([rawName, displayName]) => [normalizeName(rawName), displayName])
);

export function displayPlayerName(name: string): string {
  const trimmed = name.trim();

  return NORMALIZED_DISPLAY_NAMES.get(normalizeName(trimmed)) ?? trimmed;
}

export function displayPlayerNames(names: string[]): string[] {
  return names.map(displayPlayerName);
}

export function displayLineupName(names: string[]): string {
  return displayPlayerNames(names).join(" + ");
}
