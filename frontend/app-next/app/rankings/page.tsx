"use client";

import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowDownUp, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/table/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api-client";
import { percent, safeNum } from "@/lib/format";
import { RaceMatchupRow, RankingItem } from "@/types/api";

function RaceBadge({ race }: { race: string }) {
  const classes =
    race === "T"
      ? "bg-blue-100 text-blue-900 border-blue-300"
      : race === "Z"
        ? "bg-red-100 text-red-900 border-red-300"
        : race === "P"
          ? "bg-amber-100 text-amber-900 border-amber-300"
          : "";
  return <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${classes}`}>{race}</span>;
}

function Composition({ value }: { value: string }) {
  const races = String(value || "").split("").filter(Boolean);
  return (
    <div className="inline-flex items-center gap-1">
      {races.map((race, idx) => (
        <RaceBadge key={`${race}-${idx}`} race={race} />
      ))}
    </div>
  );
}

export default function RankingsPage() {
  const [tab, setTab] = useState("rankings");

  const rankingsQuery = useQuery({
    queryKey: ["rankings-3v3"],
    queryFn: () => apiClient.getRankings3v3(200)
  });

  const raceQuery = useQuery({
    queryKey: ["race-matchups"],
    queryFn: () => apiClient.getRaceMatchups(3, 400)
  });

  const rankingsColumns = useMemo<ColumnDef<RankingItem>[]>(
    () => [
      {
        accessorKey: "rank",
        header: "Rank",
        cell: ({ row }) => `#${row.original.rank}`
      },
      {
        accessorKey: "name",
        header: "User"
      },
      {
        accessorKey: "win_rate",
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Win Rate <ArrowDownUp size={12} />
          </button>
        ),
        cell: ({ row }) => percent(row.original.win_rate),
        sortingFn: "basic"
      },
      {
        id: "record",
        header: "Record",
        cell: ({ row }) => `${row.original.wins}-${row.original.losses || 0}-${row.original.draws || 0}`
      },
      {
        accessorKey: "games",
        header: "Games"
      },
      {
        accessorKey: "avg_apm",
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Avg APM <ArrowDownUp size={12} />
          </button>
        ),
        cell: ({ row }) => safeNum(row.original.avg_apm)
      },
      {
        accessorKey: "avg_eapm",
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Avg EAPM <ArrowDownUp size={12} />
          </button>
        ),
        cell: ({ row }) => safeNum(row.original.avg_eapm)
      }
    ],
    []
  );

  const raceColumns = useMemo<ColumnDef<RaceMatchupRow>[]>(
    () => [
      {
        id: "matchup",
        header: "Matchup",
        cell: ({ row }) => (
          <div className="inline-flex items-center gap-2">
            <Composition value={row.original.team_a} />
            <span className="text-fg/60">vs</span>
            <Composition value={row.original.team_b} />
          </div>
        )
      },
      {
        accessorKey: "games",
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Games <ArrowDownUp size={12} />
          </button>
        )
      },
      {
        accessorKey: "team_a_win_rate",
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Team A Win% <ArrowDownUp size={12} />
          </button>
        ),
        cell: ({ row }) => percent(row.original.team_a_win_rate)
      },
      {
        id: "team_b_win_rate",
        header: "Team B Win%",
        cell: ({ row }) => percent(100 - Number(row.original.team_a_win_rate || 0))
      },
      {
        accessorKey: "team_a_wins",
        header: "Team A Wins"
      },
      {
        id: "team_b_wins",
        header: "Team B Wins",
        cell: ({ row }) => {
          const games = Number(row.original.games || 0);
          const teamAWins = Number(row.original.team_a_wins || 0);
          return games - teamAWins;
        }
      }
    ],
    []
  );

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between">
        <div>
          <CardTitle>Rankings Workspace</CardTitle>
          <p className="mt-1 text-xs text-fg/70">3v3 랭킹과 종족 조합 승률을 하나의 뷰에서 비교합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>Next.js + TanStack Table</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              rankingsQuery.refetch();
              raceQuery.refetch();
            }}
          >
            <RefreshCw className="mr-1 h-3 w-3" /> Refresh
          </Button>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="rankings">Rankings 3v3</TabsTrigger>
          <TabsTrigger value="race-comp">Race Composition WinRate</TabsTrigger>
        </TabsList>

        <TabsContent value="rankings" className="space-y-3">
          {rankingsQuery.isPending ? <LoadingState text="Loading rankings..." /> : null}
          {rankingsQuery.isError ? <ErrorState text={(rankingsQuery.error as Error).message} /> : null}
          {!rankingsQuery.isPending && !rankingsQuery.isError ? (
            rankingsQuery.data?.rankings?.length ? (
              <DataTable columns={rankingsColumns} data={rankingsQuery.data.rankings} pageSize={20} />
            ) : (
              <EmptyState text="NO_3V3_RANKINGS" />
            )
          ) : null}
        </TabsContent>

        <TabsContent value="race-comp" className="space-y-3">
          <Card className="p-3 text-xs font-semibold uppercase text-fg/70">
            {raceQuery.isSuccess
              ? `Team Size: 3v3 | Qualified Games: ${raceQuery.data?.qualified_games || 0} | Rows: ${raceQuery.data?.rows?.length || 0}`
              : "Loading race composition metadata..."}
          </Card>
          {raceQuery.isPending ? <LoadingState text="Loading race composition snapshot..." /> : null}
          {raceQuery.isError ? <ErrorState text={(raceQuery.error as Error).message} /> : null}
          {!raceQuery.isPending && !raceQuery.isError ? (
            raceQuery.data?.rows?.length ? (
              <DataTable columns={raceColumns} data={raceQuery.data.rows} pageSize={20} />
            ) : (
              <EmptyState text="NO_MATCHUP_DATA" />
            )
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
