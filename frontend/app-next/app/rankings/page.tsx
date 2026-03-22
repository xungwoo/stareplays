import type { Metadata } from "next";

import { RankingsPage } from "@/components/rankings/rankings-page";
import { loadRankingsPageModel } from "@/lib/loaders/rankings";

export const metadata: Metadata = {
  title: "StaReplays Rankings",
  description: "Track 3v3 rankings and race composition win-rate snapshots."
};

export default async function RankingsRoutePage() {
  const model = await loadRankingsPageModel();

  return <RankingsPage model={model} />;
}
