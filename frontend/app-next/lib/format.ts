export function fmtDate(value: string | undefined): string {
  if (!value) {
    return "-";
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value;
  }

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");

  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

export function fmtGameTime(totalSeconds: number | undefined): string {
  const s = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function raceLetter(race: string | undefined): "T" | "Z" | "P" | "U" {
  const r = String(race || "").toLowerCase();
  if (r.startsWith("terran")) return "T";
  if (r.startsWith("zerg")) return "Z";
  if (r.startsWith("protoss")) return "P";
  return "U";
}

export function percent(value: number | undefined, fixed = 1): string {
  return `${Number(value || 0).toFixed(fixed)}%`;
}

export function safeNum(value: number | undefined, fixed = 1): string {
  return Number(value || 0).toFixed(fixed);
}

export function reliability(uploadCount: number | undefined, playerCount: number | undefined): string {
  const up = Number(uploadCount || 0);
  const p = Number(playerCount || 0);
  if (p <= 0) return "0%";
  return `${Math.round((up / p) * 100)}%`;
}
