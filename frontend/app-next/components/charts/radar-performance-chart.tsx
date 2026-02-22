"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip
} from "recharts";

import { Player } from "@/types/api";

const palette = ["#122a54", "#c03c1e", "#0e7b58", "#7b4ae6", "#aa6e1a", "#2b7488", "#842f6a", "#42464f"];

type Props = {
  players: Player[];
};

export function RadarPerformanceChart({ players }: Props) {
  const maxApm = Math.max(1, ...players.map((p) => Number(p.apm || 0)));
  const maxEapm = Math.max(1, ...players.map((p) => Number(p.eapm || 0)));

  const points = [
    { key: "apm", label: "APM" },
    { key: "eapm", label: "EAPM" },
    { key: "effective", label: "EFFECTIVE" },
    { key: "redundancy", label: "LOW_REDUND" }
  ].map((axis) => {
    const row: Record<string, number | string> = { axis: axis.label };
    for (const p of players) {
      if (axis.key === "apm") {
        row[p.name] = Math.round((Number(p.apm || 0) / maxApm) * 100);
      } else if (axis.key === "eapm") {
        row[p.name] = Math.round((Number(p.eapm || 0) / maxEapm) * 100);
      } else if (axis.key === "effective") {
        const cmd = Number(p.cmd_count || 0);
        const eff = Number(p.effective_cmd_count || 0);
        row[p.name] = cmd > 0 ? Math.round((eff / cmd) * 100) : 0;
      } else {
        row[p.name] = Math.max(0, 100 - Number(p.redundancy || 0));
      }
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={points} outerRadius="72%">
        <PolarGrid />
        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11 }} />
        <Tooltip />
        {players.map((player, idx) => (
          <Radar
            key={player.id}
            dataKey={player.name}
            stroke={palette[idx % palette.length]}
            fill={palette[idx % palette.length]}
            fillOpacity={0.08}
            strokeWidth={2}
          />
        ))}
      </RadarChart>
    </ResponsiveContainer>
  );
}
