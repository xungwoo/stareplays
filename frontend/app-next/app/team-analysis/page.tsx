import type { Metadata } from "next";

import { TeamAnalysisPage } from "@/components/team-analysis/team-analysis-page";
import { loadSeasonTeamAnalysisPageModel, loadSeasonsResponse, loadTeamAnalysisPageModel } from "@/lib/loaders/team-analysis";

export const metadata: Metadata = {
  title: "StaReplays Team Analysis",
  description: "Analyze 3x3 team matchups, player strengths, race win rates, Bradley-Terry, and TrueSkill ratings."
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TeamAnalysisRoutePage({
  searchParams
}: {
  searchParams?: {
    season_label?: string | string[];
    scope?: string | string[];
  };
}) {
  const seasonsResponse = await loadSeasonsResponse();
  const seasonOptions = [...(seasonsResponse?.seasons ?? [])]
    .filter((season) => season.season_label?.trim())
    .sort((left, right) => (right.season_no ?? 0) - (left.season_no ?? 0))
    .map((season) => season.season_label?.trim())
    .filter((label): label is string => Boolean(label));
  const scope = firstParam(searchParams?.scope)?.trim();
  const requestedSeasonLabel = firstParam(searchParams?.season_label)?.trim();
  const latestSeasonLabel = seasonOptions[0] ?? null;
  const isAllSeasons = scope === "all";
  const selectedSeasonLabel = isAllSeasons ? null : requestedSeasonLabel || latestSeasonLabel;
  const model = selectedSeasonLabel
    ? await loadSeasonTeamAnalysisPageModel(selectedSeasonLabel)
    : await loadTeamAnalysisPageModel();

  model.scope = {
    selectedSeasonLabel,
    isAllSeasons,
    options: [
      {
        label: "전체",
        href: "/team-analysis?scope=all",
        selected: isAllSeasons
      },
      ...seasonOptions.map((label) => ({
        label,
        href: `/team-analysis?season_label=${encodeURIComponent(label)}`,
        selected: !isAllSeasons && selectedSeasonLabel === label
      }))
    ]
  };

  return <TeamAnalysisPage model={model} />;
}
