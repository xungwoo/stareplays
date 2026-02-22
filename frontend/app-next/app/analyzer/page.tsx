"use client";

import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { APMLineChart } from "@/components/charts/apm-line-chart";
import { ChartCard } from "@/components/charts/chart-card";
import { RadarPerformanceChart } from "@/components/charts/radar-performance-chart";
import { SpendTimelineChart } from "@/components/charts/spend-timeline-chart";
import { DataTable } from "@/components/table/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api-client";
import { fmtDate, fmtGameTime, raceLetter, reliability, safeNum } from "@/lib/format";
import { useSessionStore } from "@/stores/session-store";
import {
  Game,
  Player,
  ResourceSpendSummary,
  TechTreeEvent,
  TechTreeSummary,
  UnitProductionSummary
} from "@/types/api";

const PAGE_SIZE = 10;

type GameRow = Game;

function playerEffective(player: Player): string {
  const cmd = Number(player.cmd_count || 0);
  const eff = Number(player.effective_cmd_count || 0);
  if (cmd <= 0) return "0.0";
  return ((eff / cmd) * 100).toFixed(1);
}

function teamMatchup(players: Player[]): string {
  const byTeam = new Map<number, string[]>();
  for (const p of players) {
    const team = Number(p.team || 0);
    if (!byTeam.has(team)) byTeam.set(team, []);
    byTeam.get(team)?.push(raceLetter(p.race));
  }
  return Array.from(byTeam.keys())
    .sort((a, b) => a - b)
    .map((team) => (byTeam.get(team) || []).join(""))
    .join(" vs ");
}

export default function AnalyzerPage() {
  const currentUser = useSessionStore((s) => s.currentUser);

  const [page, setPage] = useState(1);
  const [selectedGameId, setSelectedGameId] = useState<number>(0);
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");
  const [tab, setTab] = useState("apm");

  const gamesQuery = useQuery({
    queryKey: ["analyzer-games", page, currentUser],
    queryFn: () => apiClient.getGames(PAGE_SIZE, (page - 1) * PAGE_SIZE, currentUser || undefined)
  });

  const detailQuery = useQuery({
    queryKey: ["analyzer-game-detail", selectedGameId],
    queryFn: () => apiClient.getGameDetail(selectedGameId),
    enabled: selectedGameId > 0
  });

  useEffect(() => {
    const firstId = Number(gamesQuery.data?.games?.[0]?.id || 0);
    if (!selectedGameId && firstId) {
      setSelectedGameId(firstId);
    }
  }, [gamesQuery.data?.games, selectedGameId]);

  useEffect(() => {
    const players = (detailQuery.data?.game?.edges?.players || []) as Player[];
    if (!players.length) {
      setSelectedPlayer("");
      return;
    }
    if (!players.some((p) => p.name === selectedPlayer)) {
      setSelectedPlayer(players[0].name);
    }
  }, [detailQuery.data?.game?.edges?.players, selectedPlayer]);

  const gameColumns = useMemo<ColumnDef<GameRow>[]>(
    () => [
      { accessorKey: "id", header: "ID", cell: ({ row }) => `#${row.original.id}` },
      { accessorKey: "map_name", header: "Map" },
      {
        accessorKey: "game_length",
        header: "Time",
        cell: ({ row }) => fmtGameTime(Number(row.original.game_length || 0))
      },
      {
        accessorKey: "start_time",
        header: "Start",
        cell: ({ row }) => fmtDate(row.original.start_time)
      },
      {
        id: "pick",
        header: "Select",
        cell: ({ row }) => (
          <Button
            size="sm"
            variant={Number(row.original.id) === selectedGameId ? "primary" : "outline"}
            onClick={() => setSelectedGameId(Number(row.original.id))}
          >
            Open
          </Button>
        )
      }
    ],
    [selectedGameId]
  );

  const selectedGame = detailQuery.data?.game;
  const selectedPlayers = ((selectedGame?.edges?.players || []) as Player[]) || [];
  const events = ((detailQuery.data?.tech_tree?.events || []) as TechTreeEvent[])
    .filter((event) => (selectedPlayer ? event.player_name === selectedPlayer : true))
    .slice(0, 25);

  const totalPages = Math.max(1, Math.ceil(Number(gamesQuery.data?.total || 0) / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Game Analyzer</CardTitle>
            <p className="mt-1 text-xs text-fg/70">한 게임의 흐름과 플레이어별 수행 품질을 함께 보는 상세 분석 화면</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge>{currentUser ? `User Scope: ${currentUser}` : "User Scope: All"}</Badge>
            <Button variant="outline" size="sm" onClick={() => gamesQuery.refetch()}>
              <RefreshCw className="mr-1 h-3 w-3" /> Refresh
            </Button>
          </div>
        </div>
      </Card>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <div className="mb-3 flex items-center justify-between">
            <CardTitle className="text-[11px]">Game Selector</CardTitle>
            <div className="text-xs font-semibold uppercase text-fg/70">Page {page}/{totalPages}</div>
          </div>
          {gamesQuery.isPending ? <LoadingState text="Loading games..." /> : null}
          {gamesQuery.isError ? <ErrorState text={(gamesQuery.error as Error).message} /> : null}
          {!gamesQuery.isPending && !gamesQuery.isError ? (
            gamesQuery.data?.games?.length ? (
              <DataTable columns={gameColumns} data={gamesQuery.data.games} pageSize={10} />
            ) : (
              <EmptyState text="NO_GAMES_FOR_ANALYZER" />
            )
          ) : null}
          <div className="mt-2 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </Button>
          </div>
        </Card>

        <Card className="lg:col-span-8">
          <CardTitle className="mb-3 text-[11px]">Top Summary Strip</CardTitle>
          {detailQuery.isPending ? <LoadingState text="Loading selected game detail..." /> : null}
          {detailQuery.isError ? <ErrorState text={(detailQuery.error as Error).message} /> : null}
          {!detailQuery.isPending && !detailQuery.isError && selectedGame ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="rounded-lg border border-line bg-white/60 p-2 text-xs">MAP: {selectedGame.map_name}</div>
              <div className="rounded-lg border border-line bg-white/60 p-2 text-xs">PLAY_TIME: {fmtGameTime(selectedGame.game_length)}</div>
              <div className="rounded-lg border border-line bg-white/60 p-2 text-xs">WINNER: {selectedGame.winner_team > 0 ? `TEAM ${selectedGame.winner_team}` : "DRAW"}</div>
              <div className="rounded-lg border border-line bg-white/60 p-2 text-xs">RELIABILITY: {reliability(selectedGame.upload_count, selectedGame.player_count)}</div>
              <div className="rounded-lg border border-line bg-white/60 p-2 text-xs">START: {fmtDate(selectedGame.start_time)}</div>
              <div className="rounded-lg border border-line bg-white/60 p-2 text-xs">MATCHUP: {teamMatchup(selectedPlayers)}</div>
              <div className="rounded-lg border border-line bg-white/60 p-2 text-xs">PLAYER_COUNT: {selectedGame.player_count}</div>
              <div className="rounded-lg border border-line bg-white/60 p-2 text-xs">UPLOAD: {selectedGame.upload_count}</div>
            </div>
          ) : null}

          {!!selectedPlayers.length ? (
            <div className="mt-3 flex flex-wrap gap-1">
              {selectedPlayers.map((player) => (
                <Button
                  key={player.id}
                  size="sm"
                  variant={player.name === selectedPlayer ? "primary" : "outline"}
                  onClick={() => setSelectedPlayer(player.name)}
                >
                  {player.name}
                </Button>
              ))}
            </div>
          ) : null}
        </Card>
      </section>

      <Card>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="apm">APM</TabsTrigger>
            <TabsTrigger value="spend">Resource Spend</TabsTrigger>
            <TabsTrigger value="unit">Unit Production</TabsTrigger>
            <TabsTrigger value="tech">Tech / Upgrade</TabsTrigger>
            <TabsTrigger value="battle">Battle Intensity</TabsTrigger>
            <TabsTrigger value="actions">Action Mix</TabsTrigger>
          </TabsList>

          <TabsContent value="apm">
            {detailQuery.data?.detail?.apm_timeline?.length ? (
              <ChartCard title="APM Timeline" description="Player APM trend by frame">
                <APMLineChart timelines={detailQuery.data.detail.apm_timeline} />
              </ChartCard>
            ) : (
              <EmptyState text="NO_APM_TIMELINE" />
            )}
          </TabsContent>

          <TabsContent value="spend" className="space-y-3">
            {detailQuery.data?.resource_spend ? (
              <ChartCard title="Resource Spend" description={`Source: ${detailQuery.data.resource_spend.source}`}>
                <SpendTimelineChart spend={detailQuery.data.resource_spend} playerName={selectedPlayer || undefined} />
              </ChartCard>
            ) : (
              <EmptyState text="NO_RESOURCE_SPEND_DATA" />
            )}
            <DataTable<ResourceSpendSummary>
              columns={[
                { accessorKey: "player_name", header: "Player" },
                { accessorKey: "total_mineral", header: "Mineral" },
                { accessorKey: "total_gas", header: "Gas" },
                { accessorKey: "total_spend", header: "Total" }
              ]}
              data={detailQuery.data?.resource_spend?.summaries || []}
              pageSize={8}
            />
          </TabsContent>

          <TabsContent value="unit">
            <DataTable<UnitProductionSummary>
              columns={[
                { accessorKey: "player_name", header: "Player" },
                { accessorKey: "total", header: "Total" },
                { accessorKey: "worker", header: "Worker" },
                { accessorKey: "army", header: "Army" },
                { accessorKey: "tech_unit", header: "Tech Unit" }
              ]}
              data={detailQuery.data?.unit_production?.summaries || []}
              pageSize={8}
            />
          </TabsContent>

          <TabsContent value="tech">
            <DataTable<TechTreeSummary>
              columns={[
                { accessorKey: "player_name", header: "Player" },
                { accessorKey: "tech_count", header: "Tech" },
                { accessorKey: "upgrade_count", header: "Upgrade" },
                { accessorKey: "prereq_build_count", header: "Prereq" },
                { accessorKey: "cancel_count", header: "Cancel" },
                { accessorKey: "ineff_count", header: "Ineff" }
              ]}
              data={detailQuery.data?.tech_tree?.summary || []}
              pageSize={8}
            />
          </TabsContent>

          <TabsContent value="battle">
            {selectedPlayers.length ? (
              <ChartCard title="Battle Intensity" description="APM/EAPM/Effective/Redundancy balance by player">
                <RadarPerformanceChart players={selectedPlayers} />
              </ChartCard>
            ) : (
              <EmptyState text="NO_PLAYER_DATA" />
            )}
          </TabsContent>

          <TabsContent value="actions">
            <DataTable<Player>
              columns={[
                { accessorKey: "name", header: "Player" },
                { accessorKey: "apm", header: "APM", cell: ({ row }) => safeNum(row.original.apm, 0) },
                { accessorKey: "eapm", header: "EAPM", cell: ({ row }) => safeNum(row.original.eapm, 0) },
                {
                  id: "effective",
                  header: "Effective%",
                  cell: ({ row }) => `${playerEffective(row.original)}%`
                },
                { accessorKey: "redundancy", header: "Redundancy%", cell: ({ row }) => `${safeNum(row.original.redundancy, 0)}%` }
              ]}
              data={selectedPlayers}
              pageSize={8}
            />
          </TabsContent>
        </Tabs>
      </Card>

      <Card>
        <CardTitle className="mb-3 text-[11px]">Event Inspector</CardTitle>
        <DataTable<TechTreeEvent>
          columns={[
            { accessorKey: "player_name", header: "Player" },
            { accessorKey: "kind", header: "Type" },
            { accessorKey: "name", header: "Name" },
            {
              id: "time",
              header: "Time",
              cell: ({ row }) => `F:${Number(row.original.frame || 0)} (${safeNum(row.original.second, 1)}s)`
            },
            { accessorKey: "quality", header: "Quality" }
          ]}
          data={events}
          pageSize={10}
          emptyText="NO_TECH_EVENTS"
        />
      </Card>
    </div>
  );
}
