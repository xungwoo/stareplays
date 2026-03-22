import type { Metadata } from "next";
import { cookies } from "next/headers";

import { RankingsPage } from "@/components/rankings/rankings-page";
import { loadRankingsPageModel } from "@/lib/loaders/rankings";
import { CURRENT_USER_SESSION_COOKIE_NAME } from "@/lib/utils/current-user-session";

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
  const currentUserCookie = cookies().get(CURRENT_USER_SESSION_COOKIE_NAME)?.value;
  const model = await loadRankingsPageModel({ currentUser, currentUserCookie });

  return <RankingsPage model={model} />;
}
