"use client";

import { HelpCircle } from "lucide-react";

export function MetricHelp({ label, description }: { label: string; description: string }) {
  return (
    <span
      role="img"
      aria-label={`${label}: ${description}`}
      title={description}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-600/80 bg-slate-950/50 text-slate-400"
    >
      <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  );
}
