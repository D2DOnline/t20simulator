"use client";

import { useEffect, useRef } from "react";
import type { MatchResult } from "@/lib/sim/types";

export function Commentary({
  match,
  cursor,
  innings,
}: {
  match: MatchResult;
  cursor: number;
  innings: 1 | 2;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const balls = match.balls.slice(0, cursor).filter((ball) => ball.innings === innings).slice(-12);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [cursor, innings]);

  return (
    <section className="flex h-[320px] flex-col rounded-2xl border border-line bg-canopy/80">
      <header className="border-b border-line px-4 py-3">
        <h2 className="text-xs tracking-[0.18em] text-muted uppercase">Commentary</h2>
      </header>
      <div ref={ref} className="flex flex-1 flex-col justify-end gap-3 overflow-y-auto px-4 py-3">
        {balls.length === 0 ? (
          <p className="font-serif text-sm text-muted">The field is set. The first ball is still to come.</p>
        ) : (
          balls.map((ball, index) => (
            <p key={`${ball.innings}-${ball.over}-${ball.ballInOver}-${index}`} className="font-serif text-sm leading-6 text-foam">
              <span className="mr-2 font-sans text-xs text-gold">
                {ball.over}.{ball.ballInOver + 1}
              </span>
              {ball.commentary}
            </p>
          ))
        )}
      </div>
    </section>
  );
}
