"use client";

import { useEffect, useRef, useState } from "react";
import { defaultConfig, TEAMS } from "@/data/teams";
import type { BallEvent } from "@/lib/sim/types";
import { simulateMatch } from "@/lib/sim/engine";
import { inningsStart, inningsView } from "@/lib/sim/present";
import type { MatchResult, Side, TeamConfig } from "@/lib/sim/types";
import { Commentary } from "./Commentary";
import { PlaybackControls, type PlaybackSpeed } from "./PlaybackControls";
import { Scoreboard } from "./Scoreboard";
import { RunGrid, type SavedRun } from "./RunGrid";
import { Scorecard } from "./Scorecard";
import { SetupForm } from "./SetupForm";
import { TargetReport } from "./TargetReport";
import { WormChart } from "./WormChart";

export function MatchApp() {
  const initial = defaultConfig(184726);
  const [teamA, setTeamA] = useState<TeamConfig>(initial.teamA);
  const [teamB, setTeamB] = useState<TeamConfig>(initial.teamB);
  const [battingFirst, setBattingFirst] = useState<Side>("A");
  const [seed, setSeed] = useState(initial.seed);
  const [allowHigh, setAllowHigh] = useState(false);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [runs, setRuns] = useState<SavedRun[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const nextRunId = useRef(1);
  const [stage, setStage] = useState<"setup" | "replay">("setup");
  const [cursor, setCursor] = useState(0);
  const cursorRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>("1x");
  const [pinnedInnings, setPinnedInnings] = useState<1 | 2 | null>(null);
  const revealedInnings: 1 | 2 =
    match && cursor > 0 ? match.balls[Math.min(cursor, match.balls.length) - 1].innings : 1;
  const cardInnings = pinnedInnings ?? revealedInnings;

  function placeCursor(next: number) {
    cursorRef.current = next;
    setCursor(next);
  }

  function run(nextSeed = seed) {
    const result = simulateMatch({
      teamA,
      teamB,
      battingFirst,
      seed: nextSeed,
      allowHighWicketTargets: allowHigh,
    });
    const id = nextRunId.current;
    nextRunId.current += 1;
    setSeed(nextSeed);
    setMatch(result);
    setRuns((current) => [...current, { id, match: result }]);
    setActiveId(id);
    placeCursor(0);
    setPlaying(false);
    setPinnedInnings(null);
    setStage("replay");
  }

  function openRun(run: SavedRun) {
    setMatch(run.match);
    setActiveId(run.id);
    placeCursor(0);
    setPlaying(false);
    setPinnedInnings(null);
    setStage("replay");
  }

  useEffect(() => {
    if (!playing || !match) return;
    const delay = speed === "4x" ? 110 : speed === "over" ? 680 : 460;
    const id = window.setInterval(() => {
      const current = cursorRef.current;
      if (current >= match.balls.length) {
        setPlaying(false);
        return;
      }
      const step = speed === "over" ? endOfOver(match.balls, current) : current + 1;
      const next = Math.min(step, match.balls.length);
      cursorRef.current = next;
      setCursor(next);
      if (next >= match.balls.length) setPlaying(false);
    }, delay);
    return () => window.clearInterval(id);
  }, [playing, speed, match]);

  return (
    <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-gold">
            <Stumps />
            <p className="text-xs font-semibold tracking-[0.22em] uppercase">Floodlit T20</p>
          </div>
          <h1 className="font-condensed text-5xl leading-none font-semibold tracking-tight text-cream sm:text-6xl">
            Match simulator
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Preset squads, editable targets, and a seeded ball-by-ball replay. Change the setup and simulate again to
            compare scores. Ratings are illustrative T20 rates.
          </p>
        </div>
        {stage === "replay" && match ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full border border-line px-4 py-2 text-sm text-foam hover:bg-panel"
              onClick={() => {
                setPlaying(false);
                setStage("setup");
              }}
            >
              Edit setup
            </button>
            <button
              type="button"
              className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink hover:bg-gold-2"
              onClick={() => run(Math.floor(Math.random() * 1_000_000_000))}
            >
              New seed
            </button>
          </div>
        ) : null}
      </header>

      <RunGrid
        runs={runs}
        activeId={stage === "replay" ? activeId : null}
        onOpen={openRun}
        onClear={() => {
          setRuns([]);
          setActiveId(null);
        }}
      />

      {stage === "setup" || !match ? (
        <SetupForm
          teams={TEAMS}
          teamA={teamA}
          teamB={teamB}
          battingFirst={battingFirst}
          seed={seed}
          allowHigh={allowHigh}
          hasReplay={match != null}
          onTeamA={setTeamA}
          onTeamB={setTeamB}
          onBattingFirst={setBattingFirst}
          onSeed={setSeed}
          onAllowHigh={setAllowHigh}
          onSimulate={() => run(seed)}
          onReturn={() => setStage("replay")}
        />
      ) : (
        <Replay
          match={match}
          cursor={cursor}
          playing={playing}
          speed={speed}
          cardInnings={cardInnings}
          onCursor={placeCursor}
          onPlaying={(next) => {
            if (next) setPinnedInnings(null);
            setPlaying(next);
          }}
          onSpeed={setSpeed}
          onCardInnings={setPinnedInnings}
        />
      )}
    </main>
  );
}

function Replay({
  match,
  cursor,
  playing,
  speed,
  cardInnings,
  onCursor,
  onPlaying,
  onSpeed,
  onCardInnings,
}: {
  match: MatchResult;
  cursor: number;
  playing: boolean;
  speed: PlaybackSpeed;
  cardInnings: 1 | 2;
  onCursor: (cursor: number) => void;
  onPlaying: (playing: boolean) => void;
  onSpeed: (speed: PlaybackSpeed) => void;
  onCardInnings: (innings: 1 | 2) => void;
}) {
  const breakAt = Math.max(0, inningsStart(match.balls, 2));
  const activeInnings: 1 | 2 = cursor === 0 ? 1 : match.balls[Math.min(cursor, match.balls.length) - 1].innings;
  const first = inningsView(match, 1, cursor);
  const second = inningsView(match, 2, cursor);
  const atBreak = cursor === breakAt && cursor > 0;
  const finished = cursor >= match.balls.length;

  return (
    <div className="flex flex-col gap-4">
      <Scoreboard
        match={match}
        first={first}
        second={second}
        active={activeInnings}
        atBreak={atBreak}
        finished={finished}
        margin={match.margin}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <WormChart match={match} innings={activeInnings} cursor={cursor} />
        <Commentary match={match} cursor={cursor} innings={activeInnings} />
      </div>
      <PlaybackControls
        playing={playing}
        speed={speed}
        cursor={cursor}
        total={match.balls.length}
        onPlay={() => onPlaying(true)}
        onPause={() => onPlaying(false)}
        onSpeed={onSpeed}
        onScrub={onCursor}
        onInningsBreak={() => onCursor(breakAt)}
        onEnd={() => onCursor(match.balls.length)}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.7fr)]">
        <Scorecard match={match} cursor={cursor} innings={cardInnings} onInnings={onCardInnings} />
        <TargetReport match={match} cursor={cursor} />
      </div>
    </div>
  );
}

function endOfOver(balls: BallEvent[], cursor: number): number {
  if (cursor >= balls.length) return balls.length;
  const start = balls[cursor];
  let index = cursor;
  while (index < balls.length && balls[index].innings === start.innings && balls[index].over === start.over) {
    index += 1;
  }
  return index;
}

function Stumps() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <rect x="6" y="5" width="2.2" height="17" fill="currentColor" />
      <rect x="13" y="5" width="2.2" height="17" fill="currentColor" />
      <rect x="20" y="5" width="2.2" height="17" fill="currentColor" />
      <rect x="5" y="7" width="18" height="2.2" rx="0.4" fill="#f3d48a" />
    </svg>
  );
}
