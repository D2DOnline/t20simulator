"use client";

import type { InningsView } from "@/lib/sim/present";
import { formatOvers, formatRate } from "@/lib/sim/present";
import type { MatchResult } from "@/lib/sim/types";

export function Scoreboard({
  match,
  first,
  second,
  active,
  atBreak,
  finished,
  margin,
}: {
  match: MatchResult;
  first: InningsView;
  second: InningsView;
  active: 1 | 2;
  atBreak: boolean;
  finished: boolean;
  margin: string;
}) {
  const live = active === 1 ? first : second;
  const striker = live.batters.find((batter) => batter.playerId === live.strikerId);
  const nonStriker = live.batters.find((batter) => batter.playerId === live.nonStrikerId);
  const openers = battingOpeners(match, active);

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-pitch/80">
      <div className="grid gap-px bg-line sm:grid-cols-2">
        <InningsBug view={first} featured={active === 1 && !atBreak} />
        <InningsBug view={second} featured={active === 2} waiting={second.legalBalls === 0 && second.score === 0} />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-3">
        <div>
          {live.legalBalls === 0 && live.score === 0 ? (
            <p className="text-sm text-muted">
              {openers[0]} and {openers[1]} to open for {live.teamName}.
            </p>
          ) : (
            <p className="font-condensed text-2xl text-cream">
              {striker ? (
                <>
                  {striker.name}
                  <span className="text-gold">*</span> {striker.runs} ({striker.balls})
                </>
              ) : null}
              {nonStriker ? (
                <span className="ml-4 text-muted">
                  {nonStriker.name} {nonStriker.runs} ({nonStriker.balls})
                </span>
              ) : null}
            </p>
          )}
          <p className="mt-1 text-xs tracking-wide text-muted uppercase">
            Partnership {live.partnership.runs} ({live.partnership.balls})
            {live.runsNeeded != null && !live.complete
              ? ` · Need ${live.runsNeeded} from ${120 - live.legalBalls}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Rate label="CRR" value={formatRate(live.crr)} />
          <Rate label="RRR" value={formatRate(live.rrr)} />
          <ol className="flex gap-1" aria-label="This over">
            {live.thisOver.length === 0 ? <li className="text-xs text-muted">This over</li> : null}
            {live.thisOver.map((token, index) => (
              <li
                key={`${token}-${index}`}
                className={`grid h-7 min-w-7 place-items-center rounded-md px-1 font-condensed text-sm ${tokenClass(token)}`}
              >
                {token}
              </li>
            ))}
          </ol>
        </div>
      </div>
      {atBreak ? (
        <p className="border-t border-line bg-panel px-4 py-2 text-sm text-gold-2">
          Innings break. {second.teamName} need {second.target} to win.
        </p>
      ) : null}
      {finished ? (
        <p className="border-t border-gold/30 bg-gold/10 px-4 py-2 font-condensed text-xl text-gold-2">{margin}</p>
      ) : null}
    </section>
  );
}

function InningsBug({
  view,
  featured,
  waiting,
}: {
  view: InningsView;
  featured: boolean;
  waiting?: boolean;
}) {
  return (
    <div className={`bg-pitch px-4 py-3 ${featured ? "shadow-[inset_0_-2px_0_#e6b325]" : ""}`}>
      <p className="text-xs tracking-[0.16em] text-muted uppercase">{view.teamName}</p>
      <p className="font-condensed text-4xl leading-none font-semibold text-cream">
        {waiting ? "–" : `${view.score}/${view.wickets}`}
        <span className="ml-2 text-2xl text-muted">({waiting ? "0.0" : formatOvers(view.legalBalls)})</span>
      </p>
    </div>
  );
}

function Rate({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] tracking-wide text-muted uppercase">{label}</p>
      <p className="font-condensed text-xl text-cream">{value}</p>
    </div>
  );
}

function tokenClass(token: string): string {
  if (token === "W") return "bg-wicket text-ink";
  if (token === "4" || token === "6") return "bg-gold text-ink";
  if (token === "wd" || token === "nb") return "bg-panel-2 text-gold-2";
  return "bg-panel-2 text-foam";
}

function battingOpeners(match: MatchResult, innings: 1 | 2): [string, string] {
  const team = innings === 1 ? match.firstBatting : match.secondBatting;
  return [team.players[0]?.name ?? "Opener", team.players[1]?.name ?? "Opener"];
}
