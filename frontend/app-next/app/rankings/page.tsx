import type { Metadata } from "next";

import { RankingsPage } from "@/components/rankings/rankings-page";
import { loadRankingsPageModel } from "@/lib/loaders/rankings";
import { readCurrentUserCookieFromRequest } from "@/lib/utils/request-context";

export const metadata: Metadata = {
  title: "StaReplays Rankings",
  description: "Track 3v3 rankings and race composition win-rate snapshots."
};

type RankingsRoutePageProps = {
  searchParams?: {
    currentUser?: string | string[];
  };
};

export default async function RankingsRoutePage(props: RankingsRoutePageProps) {
  const searchParams = props?.searchParams;
  const currentUser = typeof searchParams?.currentUser === "string" ? searchParams.currentUser.trim() : Array.isArray(searchParams?.currentUser) ? searchParams.currentUser[0]?.trim() : undefined;
  const currentUserCookie = readCurrentUserCookieFromRequest();
  const model = await loadRankingsPageModel({ currentUser, currentUserCookie });

  return <RankingsPage model={model} />;
}
