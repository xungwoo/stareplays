import type { AccentTone } from "@/types/common";

const accentClasses: Record<AccentTone, string> = {
  cyan: "text-cyan",
  blue: "text-blue",
  emerald: "text-emerald",
  amber: "text-amber",
  red: "text-red",
  violet: "text-violet"
};

interface MetricCardProps {
  label: string;
  value: string;
  accent: AccentTone;
  hint?: string;
}

export function MetricCard({ label, value, accent, hint }: MetricCardProps) {
  return (
    <div className="panel-alt p-4">
      <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-mono font-bold ${accentClasses[accent]}`}>{value}</p>
      {hint ? <p className="mt-2 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}
