import { SeasonAnalysisPage } from "@/components/seasons/season-analysis-page";
import { loadSeasonAnalysisPageModel } from "@/lib/loaders/team-analysis";

export const metadata = {
  title: "시즌 전적 | StaReplays"
};

export default async function SeasonsPage() {
  const model = await loadSeasonAnalysisPageModel();

  return <SeasonAnalysisPage model={model} />;
}
