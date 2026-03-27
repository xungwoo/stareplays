import { Panel } from "@/components/shared/panel";

export type DashboardStatsTableRow = {
  label: string;
  record: string;
  winRate: number;
};

export function DashboardStatsTable({
  title,
  leadingLabel,
  rows
}: {
  title: string;
  leadingLabel: string;
  rows: DashboardStatsTableRow[];
}) {
  return (
    <Panel as="section" variant="cyan" className="rounded-xl p-5">
      <p className="mb-3 text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-500">{title}</p>
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-[10px] text-slate-600">
            <th className="pb-2 text-left">{leadingLabel}</th>
            <th className="pb-2 text-right">W-L</th>
            <th className="pb-2 text-right">WIN%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((row) => (
            <tr key={row.label} className="hover:bg-slate-800/40">
              <td className="py-2 text-slate-300">{row.label}</td>
              <td className="py-2 text-right text-slate-400">{row.record}</td>
              <td className="py-2 text-right" style={{ color: row.winRate >= 50 ? "#34d399" : "#f87171" }}>
                {row.winRate.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
