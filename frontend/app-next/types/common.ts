export type RaceCode = "P" | "T" | "Z";
export type MatchStatus = "DONE" | "PENDING" | "INVALID";
export type AccentTone = "cyan" | "blue" | "emerald" | "amber" | "red" | "violet";

export interface QuickLink {
  href: string;
  label: string;
  description: string;
}

export interface MetricItem {
  label: string;
  value: string;
  accent: AccentTone;
  hint?: string;
}
