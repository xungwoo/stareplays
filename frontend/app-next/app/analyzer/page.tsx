import type { Metadata } from "next";

import { AnalyzerPage } from "@/components/analyzer/analyzer-page";
import { loadAnalyzerPageModel } from "@/lib/loaders/analyzer";
import { readCurrentUserCookieFromRequest } from "@/lib/utils/request-context";

export const metadata: Metadata = {
  title: "StaReplays Game Analyzer",
  description: "Inspect timeline flow, resource spend, and player deep dive analytics."
};

type AnalyzerRoutePageProps = {
  searchParams?: {
    currentUser?: string | string[];
  };
};

export default async function AnalyzerRoutePage(props: AnalyzerRoutePageProps) {
  const searchParams = props?.searchParams;
  const currentUser = typeof searchParams?.currentUser === "string" ? searchParams.currentUser.trim() : Array.isArray(searchParams?.currentUser) ? searchParams.currentUser[0]?.trim() : undefined;
  const currentUserCookie = readCurrentUserCookieFromRequest();
  const model = await loadAnalyzerPageModel({ currentUser, currentUserCookie });

  return <AnalyzerPage model={model} />;
}
