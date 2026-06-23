import { SeasonAnalysisPage } from "@/components/seasons/season-analysis-page";
import { createSeasonAnalysisPageModel } from "@/lib/adapters/season-analysis";
import { loadSeasonsResponse } from "@/lib/loaders/team-analysis";

export const metadata = {
  title: "시즌 전적 | StaReplays"
};

export default async function SeasonsPage() {
  const seasonsResponse = await loadSeasonsResponse();
  const model = createSeasonAnalysisPageModel({ seasonsResponse });

  return <SeasonAnalysisPage model={model} />;
}
