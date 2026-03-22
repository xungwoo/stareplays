"use client";

import { Activity, Cpu, Database, Trophy } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAVIGATION_ITEMS } from "@/lib/constants/navigation";

const navigationIcons = {
  activity: Activity,
  database: Database,
  cpu: Cpu,
  trophy: Trophy
} as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
      {NAVIGATION_ITEMS.map((item) => (
        (() => {
          const Icon = navigationIcons[item.icon];
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
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
  );
}
