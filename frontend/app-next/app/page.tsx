import type { Metadata } from "next";
import { cookies } from "next/headers";

import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { loadDashboardPageModel } from "@/lib/loaders/dashboard";
import { CURRENT_USER_SESSION_COOKIE_NAME } from "@/lib/utils/current-user-session";

export const metadata: Metadata = {
  title: "StaReplays Dashboard",
  description: "StaReplays dashboard overview, upload entry point, and player snapshot."
};

type HomePageProps = {
  searchParams?: {
    currentUser?: string | string[];
  };
};

export default async function HomePage({ searchParams }: HomePageProps = {}) {
  const currentUser = typeof searchParams?.currentUser === "string" ? searchParams.currentUser.trim() : Array.isArray(searchParams?.currentUser) ? searchParams.currentUser[0]?.trim() : undefined;
  const currentUserCookie = cookies().get(CURRENT_USER_SESSION_COOKIE_NAME)?.value;
  const model = await loadDashboardPageModel({ currentUser, currentUserCookie });

  return <DashboardPage model={model} />;
}
