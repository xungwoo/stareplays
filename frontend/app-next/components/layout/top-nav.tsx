"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";

const links = [
  { href: "/", label: "Replay Vault" },
  { href: "/analyzer", label: "Game Analyzer" },
  { href: "/rankings", label: "Rankings" }
];

export function TopNav() {
  const pathname = usePathname();
  const currentUser = useSessionStore((s) => s.currentUser);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-5">
          <span className="font-mono text-sm font-bold uppercase tracking-widest">StaReplays v2</span>
          <nav className="hidden items-center gap-2 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md border border-transparent px-2 py-1 text-xs font-semibold uppercase tracking-wide text-fg/75 transition hover:border-line hover:bg-white/40",
                  pathname === link.href && "border-line bg-fg text-bg hover:bg-fg"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <Badge>{currentUser ? `Current User: ${currentUser}` : "Current User: Not Logged In"}</Badge>
      </div>
    </header>
  );
}
