import type { MatchStatus } from "@/types/common";

const statusStyles: Record<MatchStatus, { backgroundColor: string; color: string; border: string }> = {
  DONE: {
    backgroundColor: "rgba(6, 182, 212, 0.2)",
    color: "#67e8f9",
    border: "1px solid rgba(6, 182, 212, 0.4)"
  },
  PENDING: {
    backgroundColor: "rgba(234, 179, 8, 0.2)",
    color: "#fde047",
    border: "1px solid rgba(234, 179, 8, 0.4)"
  },
  INVALID: {
    backgroundColor: "rgba(100, 116, 139, 0.2)",
    color: "#94a3b8",
    border: "1px solid rgba(100, 116, 139, 0.4)"
  }
};

const resultStyles: Record<"WINNER" | "LOSER", { backgroundColor: string; color: string; border: string }> = {
  WINNER: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    color: "#6ee7b7",
    border: "1px solid rgba(16, 185, 129, 0.4)"
  },
  LOSER: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    color: "#fca5a5",
    border: "1px solid rgba(239, 68, 68, 0.4)"
  }
};

export function StatusBadge({ status, size = "sm" }: { status: MatchStatus; size?: "sm" | "md" }) {
  const sizeClass = size === "md" ? "px-2 py-0.5" : "px-2 py-0.5";

  return (
    <span className={`inline-flex items-center ${sizeClass} rounded text-[10px] font-bold font-mono tracking-wide`} style={statusStyles[status]}>
      {status}
    </span>
  );
}

export function ResultBadge({ result, size = "sm" }: { result: "WINNER" | "LOSER"; size?: "sm" | "md" }) {
  const sizeClass = size === "md" ? "text-xs px-2 py-0.5" : "text-[10px] px-1.5 py-0.5";

  return (
    <span className={`inline-flex items-center rounded font-bold font-mono tracking-wide uppercase ${sizeClass}`} style={resultStyles[result]}>
      {result}
    </span>
  );
}
