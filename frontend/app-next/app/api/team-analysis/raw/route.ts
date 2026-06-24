import { createTeamAnalysisRawPayload } from "@/lib/adapters/team-analysis-raw";
import { loadAllGamesResponse } from "@/lib/loaders/team-analysis";

export const revalidate = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const seasonLabel = url.searchParams.get("season_label")?.trim() || null;
  const gamesResponse = await loadAllGamesResponse({ revalidateSeconds: revalidate }, seasonLabel ?? undefined);

  return Response.json(createTeamAnalysisRawPayload({ gamesResponse, seasonLabel }), {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300"
    }
  });
}
