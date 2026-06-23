import type { Metadata } from "next";

import { TeamAnalysisPage } from "@/components/team-analysis/team-analysis-page";
import { loadTeamAnalysisPageModel } from "@/lib/loaders/team-analysis";

export const metadata: Metadata = {
  title: "StaReplays Team Analysis",
  description: "Analyze 3x3 team matchups, player strengths, race win rates, Bradley-Terry, and TrueSkill ratings."
};

export default async function TeamAnalysisRoutePage() {
  const model = await loadTeamAnalysisPageModel();

  return <TeamAnalysisPage model={model} />;
}
