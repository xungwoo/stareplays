export function CurrentUserChip({ currentUser }: { currentUser: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono text-slate-600">CURRENT_USER</span>
      <div
        className="rounded px-3 py-1 text-xs font-mono font-bold tracking-wider"
        style={{ backgroundColor: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.25)" }}
      >
        {currentUser}
      </div>
    </div>
  );
}
