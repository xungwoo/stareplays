import { Suspense } from "react";
import Link from "next/link";
import { Shield } from "lucide-react";

import { CURRENT_USER } from "@/lib/fixtures/common";

import { AppNav, AppNavFallback } from "./app-nav";
import { CurrentUserChip, CurrentUserChipFallback } from "./current-user-chip";

export function AppHeader({ currentUser = CURRENT_USER }: { currentUser?: string }) {
  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between gap-3 px-3 py-0 sm:px-6"
      style={{ backgroundColor: "rgba(18,24,38,0.96)", borderBottom: "1px solid rgba(148,163,184,0.14)", backdropFilter: "blur(12px)" }}
      >
      <div className="flex min-w-0 items-center gap-3 md:gap-8">
        <Link href="/" className="flex items-center gap-2 py-4">
          <Shield className="h-5 w-5 text-cyan-300" />
          <span
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              fontSize: "1.25rem",
              letterSpacing: "0.08em",
              background: "linear-gradient(90deg, #9bd6df, #9eb6dc)",
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
      <div className="hidden shrink-0 sm:block">
        <Suspense fallback={<CurrentUserChipFallback currentUser={currentUser} />}>
          <CurrentUserChip currentUser={currentUser} />
        </Suspense>
      </div>
    </header>
  );
}
