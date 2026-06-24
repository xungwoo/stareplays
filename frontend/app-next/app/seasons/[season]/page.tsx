import { SeasonAnalysisPage } from "@/components/seasons/season-analysis-page";
import { loadSeasonAnalysisPageModel } from "@/lib/loaders/team-analysis";

interface SeasonDetailPageProps {
  params: Promise<{
    season: string;
  }>;
}

export async function generateMetadata({ params }: SeasonDetailPageProps) {
  const { season } = await params;
  const label = decodeURIComponent(season);

  return {
    title: `${label} 전적 | StaReplays`
  };
}

export default async function SeasonDetailPage({ params }: SeasonDetailPageProps) {
  const { season } = await params;
  const label = decodeURIComponent(season);
  const model = await loadSeasonAnalysisPageModel({}, label);

  return <SeasonAnalysisPage model={model} />;
}
