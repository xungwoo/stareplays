import { INNER_PANEL_STRONG_STYLE } from "@/lib/constants/ui-styles";

export function DashboardStatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg p-3" style={INNER_PANEL_STRONG_STYLE}>
      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{label}</span>
      <span className="font-mono text-lg font-bold" style={{ color: "#22d3ee" }}>
        {value}
      </span>
      {sub ? <span className="font-mono text-xs text-slate-500">{sub}</span> : null}
    </div>
  );
}
