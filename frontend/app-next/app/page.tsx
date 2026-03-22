import type { Metadata } from "next";

import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { loadDashboardPageModel } from "@/lib/loaders/dashboard";

export const metadata: Metadata = {
  title: "StaReplays Dashboard",
  description: "StaReplays dashboard overview, upload entry point, and player snapshot."
};

export default async function HomePage() {
  const model = await loadDashboardPageModel();

  return <DashboardPage model={model} />;
}
