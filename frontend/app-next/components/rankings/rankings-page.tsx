"use client";

import { useState } from "react";

import {
  RaceCompositionTable,
  RankingsTable,
  type RankingsPageViewModel,
  type RankingsSortBy,
  type RaceSortBy
} from "@/components/rankings/rankings-tables";

export function RankingsPage({ model }: { model: RankingsPageViewModel }) {
  const [activeTab, setActiveTab] = useState<"rankings" | "race_comp">("rankings");
  const [rankingsSortBy, setRankingsSortBy] = useState<RankingsSortBy>("win_rate");
  const [rankingsSortDesc, setRankingsSortDesc] = useState(true);
  const [raceSortBy, setRaceSortBy] = useState<RaceSortBy>("games");
  const [raceSortDesc, setRaceSortDesc] = useState(true);
  const currentUser = model.currentUser;

  function updateRankingsSort(nextSortBy: RankingsSortBy) {
    if (rankingsSortBy === nextSortBy) {
      setRankingsSortDesc((current) => !current);
      return;
    }

    setRankingsSortBy(nextSortBy);
    setRankingsSortDesc(true);
  }

  function updateRaceSort(nextSortBy: RaceSortBy) {
    if (raceSortBy === nextSortBy) {
      setRaceSortDesc((current) => !current);
      return;
    }

    setRaceSortBy(nextSortBy);
    setRaceSortDesc(true);
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-6 flex gap-2">
        {model.tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className="rounded-lg px-5 py-2 text-xs font-mono font-bold tracking-wider transition-all"
            style={{
              backgroundColor: activeTab === tab.id ? "rgba(34,211,238,0.12)" : "#0d1833",
              color: activeTab === tab.id ? "#22d3ee" : "#475569",
              border: `1px solid ${activeTab === tab.id ? "rgba(34,211,238,0.3)" : "rgba(255,255,255,0.08)"}`
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "rankings" ? (
        <RankingsTable
          model={model}
          currentUser={currentUser}
          sortBy={rankingsSortBy}
          sortDesc={rankingsSortDesc}
          onSortChange={updateRankingsSort}
        />
      ) : (
        <RaceCompositionTable
          model={model}
          currentUser={currentUser}
          sortBy={raceSortBy}
          sortDesc={raceSortDesc}
          onSortChange={updateRaceSort}
        />
      )}
    </div>
  );
}
