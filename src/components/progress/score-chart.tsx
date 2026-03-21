"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface ScoreChartProps {
  data: { date: string; score: number }[];
}

export function ScoreChart({ data }: ScoreChartProps) {
  if (data.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          tickCount={3}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: "12px",
            color: "hsl(var(--foreground))",
          }}
          labelStyle={{ color: "hsl(var(--muted-foreground))" }}
          formatter={(value: number | string | undefined) => [`${value ?? 0}%`, "Score"]}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="hsl(var(--foreground))"
          strokeWidth={2}
          dot={{
            fill: "hsl(var(--foreground))",
            r: 3,
            strokeWidth: 0,
          }}
          activeDot={{
            fill: "hsl(var(--foreground))",
            r: 5,
            strokeWidth: 0,
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
