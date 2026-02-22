"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { ResourceSpend } from "@/types/api";

type Props = {
  spend: ResourceSpend;
  playerName?: string;
};

export function SpendTimelineChart({ spend, playerName }: Props) {
  const timeline = (spend.timelines || []).find((line) =>
    playerName ? line.player_name === playerName : true
  );

  const rows = (timeline?.data_points || []).map((point) => ({
    second: Math.round(Number(point.second || 0)),
    mineral: Number(point.mineral || 0),
    gas: Number(point.gas || 0),
    total: Number(point.total || 0)
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#c9cad1" />
        <XAxis dataKey="second" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="mineral" stackId="spend" fill="#1d4ed8" />
        <Bar dataKey="gas" stackId="spend" fill="#d97706" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
