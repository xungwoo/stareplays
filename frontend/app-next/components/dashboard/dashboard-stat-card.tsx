import { Panel } from "@/components/shared/panel";

export function DashboardStatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Panel variant="innerStrong" className="flex flex-col gap-1 rounded-lg p-3">
      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{label}</span>
      <span className="font-mono text-lg font-bold" style={{ color: "#22d3ee" }}>
        {value}
      </span>
      {sub ? <span className="font-mono text-xs text-slate-500">{sub}</span> : null}
    </Panel>
  );
}
