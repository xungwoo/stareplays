import { Suspense } from "react";
import Link from "next/link";
import { Shield } from "lucide-react";

import { CURRENT_USER } from "@/lib/fixtures/common";

import { AppNav, AppNavFallback } from "./app-nav";
import { CurrentUserChip, CurrentUserChipFallback } from "./current-user-chip";

export function AppHeader({ currentUser = CURRENT_USER }: { currentUser?: string }) {
  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between px-6 py-0"
      style={{ backgroundColor: "#080e1f", borderBottom: "1px solid rgba(34,211,238,0.15)" }}
      >
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2 py-4">
          <Shield className="h-5 w-5 text-cyan-400" />
          <span
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              fontSize: "1.25rem",
              letterSpacing: "0.08em",
              background: "linear-gradient(90deg, #22d3ee, #60a5fa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent"
            }}
          >
            StaReplays
          </span>
          <span className="ml-1 text-xs font-mono text-slate-600">v2.0</span>
        </Link>
        <Suspense fallback={<AppNavFallback currentUser={currentUser} />}>
          <AppNav currentUser={currentUser} />
        </Suspense>
      </div>
      <Suspense fallback={<CurrentUserChipFallback currentUser={currentUser} />}>
        <CurrentUserChip currentUser={currentUser} />
      </Suspense>
    </header>
  );
}
