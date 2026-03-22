import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppHeader } from "@/components/shell/app-header";

import "./globals.css";

export const metadata: Metadata = {
  title: "StaReplays",
  description: "Starcraft: Brood War 3v3 Replay Analytics",
  openGraph: {
    title: "StaReplays",
    description: "Starcraft: Brood War 3v3 Replay Analytics"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body
        className="flex min-h-screen flex-col"
        style={{ backgroundColor: "#080e1f", color: "#e2e8f0", fontFamily: "'Inter', sans-serif" }}
      >
        <AppHeader />
        <main className="flex-1">{children}</main>
        <footer className="py-3 text-center text-xs font-mono text-slate-700" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          StaReplays v2.0 — Starcraft: Brood War 3v3 Replay Analytics
        </footer>
      </body>
    </html>
  );
}
