"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { APMTimeline } from "@/types/api";

const palette = ["#122a54", "#c03c1e", "#0e7b58", "#7b4ae6", "#aa6e1a", "#2b7488", "#842f6a", "#42464f"];

type Props = {
  timelines: APMTimeline[];
};

export function APMLineChart({ timelines }: Props) {
  const frameSet = new Set<number>();
  for (const line of timelines) {
    for (const point of line.data_points || []) {
      frameSet.add(Number(point.frame || 0));
    }
  }

  const frames = Array.from(frameSet).sort((a, b) => a - b);
  const rows = frames.map((frame) => {
    const row: Record<string, number | string> = { frame };
    for (const line of timelines) {
      const found = line.data_points.find((point) => Number(point.frame || 0) === frame);
      row[line.player_name] = Number(found?.apm || 0);
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#c9cad1" />
        <XAxis dataKey="frame" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        {timelines.map((line, idx) => (
          <Line
            key={line.player_name}
            type="monotone"
            dataKey={line.player_name}
            stroke={palette[idx % palette.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
