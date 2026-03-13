"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { APMLineChart } from "@/components/charts/apm-line-chart";
import { ChartCard } from "@/components/charts/chart-card";
import { RadarPerformanceChart } from "@/components/charts/radar-performance-chart";
import { SpendTimelineChart } from "@/components/charts/spend-timeline-chart";
import { DataTable } from "@/components/table/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api-client";
import { fmtDate, fmtGameTime, raceLetter, reliability, safeNum } from "@/lib/format";
import { useSessionStore } from "@/stores/session-store";
import {
  Game,
  Player,
  PlayerStatsResponse,
  ResourceSpendSummary,
  TechTreeSummary,
  UnitProductionSummary,
  UploadPreviewResponse
} from "@/types/api";

const GAMES_PAGE_SIZE = 10;

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

function splitOurEnemy(players: Player[], currentUser: string) {
  if (!players.length) {
    return { our: [] as Player[], enemy: [] as Player[] };
  }
  const grouped = new Map<number, Player[]>();
  for (const p of players) {
    const team = Number(p.team || 0);
    if (!grouped.has(team)) grouped.set(team, []);
    grouped.get(team)?.push(p);
  }

  const teams = Array.from(grouped.keys()).sort((a, b) => a - b);
  const found = currentUser
    ? players.find((p) => p.name.trim().toLowerCase() === currentUser.trim().toLowerCase())
    : undefined;

  const ourTeam = found?.team ?? teams[0] ?? 0;
  const enemyTeams = teams.filter((team) => team !== ourTeam);

  return {
    our: grouped.get(ourTeam) || [],
    enemy: enemyTeams.flatMap((team) => grouped.get(team) || [])
  };
}

function PlayerLine({ player }: { player: Player }) {
  return (
    <div className="flex items-center gap-1 text-[11px] font-semibold">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-line bg-white/70 text-[10px]">
        {raceLetter(player.race)}
      </span>
      <span className="truncate">{player.name}</span>
      <span className="ml-auto text-[10px] text-fg/60">A:{player.apm} E:{player.eapm}</span>
    </div>
  );
}

function PlayerStatsPanels({ stats }: { stats: PlayerStatsResponse }) {
  const records = [
    { label: "Win Rate", value: `${safeNum(stats.win_rate)}%` },
    { label: "Games", value: stats.total_games },
    { label: "Record", value: `${stats.wins}-${stats.losses}-${stats.draws}` },
    { label: "Avg APM/EAPM", value: `${safeNum(stats.average_apm)} / ${safeNum(stats.average_eapm)}` }
  ];

  const sections = [
    { title: "Race Stats", data: stats.race_stats },
    { title: "Matchup Stats", data: stats.matchup_stats },
    { title: "Map Stats", data: stats.map_stats }
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {records.map((entry) => (
          <div key={entry.label} className="rounded-lg border border-line bg-white/70 p-2">
            <div className="text-[10px] font-semibold uppercase text-fg/60">{entry.label}</div>
            <div className="mt-1 text-sm font-bold">{entry.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {sections.map((section) => (
          <div key={section.title} className="rounded-lg border border-line bg-white/70 p-2">
            <h4 className="mb-2 text-[11px] font-bold uppercase">{section.title}</h4>
            <div className="space-y-1 text-xs">
              {Object.entries(section.data || {})
                .sort((a, b) => Number(b[1].total || 0) - Number(a[1].total || 0))
                .slice(0, 7)
                .map(([name, row]) => (
                  <div key={name} className="flex items-center justify-between gap-2">
                    <span className="truncate">{name}</span>
                    <span className="text-fg/65">
                      {row.wins}-{row.losses} ({safeNum(row.win_rate)}%)
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReplayVaultPage() {
  const currentUser = useSessionStore((s) => s.currentUser);
  const setCurrentUser = useSessionStore((s) => s.setCurrentUser);

  const [gamesPage, setGamesPage] = useState(1);
  const [selectedGameId, setSelectedGameId] = useState<number>(0);
  const [queryPlayerName, setQueryPlayerName] = useState("");
  const [selectedPlayerForViz, setSelectedPlayerForViz] = useState("");
  const [vizTab, setVizTab] = useState("apm");

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [candidatePlayers, setCandidatePlayers] = useState<string[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [previewData, setPreviewData] = useState<UploadPreviewResponse | null>(null);

  const [playerSuggestions, setPlayerSuggestions] = useState<string[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStatsResponse | null>(null);

  const [systemLogs, setSystemLogs] = useState<string[]>(["> READY"]);

  const appendLog = (text: string) => {
    const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
    setSystemLogs((prev) => [`> ${ts} ${text}`, ...prev].slice(0, 20));
  };

  const gamesQuery = useQuery({
    queryKey: ["replay-vault-games", gamesPage, currentUser],
    queryFn: () => apiClient.getGames(GAMES_PAGE_SIZE, (gamesPage - 1) * GAMES_PAGE_SIZE, currentUser || undefined),
    enabled: !!currentUser
  });

  const detailQuery = useQuery({
    queryKey: ["replay-vault-detail", selectedGameId],
    queryFn: () => apiClient.getGameDetail(selectedGameId),
    enabled: selectedGameId > 0
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      pendingFiles.forEach((file) => fd.append("replay_files", file));
      return apiClient.previewUpload(fd);
    },
    onSuccess: (data) => {
      setPreviewData(data);
      const players = Array.isArray(data.candidate_players) ? data.candidate_players : [];
      setCandidatePlayers(players);

      const matched = currentUser
        ? players.find((name) => name.trim().toLowerCase() === currentUser.trim().toLowerCase())
        : "";
      const nextSelected = matched || players[0] || "";
      setSelectedCandidate(nextSelected);
      if (!currentUser && nextSelected) {
        setCurrentUser(nextSelected);
      }
      appendLog(`ANALYZE_OK ${data.success_count}/${data.total_files}`);
    },
    onError: (error) => {
      appendLog(`ANALYZE_FAIL ${(error as Error).message}`);
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const uploader = (selectedCandidate || currentUser || "").trim();
      if (!uploader) {
        throw new Error("uploader_name is required");
      }
      const fd = new FormData();
      pendingFiles.forEach((file) => fd.append("replay_files", file));
      fd.append("uploader_name", uploader);
      return apiClient.uploadReplays(fd);
    },
    onSuccess: async (data) => {
      appendLog("UPLOAD_OK");
      await gamesQuery.refetch();
      const first = data.game?.id || data.results?.find((item) => item.ok && item.result?.game?.id)?.result?.game?.id;
      if (first) {
        setSelectedGameId(Number(first));
      }
    },
    onError: (error) => {
      appendLog(`UPLOAD_FAIL ${(error as Error).message}`);
    }
  });

  const playerStatsMutation = useMutation({
    mutationFn: async (name: string) => apiClient.getPlayerStats(name),
    onSuccess: (data) => {
      setPlayerStats(data);
      appendLog(`PLAYER_STATS_OK ${data.player_name}`);
    },
    onError: (error) => {
      setPlayerStats(null);
      appendLog(`PLAYER_STATS_FAIL ${(error as Error).message}`);
    }
  });

  useEffect(() => {
    if (gamesQuery.data?.games?.length && !selectedGameId) {
      setSelectedGameId(Number(gamesQuery.data.games[0].id));
    }
  }, [gamesQuery.data?.games, selectedGameId]);

  useEffect(() => {
    const players = (detailQuery.data?.game?.edges?.players || []) as Player[];
    if (!players.length) {
      setSelectedPlayerForViz("");
      return;
    }
    if (!players.some((p) => p.name === selectedPlayerForViz)) {
      setSelectedPlayerForViz(players[0].name);
    }
  }, [detailQuery.data?.game?.edges?.players, selectedPlayerForViz]);

  useEffect(() => {
    if (!queryPlayerName.trim()) {
      setPlayerSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.suggestUsers(queryPlayerName.trim(), 5);
        setPlayerSuggestions(res.users || []);
      } catch {
        setPlayerSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [queryPlayerName]);

  const totalPages = Math.max(1, Math.ceil(Number(gamesQuery.data?.total || 0) / GAMES_PAGE_SIZE));

  const gameColumns = useMemo<ColumnDef<Game>[]>(
    () => [
      { accessorKey: "id", header: "ID", cell: ({ row }) => `#${row.original.id}` },
      { accessorKey: "map_name", header: "Map" },
      {
        id: "matchup",
        header: "Matchup",
        cell: ({ row }) => teamMatchup((row.original.edges?.players || []) as Player[])
      },
      {
        id: "our_team",
        header: "Our Team",
        cell: ({ row }) => {
          const group = splitOurEnemy((row.original.edges?.players || []) as Player[], currentUser);
          return (
            <div className="space-y-1">
              {group.our.map((player) => (
                <PlayerLine key={player.id} player={player} />
              ))}
            </div>
          );
        }
      },
      {
        id: "enemy_team",
        header: "Enemy Team",
        cell: ({ row }) => {
          const group = splitOurEnemy((row.original.edges?.players || []) as Player[], currentUser);
          return (
            <div className="space-y-1">
              {group.enemy.map((player) => (
                <PlayerLine key={player.id} player={player} />
              ))}
            </div>
          );
        }
      },
      {
        accessorKey: "game_length",
        header: "Play Time",
        cell: ({ row }) => fmtGameTime(Number(row.original.game_length || 0))
      },
      {
        accessorKey: "start_time",
        header: "Start",
        cell: ({ row }) => fmtDate(row.original.start_time)
      },
      {
        id: "open",
        header: "Open",
        cell: ({ row }) => (
          <Button
            size="sm"
            variant={selectedGameId === Number(row.original.id) ? "primary" : "outline"}
            onClick={() => setSelectedGameId(Number(row.original.id))}
          >
            <ArrowRight className="mr-1 h-3 w-3" /> Select
          </Button>
        )
      }
    ],
    [currentUser, selectedGameId]
  );

  const selectedGame = detailQuery.data?.game;
  const selectedPlayers = ((selectedGame?.edges?.players || []) as Player[]) || [];

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardTitle>Replay Upload Module</CardTitle>
          <div className="mt-3 space-y-3">
            <input
              type="file"
              accept=".rep"
              multiple
              className="block w-full text-sm"
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                setPendingFiles(files);
              }}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => previewMutation.mutate()} disabled={!pendingFiles.length || previewMutation.isPending}>
                Analyze Replay
              </Button>
              <Button onClick={() => uploadMutation.mutate()} disabled={!pendingFiles.length || uploadMutation.isPending}>
                Upload With Selected User
              </Button>
            </div>

            <div className="rounded-lg border border-line bg-white/60 p-3">
              <div className="mb-2 text-[10px] font-bold uppercase text-fg/60">Selected User (Simple Login)</div>
              <select
                className="h-10 w-full rounded-md border border-line bg-white/70 px-2 text-sm font-semibold"
                value={selectedCandidate}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedCandidate(value);
                  if (value) setCurrentUser(value);
                }}
              >
                <option value="">SELECT_PLAYER_FROM_PARSED_REPLAY</option>
                {candidatePlayers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <div className="mt-2 text-xs font-semibold uppercase text-fg/70">
                CURRENT_USER: {currentUser || "NOT_LOGGED_IN"}
              </div>
            </div>

            <div className="rounded-lg border border-line bg-white/60 p-3 text-xs">
              {previewMutation.isPending ? "ANALYZING..." : null}
              {previewMutation.isError ? `ANALYZE_FAIL: ${(previewMutation.error as Error).message}` : null}
              {previewData ? `ANALYZE_OK: ${previewData.success_count}/${previewData.total_files}` : "NO_PREVIEW"}
            </div>

            {previewData?.results?.length ? (
              <div className="max-h-44 overflow-auto rounded-lg border border-line bg-white/70 p-2 text-xs">
                {previewData.results.map((item) => (
                  <div key={item.filename} className="mb-2 border-b border-line/30 pb-2 last:mb-0 last:border-b-0">
                    <div className="font-semibold">{item.ok ? "OK" : "FAIL"}: {item.filename}</div>
                    {item.ok ? (
                      <div className="text-fg/70">
                        MAP: {item.preview?.map_name || "-"} | START: {fmtDate(item.preview?.start_time)} | PLAYERS: {item.preview?.parsed_players?.join(", ")}
                      </div>
                    ) : (
                      <div className="text-warning">{item.error || "parse failed"}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="lg:col-span-7">
          <CardTitle>Player Stats Query</CardTitle>
          <div className="mt-3 flex gap-2">
            <div className="relative w-full">
              <Input
                list="player-suggest"
                placeholder="PLAYER_NAME..."
                value={queryPlayerName}
                onChange={(event) => setQueryPlayerName(event.target.value)}
              />
              <datalist id="player-suggest">
                {playerSuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                const target = queryPlayerName.trim() || currentUser;
                if (!target) return;
                playerStatsMutation.mutate(target);
              }}
            >
              Query
            </Button>
          </div>

          <div className="mt-3">
            {playerStatsMutation.isPending ? <LoadingState text="Loading player stats..." /> : null}
            {playerStatsMutation.isError ? <ErrorState text={(playerStatsMutation.error as Error).message} /> : null}
            {playerStats ? <PlayerStatsPanels stats={playerStats} /> : <EmptyState text="NO_QUERY" />}
          </div>
        </Card>
      </section>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <CardTitle>Recent Games</CardTitle>
          <div className="flex items-center gap-2">
            <Badge>{currentUser ? `User Scope: ${currentUser}` : "Login required"}</Badge>
            <Button variant="outline" size="sm" onClick={() => gamesQuery.refetch()} disabled={!currentUser}>
              <RefreshCw className="mr-1 h-3 w-3" /> Refresh
            </Button>
          </div>
        </div>

        {!currentUser ? <EmptyState text="LOGIN_REQUIRED: Simple login 후 Recent Games 조회 가능" /> : null}
        {currentUser && gamesQuery.isPending ? <LoadingState text="Loading recent games..." /> : null}
        {currentUser && gamesQuery.isError ? <ErrorState text={(gamesQuery.error as Error).message} /> : null}
        {currentUser && !gamesQuery.isPending && !gamesQuery.isError ? (
          gamesQuery.data?.games?.length ? (
            <DataTable columns={gameColumns} data={gamesQuery.data.games} pageSize={10} />
          ) : (
            <EmptyState text="NO_GAMES_FOUND" />
          )
        ) : null}

        {currentUser ? (
          <div className="mt-2 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setGamesPage((prev) => Math.max(1, prev - 1))} disabled={gamesPage <= 1}>
              Prev
            </Button>
            <span className="min-w-20 text-center text-xs font-semibold uppercase text-fg/70">
              Page {gamesPage}/{totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGamesPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={gamesPage >= totalPages}
            >
              Next
            </Button>
          </div>
        ) : null}
      </Card>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle className="mb-3">Selected Game</CardTitle>
          {detailQuery.isPending ? <LoadingState text="FETCHING_GAME..." /> : null}
          {detailQuery.isError ? <ErrorState text={(detailQuery.error as Error).message} /> : null}
          {!detailQuery.isPending && !detailQuery.isError && selectedGame ? (
            <div className="space-y-2 text-xs">
              <div className="rounded-lg border border-line bg-white/65 p-2">#{selectedGame.id} {selectedGame.map_name}</div>
              <div className="rounded-lg border border-line bg-white/65 p-2">START: {fmtDate(selectedGame.start_time)}</div>
              <div className="rounded-lg border border-line bg-white/65 p-2">PLAY_TIME: {fmtGameTime(selectedGame.game_length)}</div>
              <div className="rounded-lg border border-line bg-white/65 p-2">MATCHUP: {teamMatchup(selectedPlayers)}</div>
              <div className="rounded-lg border border-line bg-white/65 p-2">WINNER: {selectedGame.winner_team > 0 ? `TEAM ${selectedGame.winner_team}` : "DRAW"}</div>
              <div className="rounded-lg border border-line bg-white/65 p-2">RELIABILITY: {reliability(selectedGame.upload_count, selectedGame.player_count)}</div>
            </div>
          ) : null}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => (window.location.href = "/analyzer")}>Open Analyzer</Button>
          </div>
        </Card>

        <Card>
          <CardTitle className="mb-3">Game Detail Visualization</CardTitle>
          {!!detailQuery.data?.analysis_status ? (
            <div className="mb-3 rounded-lg border border-line bg-white/70 p-2 text-xs font-semibold uppercase text-fg/75">
              STATUS: {detailQuery.data.analysis_status.status} | TYPED_EVENT_COVERAGE: {safeNum(detailQuery.data.analysis_status.typed_event_coverage || 0)}% | SIZE: {detailQuery.data.analysis_status.estimated_size_tier}
            </div>
          ) : null}

          {!!selectedPlayers.length ? (
            <div className="mb-3 flex flex-wrap gap-1">
              {selectedPlayers.map((player) => (
                <Button
                  key={player.id}
                  size="sm"
                  variant={selectedPlayerForViz === player.name ? "primary" : "outline"}
                  onClick={() => setSelectedPlayerForViz(player.name)}
                >
                  {player.name}
                </Button>
              ))}
            </div>
          ) : null}

          <Tabs value={vizTab} onValueChange={setVizTab}>
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
                <ChartCard title="APM Timeline">
                  <APMLineChart timelines={detailQuery.data.detail.apm_timeline} />
                </ChartCard>
              ) : (
                <EmptyState text="NO_APM_TIMELINE" />
              )}
            </TabsContent>

            <TabsContent value="spend" className="space-y-3">
              {detailQuery.data?.resource_spend ? (
                <ChartCard title="Resource Spend" description={`Source: ${detailQuery.data.resource_spend.source}`}>
                  <SpendTimelineChart spend={detailQuery.data.resource_spend} playerName={selectedPlayerForViz || undefined} />
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
                <ChartCard title="Battle Intensity">
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
                    cell: ({ row }) => {
                      const cmd = Number(row.original.cmd_count || 0);
                      const eff = Number(row.original.effective_cmd_count || 0);
                      return `${cmd > 0 ? ((eff / cmd) * 100).toFixed(1) : "0.0"}%`;
                    }
                  },
                  { accessorKey: "redundancy", header: "Redundancy%", cell: ({ row }) => `${safeNum(row.original.redundancy, 0)}%` }
                ]}
                data={selectedPlayers}
                pageSize={8}
                emptyText="NO_ACTION_DATA"
              />
            </TabsContent>
          </Tabs>
        </Card>
      </section>

      <Card>
        <CardTitle className="mb-2">System Logs</CardTitle>
        <div className="max-h-40 space-y-1 overflow-auto pr-2 text-xs font-semibold text-fg/70">
          {systemLogs.map((log, idx) => (
            <p key={`${log}-${idx}`}>{log}</p>
          ))}
        </div>
      </Card>
    </div>
  );
}
