import type { Metadata } from "next";
import { cookies } from "next/headers";

import { AnalyzerPage } from "@/components/analyzer/analyzer-page";
import { loadAnalyzerPageModel } from "@/lib/loaders/analyzer";
import { CURRENT_USER_SESSION_COOKIE_NAME } from "@/lib/utils/current-user-session";

export const metadata: Metadata = {
  title: "StaReplays Game Analyzer",
  description: "Inspect timeline flow, resource spend, and player deep dive analytics."
};

type AnalyzerRoutePageProps = {
  searchParams?: {
    currentUser?: string | string[];
    gameId?: string | string[];
  };
};

export default async function AnalyzerRoutePage({ searchParams }: AnalyzerRoutePageProps = {}) {
  const currentUser = typeof searchParams?.currentUser === "string" ? searchParams.currentUser.trim() : Array.isArray(searchParams?.currentUser) ? searchParams.currentUser[0]?.trim() : undefined;
  const currentUserCookie = cookies().get(CURRENT_USER_SESSION_COOKIE_NAME)?.value;
  const model = await loadAnalyzerPageModel({ currentUser, currentUserCookie });

  return <AnalyzerPage model={model} />;
}
