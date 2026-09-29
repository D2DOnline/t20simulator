"use client";

import { formatOvers, formatRate, inningsView } from "@/lib/sim/present";
import type { MatchResult } from "@/lib/sim/types";

export function Scorecard({
  match,
  cursor,
  innings,
  onInnings,
}: {
  match: MatchResult;
  cursor: number;
  innings: 1 | 2;
  onInnings: (innings: 1 | 2) => void;
}) {
  const view = inningsView(match, innings, cursor);

  return (
    <section className="overflow-hidden rounded-2xl bg-cream text-ink">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 px-4 py-3">
        <div>
          <h2 className="font-condensed text-2xl font-semibold">{view.teamName}</h2>
          <p className="text-xs text-ink/60">
            {view.score}/{view.wickets} ({formatOvers(view.legalBalls)} ov)
            {view.target != null ? ` · target ${view.target}` : ""}
          </p>
        </div>
        <div className="flex gap-1">
          {([1, 2] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onInnings(option)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                innings === option ? "bg-ink text-cream" : "text-ink/60 hover:text-ink"
              }`}
            >
              Inns {option}
            </button>
          ))}
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-[11px] tracking-wide text-ink/50 uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">Batter</th>
              <th className="px-2 py-2 font-medium">R</th>
              <th className="px-2 py-2 font-medium">B</th>
              <th className="px-2 py-2 font-medium">4s</th>
              <th className="px-2 py-2 font-medium">6s</th>
              <th className="px-2 py-2 font-medium">SR</th>
            </tr>
          </thead>
          <tbody>
            {view.batters.map((batter) => (
              <tr key={batter.playerId} className="border-t border-ink/10">
                <td className="px-4 py-1.5">
                  <span className={batter.atCrease ? "font-semibold" : ""}>
                    {batter.name}
                    {batter.atCrease && batter.playerId === view.strikerId ? "*" : ""}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink/50">{batter.status}</span>
                </td>
                <td className="px-2 py-1.5 tabular-nums">{batter.batted ? batter.runs : ""}</td>
                <td className="px-2 py-1.5 tabular-nums">{batter.batted ? batter.balls : ""}</td>
                <td className="px-2 py-1.5 tabular-nums">{batter.batted ? batter.fours : ""}</td>
                <td className="px-2 py-1.5 tabular-nums">{batter.batted ? batter.sixes : ""}</td>
                <td className="px-2 py-1.5 tabular-nums">{batter.batted ? batter.strikeRate.toFixed(1) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="w-full min-w-[520px] border-t border-ink/15 text-left text-sm">
          <thead className="text-[11px] tracking-wide text-ink/50 uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">Bowler</th>
              <th className="px-2 py-2 font-medium">O</th>
              <th className="px-2 py-2 font-medium">R</th>
              <th className="px-2 py-2 font-medium">W</th>
              <th className="px-2 py-2 font-medium">Econ</th>
            </tr>
          </thead>
          <tbody>
            {view.bowlers.length === 0 ? (
              <tr>
                <td className="px-4 py-2 text-ink/50" colSpan={5}>
                  No bowler has come on yet.
                </td>
              </tr>
            ) : (
              view.bowlers.map((bowler) => (
                <tr key={bowler.playerId} className="border-t border-ink/10">
                  <td className="px-4 py-1.5">{bowler.name}</td>
                  <td className="px-2 py-1.5 tabular-nums">{formatOvers(bowler.legalBalls)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{bowler.runs}</td>
                  <td className="px-2 py-1.5 tabular-nums">{bowler.wickets}</td>
                  <td className="px-2 py-1.5 tabular-nums">{formatRate(bowler.economy)}</td>
                </tr>
              ))
            )}
            <tr className="border-t border-ink/15 font-semibold">
              <td className="px-4 py-2">Total</td>
              <td className="px-2 py-2 tabular-nums" colSpan={4}>
                {view.score}/{view.wickets} ({formatOvers(view.legalBalls)} ov) · extras {view.extras}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
