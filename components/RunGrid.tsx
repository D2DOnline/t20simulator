"use client";

import { formatOvers } from "@/lib/sim/present";
import type { InningsSummary, MatchResult } from "@/lib/sim/types";

export interface SavedRun {
  id: number;
  match: MatchResult;
}

export function RunGrid({
  runs,
  activeId,
  onOpen,
  onClear,
}: {
  runs: SavedRun[];
  activeId: number | null;
  onOpen: (run: SavedRun) => void;
  onClear: () => void;
}) {
  if (runs.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-canopy/80">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-xs tracking-[0.18em] text-muted uppercase">Score grid</h2>
          <p className="mt-1 text-sm text-foam">
            {runs.length === 1 ? "1 run" : `${runs.length} runs`}. Change the setup and simulate again to add the next one.
          </p>
        </div>
        <button type="button" className="text-xs text-muted hover:text-foam" onClick={onClear}>
          Clear runs
        </button>
      </div>
      <div className="max-h-80 overflow-auto">
        <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-panel text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Run</th>
              <th className="px-3 py-2 font-medium">Bat first</th>
              <th className="px-3 py-2 font-medium">Score</th>
              <th className="px-3 py-2 font-medium">Chase</th>
              <th className="px-3 py-2 font-medium">Score</th>
              <th className="px-3 py-2 font-medium">Result</th>
              <th className="px-3 py-2 font-medium">Seed</th>
              <th className="px-3 py-2 font-medium">
                <span className="sr-only">Replay</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run, index) => {
              const active = run.id === activeId;
              const [first, second] = run.match.innings;
              return (
                <tr key={run.id} className={active ? "bg-panel-2" : "odd:bg-pitch/40"}>
                  <td className="px-3 py-2 font-condensed text-gold">{index + 1}</td>
                  <td className="px-3 py-2 text-cream">{run.match.firstBatting.shortName}</td>
                  <td className="px-3 py-2 tabular-nums text-cream">{scoreLine(first)}</td>
                  <td className="px-3 py-2 text-cream">{run.match.secondBatting.shortName}</td>
                  <td className="px-3 py-2 tabular-nums text-cream">{scoreLine(second)}</td>
                  <td className="px-3 py-2 text-foam">{run.match.margin}</td>
                  <td className="px-3 py-2 tabular-nums text-muted">{run.match.seed}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="text-xs font-semibold text-mint hover:text-cream disabled:text-muted"
                      disabled={active}
                      onClick={() => onOpen(run)}
                    >
                      {active ? "Showing" : "Open"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function scoreLine(innings: InningsSummary): string {
  return `${innings.score}/${innings.wickets} (${formatOvers(innings.legalBalls)})`;
}
