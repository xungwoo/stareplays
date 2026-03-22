import type { CSSProperties } from "react";

export function ErrorState({
  title,
  description,
  className,
  style
}: {
  title: string;
  description: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`panel-alt flex min-h-32 flex-col items-center justify-center px-6 py-8 text-center ${className ?? ""}`.trim()}
      style={style}
    >
      <h3 className="text-sm font-mono font-bold uppercase tracking-[0.16em] text-red">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-slate-400">{description}</p>
    </div>
  );
}
