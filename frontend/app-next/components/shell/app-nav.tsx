"use client";

import { Activity, BarChart3, Cpu, Database, Menu, Trophy, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { NAVIGATION_ITEMS } from "@/lib/constants/navigation";

const navigationIcons = {
  activity: Activity,
  chart: BarChart3,
  database: Database,
  cpu: Cpu,
  trophy: Trophy
} as const;

function AppNavLinks({ currentUser }: { currentUser: string }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
        {NAVIGATION_ITEMS.map((item) => (
          (() => {
            const Icon = navigationIcons[item.icon];
            const isActive = pathname === item.href;
            const href = currentUser ? `${item.href}?currentUser=${encodeURIComponent(currentUser)}` : item.href;

            return (
              <Link
                key={item.href}
                href={href}
                className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-mono font-semibold tracking-wider transition-all duration-200 ${
                  isActive
                    ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                    : "border-transparent text-slate-500 hover:bg-slate-800/60 hover:text-slate-300"
                }`}
              >
                <Icon className="h-3 w-3" />
                {item.label}
              </Link>
            );
          })()
        ))}
      </nav>
      <div className="relative md:hidden">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-200"
          aria-label="Toggle navigation"
          aria-expanded={isOpen}
        >
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
        {isOpen ? (
          <nav className="absolute left-0 top-11 z-50 grid w-56 gap-1 rounded-lg border border-slate-700 bg-slate-950 p-2 shadow-xl shadow-slate-950/40" aria-label="Mobile primary">
            {NAVIGATION_ITEMS.map((item) => {
              const Icon = navigationIcons[item.icon];
              const isActive = pathname === item.href;
              const href = currentUser ? `${item.href}?currentUser=${encodeURIComponent(currentUser)}` : item.href;

              return (
                <Link
                  key={item.href}
                  href={href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-mono font-semibold tracking-wider ${
                    isActive
                      ? "border-cyan-500/30 bg-cyan-500/15 text-cyan-300"
                      : "border-transparent text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </div>
    </>
  );
}

export function AppNavFallback({ currentUser }: { currentUser: string }) {
  return <AppNavLinks currentUser={currentUser} />;
}

export function AppNav({ currentUser }: { currentUser: string }) {
  const searchParams = useSearchParams();
  const queryCurrentUser = searchParams.get("currentUser")?.trim();

  return <AppNavLinks currentUser={queryCurrentUser || currentUser} />;
}
