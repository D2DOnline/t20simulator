"use client";

import { targetReport } from "@/lib/sim/present";
import type { MatchResult } from "@/lib/sim/types";

export function TargetReport({ match, cursor }: { match: MatchResult; cursor: number }) {
  const rows = targetReport(match, cursor);

  return (
    <section className="rounded-2xl border border-line bg-canopy/80 p-4">
      <h2 className="text-xs tracking-[0.18em] text-muted uppercase">Targets vs result</h2>
      <p className="mt-1 text-xs text-muted">Seed {match.seed}. A single match stays noisy around these marks.</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Set a batter or bowler target in the setup to track it here.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
            {rows.map((row, index) => (
            <li key={`${row.label}-${row.detail}-${index}`} className="flex items-baseline justify-between gap-3 border-b border-line/70 pb-2">
              <div>
                <p className="text-sm text-cream">{row.label}</p>
                <p className="text-xs text-muted">{row.detail}</p>
              </div>
              <p className={`font-condensed text-2xl ${toneClass(row.tone)}`}>{row.actual}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function toneClass(tone: "near" | "off" | "open"): string {
  if (tone === "near") return "text-mint";
  if (tone === "off") return "text-wicket";
  return "text-gold-2";
}
