import type { RaceCode } from "@/types/common";

export const raceStyles: Record<RaceCode, { backgroundColor: string; color: string; border: string }> = {
  P: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    color: "#fcd34d",
    border: "1px solid rgba(245, 158, 11, 0.4)"
  },
  T: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    color: "#93c5fd",
    border: "1px solid rgba(59, 130, 246, 0.4)"
  },
  Z: {
    backgroundColor: "rgba(168, 85, 247, 0.2)",
    color: "#d8b4fe",
    border: "1px solid rgba(168, 85, 247, 0.4)"
  }
};

export function RaceBadge({ race, size = "sm", randomSelected = false }: { race: RaceCode; size?: "sm" | "md"; randomSelected?: boolean }) {
  const sizeClass = size === "md" ? "w-6 h-6 text-xs" : "w-5 h-5 text-[10px]";
  const label = randomSelected ? `R${race}` : race;
  const textClass = randomSelected ? "text-[9px]" : "";

  return (
    <span className={`inline-flex items-center justify-center rounded font-bold font-mono ${sizeClass} ${textClass}`} style={raceStyles[race]}>
      {label}
    </span>
  );
}

export function RaceGroup({ races }: { races: RaceCode[] }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {races.map((race, index) => (
        <RaceBadge key={`${race}-${index}`} race={race} />
      ))}
    </span>
  );
}

export function RaceCompositionBadges({ composition, size = "sm" }: { composition: string; size?: "sm" | "md" }) {
  const races = composition
    .split("")
    .filter((race): race is RaceCode => race === "P" || race === "T" || race === "Z");

  if (races.length === 0) {
    return <span className="text-xs font-semibold text-slate-500">NO_DATA</span>;
  }

  return (
    <span className="inline-flex items-center gap-0.5" aria-label={composition}>
      {races.map((race, index) => (
        <RaceBadge key={`${race}-${index}`} race={race} size={size} />
      ))}
    </span>
  );
}
