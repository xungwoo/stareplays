import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";

import { TopNav } from "@/components/layout/top-nav";

import { AppProviders } from "./providers";
import "./globals.css";

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans"
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "600", "700"]
});

export const metadata: Metadata = {
  title: "StaReplays Frontend V2",
  description: "Next.js + Fastify frontend for StaReplays"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${sans.variable} ${mono.variable}`}>
        <AppProviders>
          <div className="min-h-screen">
            <TopNav />
            <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 md:py-8">{children}</main>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
