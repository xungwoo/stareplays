import type { CSSProperties } from "react";

export function LoadingState({
  title = "Loading data...",
  className,
  style
}: {
  title?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`panel-alt flex min-h-32 items-center justify-center px-6 py-8 ${className ?? ""}`.trim()}
      style={style}
    >
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 animate-pulse rounded-full bg-cyan" aria-hidden="true" />
        <span className="text-sm font-mono uppercase tracking-[0.16em] text-slate-300">{title}</span>
      </div>
    </div>
  );
}
