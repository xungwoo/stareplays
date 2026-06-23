import { getPlayerChipStyle } from "@/lib/utils/player-colors";

export function PlayerBadge({ name, compact = false }: { name: string; compact?: boolean }) {
  const style = getPlayerChipStyle(name);

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded border font-semibold ${compact ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs"}`}
      style={{
        color: style.color,
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor
      }}
      title={name}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: style.color }} />
      <span className="truncate">{name}</span>
    </span>
  );
}

export function PlayerBadgeGroup({ names, compact = false }: { names: string[]; compact?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {names.map((name) => (
        <PlayerBadge key={name} name={name} compact={compact} />
      ))}
    </span>
  );
}
