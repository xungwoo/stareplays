import type { Metadata } from "next";

import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { loadDashboardPageModel } from "@/lib/loaders/dashboard";
import { readCurrentUserCookieFromRequest } from "@/lib/utils/request-context";

export const metadata: Metadata = {
  title: "StaReplays Dashboard",
  description: "StaReplays dashboard overview, upload entry point, and player snapshot."
};

type HomePageProps = {
  searchParams?: {
    currentUser?: string | string[];
  };
};

export default async function HomePage(props: HomePageProps) {
  const searchParams = props?.searchParams;
  const currentUser = typeof searchParams?.currentUser === "string" ? searchParams.currentUser.trim() : Array.isArray(searchParams?.currentUser) ? searchParams.currentUser[0]?.trim() : undefined;
  const currentUserCookie = readCurrentUserCookieFromRequest();
  const model = await loadDashboardPageModel({ currentUser, currentUserCookie });

  return <DashboardPage model={model} />;
}
