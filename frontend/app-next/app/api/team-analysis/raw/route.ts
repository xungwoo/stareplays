import { createTeamAnalysisRawPayload } from "@/lib/adapters/team-analysis-raw";
import { loadAllGamesResponse } from "@/lib/loaders/team-analysis";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const seasonLabel = url.searchParams.get("season_label")?.trim() || null;
  const gamesResponse = await loadAllGamesResponse({ cache: "no-store" }, seasonLabel ?? undefined);

  return Response.json(createTeamAnalysisRawPayload({ gamesResponse, seasonLabel }));
}
