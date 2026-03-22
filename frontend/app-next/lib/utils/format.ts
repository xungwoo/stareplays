import type { RaceCode } from "@/types/common";

export function getRaceLetter(value: string): RaceCode {
  const normalized = value.trim().toLowerCase();

  if (normalized.startsWith("p")) return "P";
  if (normalized.startsWith("t")) return "T";
  if (normalized.startsWith("z")) return "Z";

  return "P";
}

export function formatGameTime(secondsOrTime: number | string): string {
  if (typeof secondsOrTime === "string" && /^\d{2}:\d{2}$/.test(secondsOrTime)) {
    return secondsOrTime;
  }

  const totalSeconds = typeof secondsOrTime === "number" ? secondsOrTime : Number(secondsOrTime);
  const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatStartTime(value: string): string {
  return value.replace("T", " ");
}
