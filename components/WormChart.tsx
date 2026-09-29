"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { battingTeam, wormSeries } from "@/lib/sim/present";
import type { MatchResult } from "@/lib/sim/types";

export function WormChart({
  match,
  innings,
  cursor,
}: {
  match: MatchResult;
  innings: 1 | 2;
  cursor: number;
}) {
  const average = battingTeam(match, innings).averageScore;
  const data = wormSeries(match, innings, cursor);
  const wickets = data.filter((point) => point.wicket != null);

  return (
    <section className="rounded-2xl border border-line bg-canopy/80 p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs tracking-[0.18em] text-muted uppercase">
          Worm · {battingTeam(match, innings).shortName}
        </h2>
        <div className="flex flex-wrap gap-3 text-[11px] text-muted">
          <Key swatch="bg-[#163528]" label="Powerplay" />
          <Key swatch="bg-panel" label="Middle" />
          <Key swatch="bg-[#3a3214]" label="Death" />
          <span className="text-gold">Score</span>
          <span className="text-mint">Average path</span>
        </div>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <ReferenceArea x1={0} x2={36} fill="#163528" fillOpacity={0.55} />
            <ReferenceArea x1={36} x2={90} fill="#10211a" fillOpacity={0.15} />
            <ReferenceArea x1={90} x2={120} fill="#3a3214" fillOpacity={0.35} />
            <CartesianGrid stroke="#2c4d3c" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="ball"
              type="number"
              domain={[0, 120]}
              ticks={[0, 36, 60, 90, 120]}
              tickFormatter={(ball: number) => `${Math.floor(ball / 6)}`}
              stroke="#b7c9be"
              tick={{ fill: "#b7c9be", fontSize: 12 }}
            />
            <YAxis
              domain={[0, (max: number) => Math.max(max, average, 40)]}
              stroke="#b7c9be"
              tick={{ fill: "#b7c9be", fontSize: 12 }}
              width={36}
            />
            <Tooltip
              contentStyle={{ background: "#10211a", border: "1px solid #2c4d3c", borderRadius: 8 }}
              labelFormatter={(ball) => `Over ${Math.floor(Number(ball) / 6)}.${Number(ball) % 6}`}
            />
            <Line
              dataKey="expected"
              name="Average path"
              stroke="#9ddeb5"
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
              strokeWidth={1.5}
            />
            <Line
              dataKey="score"
              name="Score"
              stroke="#e6b325"
              dot={false}
              isAnimationActive={false}
              strokeWidth={2.4}
            />
            <Scatter data={wickets} dataKey="wicket" name="Wicket" fill="#ff5d4a" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function Key({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-2.5 w-2.5 rounded-sm ${swatch}`} />
      {label}
    </span>
  );
}
