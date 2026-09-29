import type { BallEvent, MatchResult, Player, TeamConfig } from "./types";

export interface BatterLine {
  playerId: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  status: string;
  strikeRate: number;
  batted: boolean;
  atCrease: boolean;
}

export interface BowlerLine {
  playerId: string;
  name: string;
  legalBalls: number;
  runs: number;
  wickets: number;
  wides: number;
  noBalls: number;
  economy: number;
}

export interface InningsView {
  innings: 1 | 2;
  teamName: string;
  opponentName: string;
  score: number;
  wickets: number;
  legalBalls: number;
  extras: number;
  target?: number;
  complete: boolean;
  strikerId?: string;
  nonStrikerId?: string;
  partnership: { runs: number; balls: number };
  thisOver: string[];
  batters: BatterLine[];
  bowlers: BowlerLine[];
  crr: number | null;
  rrr: number | null;
  runsNeeded: number | null;
}

export interface TargetRow {
  label: string;
  detail: string;
  actual: string;
  tone: "near" | "off" | "open";
}

export function formatOvers(legalBalls: number): string {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}

export function formatRate(rate: number | null): string {
  if (rate == null || !Number.isFinite(rate)) return "–";
  return rate.toFixed(2);
}

export function battingTeam(result: MatchResult, innings: 1 | 2): TeamConfig {
  return innings === 1 ? result.firstBatting : result.secondBatting;
}

export function bowlingTeam(result: MatchResult, innings: 1 | 2): TeamConfig {
  return innings === 1 ? result.secondBatting : result.firstBatting;
}

export function inningsStart(balls: BallEvent[], innings: 1 | 2): number {
  return balls.findIndex((ball) => ball.innings === innings);
}

export function revealed(result: MatchResult, cursor: number): BallEvent[] {
  return result.balls.slice(0, Math.max(0, Math.min(cursor, result.balls.length)));
}

export function inningsView(result: MatchResult, innings: 1 | 2, cursor: number): InningsView {
  const balls = revealed(result, cursor).filter((ball) => ball.innings === innings);
  const batting = battingTeam(result, innings);
  const bowling = bowlingTeam(result, innings);
  const last = balls[balls.length - 1];
  const summary = result.innings[innings - 1];
  const complete = isComplete(balls, summary.target);
  const batters = battingCard(batting, balls, last, complete);
  const bowlers = bowlingCard(bowling, balls);

  let partnershipRuns = 0;
  let partnershipBalls = 0;
  for (let i = balls.length - 1; i >= 0; i--) {
    const ball = balls[i];
    if (ball.wicket) break;
    partnershipRuns += ball.runs;
    if (ball.legal) partnershipBalls += 1;
  }

  const overBalls = last ? balls.filter((ball) => ball.over === last.over) : [];
  const score = last?.score ?? 0;
  const wickets = last?.wickets ?? 0;
  const legalBalls = last?.legalBalls ?? 0;
  const extras = balls.reduce((sum, ball) => sum + ball.extraRuns, 0);
  const crr = legalBalls > 0 ? score / (legalBalls / 6) : null;
  const ballsLeft = 120 - legalBalls;
  const runsNeeded = summary.target != null ? Math.max(0, summary.target - score) : null;
  const rrr = runsNeeded != null && ballsLeft > 0 && !complete ? runsNeeded / (ballsLeft / 6) : null;

  return {
    innings,
    teamName: batting.name,
    opponentName: bowling.name,
    score,
    wickets,
    legalBalls,
    extras,
    target: summary.target,
    complete,
    strikerId: complete ? undefined : last?.nextStrikerId,
    nonStrikerId: complete ? undefined : last?.nextNonStrikerId,
    partnership: { runs: partnershipRuns, balls: partnershipBalls },
    thisOver: overBalls.map(ballToken),
    batters,
    bowlers,
    crr,
    rrr,
    runsNeeded,
  };
}

export function wormSeries(result: MatchResult, innings: 1 | 2, cursor: number) {
  const average = battingTeam(result, innings).averageScore;
  const points: { ball: number; score: number; expected: number; wicket: number | null }[] = [
    { ball: 0, score: 0, expected: 0, wicket: null },
  ];
  for (const ball of revealed(result, cursor)) {
    if (ball.innings !== innings) continue;
    points.push({
      ball: ball.legalBalls,
      score: ball.score,
      expected: (average * ball.legalBalls) / 120,
      wicket: ball.wicket ? ball.score : null,
    });
  }
  return points;
}

export function targetReport(result: MatchResult, cursor: number): TargetRow[] {
  const rows: TargetRow[] = [];
  ([1, 2] as const).forEach((innings) => {
    const view = inningsView(result, innings, cursor);
    const batting = battingTeam(result, innings);
    const bowling = bowlingTeam(result, innings);
    if (view.legalBalls === 0 && view.score === 0 && innings === 2 && cursor < inningsStart(result.balls, 2)) {
      return;
    }
    rows.push({
      label: `${batting.shortName} total`,
      detail: `average ${batting.averageScore}`,
      actual: view.legalBalls === 0 && view.score === 0 ? "–" : String(view.score),
      tone: toneFor(view.score, batting.averageScore, view.complete),
    });

    for (const target of batting.targets) {
      if ((target.runs ?? 0) <= 0) continue;
      const player = batting.players.find((entry) => entry.id === target.playerId);
      const line = view.batters.find((entry) => entry.playerId === target.playerId);
      const actual = line?.batted ? `${line.runs} (${line.balls})` : "–";
      const spellDone = Boolean(line?.batted && (view.complete || line.status !== "not out"));
      const detail = (target.balls ?? 0) > 0 ? `${target.runs} off ${target.balls}` : `${target.runs} runs`;
      rows.push({
        label: player?.name ?? "Batter",
        detail,
        actual,
        tone: line?.batted && spellDone ? toneFor(line.runs, target.runs ?? 0, true) : "open",
      });
    }

    for (const target of bowling.targets) {
      if ((target.wickets ?? 0) <= 0) continue;
      const player = bowling.players.find((entry) => entry.id === target.playerId);
      const line = view.bowlers.find((entry) => entry.playerId === target.playerId);
      const planned = bowling.bowlingPlan.filter((id) => id === target.playerId).length * 6;
      const spellDone = view.complete || (line?.legalBalls ?? 0) >= planned;
      const actual = line ? String(line.wickets) : "–";
      rows.push({
        label: `${player?.name ?? "Bowler"} wickets`,
        detail: `${target.wickets} wickets`,
        actual,
        tone: line && spellDone ? toneFor(line.wickets, target.wickets ?? 0, true) : "open",
      });
    }
  });
  return rows;
}

function battingCard(team: TeamConfig, balls: BallEvent[], last: BallEvent | undefined, complete: boolean): BatterLine[] {
  const stats = new Map<string, BatterLine>();
  for (const player of team.players) {
    stats.set(player.id, {
      playerId: player.id,
      name: player.name,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      status: "yet to bat",
      strikeRate: 0,
      batted: false,
      atCrease: false,
    });
  }

  for (const ball of balls) {
    const line = stats.get(ball.strikerId);
    if (!line) continue;
    line.batted = true;
    if (ball.legal) {
      line.balls += 1;
      line.runs += ball.batRuns;
      if (ball.outcome === 4) line.fours += 1;
      if (ball.outcome === 6) line.sixes += 1;
    }
    if (ball.wicket && ball.dismissedId === ball.strikerId) {
      line.status = dismissalText(ball);
      line.atCrease = false;
    }
  }

  const crease = new Set<string>();
  if (!complete && last) {
    crease.add(last.nextStrikerId);
    crease.add(last.nextNonStrikerId);
  }

  for (const line of stats.values()) {
    if (!line.batted) {
      line.status = complete ? "did not bat" : "yet to bat";
      continue;
    }
    line.strikeRate = line.balls > 0 ? (line.runs / line.balls) * 100 : 0;
    if (line.status === "yet to bat") {
      line.atCrease = crease.has(line.playerId);
      line.status = "not out";
    }
  }

  return team.players.map((player) => stats.get(player.id)!);
}

function bowlingCard(team: TeamConfig, balls: BallEvent[]): BowlerLine[] {
  const order: string[] = [];
  const stats = new Map<string, BowlerLine>();
  const ensure = (player: Player) => {
    let line = stats.get(player.id);
    if (!line) {
      line = {
        playerId: player.id,
        name: player.name,
        legalBalls: 0,
        runs: 0,
        wickets: 0,
        wides: 0,
        noBalls: 0,
        economy: 0,
      };
      stats.set(player.id, line);
      order.push(player.id);
    }
    return line;
  };

  for (const ball of balls) {
    const player = team.players.find((entry) => entry.id === ball.bowlerId);
    if (!player) continue;
    const line = ensure(player);
    line.runs += ball.runs;
    if (ball.legal) line.legalBalls += 1;
    if (ball.outcome === "Wd") line.wides += 1;
    if (ball.outcome === "Nb") line.noBalls += 1;
    if (ball.wicket && ball.creditsBowler) line.wickets += 1;
  }

  for (const line of stats.values()) {
    line.economy = line.legalBalls > 0 ? line.runs / (line.legalBalls / 6) : 0;
  }

  return order.map((id) => stats.get(id)!);
}

function isComplete(balls: BallEvent[], target?: number): boolean {
  const last = balls[balls.length - 1];
  if (!last) return false;
  if (last.wickets >= 10) return true;
  if (last.legalBalls >= 120) return true;
  if (target != null && last.score >= target) return true;
  return false;
}

function dismissalText(ball: BallEvent): string {
  const bowler = lastName(ball.bowlerName);
  if (ball.dismissal === "run out") return "run out";
  if (ball.dismissal === "bowled") return `b ${bowler}`;
  if (ball.dismissal === "lbw") return `lbw b ${bowler}`;
  if (ball.dismissal === "caught behind") return `c † b ${bowler}`;
  return `c b ${bowler}`;
}

function ballToken(ball: BallEvent): string {
  if (ball.outcome === "Wd") return "wd";
  if (ball.outcome === "Nb") return "nb";
  if (ball.outcome === "W") return "W";
  if (ball.outcome === 0) return "·";
  return String(ball.outcome);
}

function toneFor(actual: number, target: number, settled: boolean): TargetRow["tone"] {
  if (!settled) return "open";
  const gap = Math.abs(actual - target);
  const tolerance = Math.max(5, target * 0.15);
  return gap <= tolerance ? "near" : "off";
}

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}
