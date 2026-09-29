import type { DistributionContext } from "./distribution-context";
import { buildDistribution, sampleOutcome } from "./distribution";
import {
  RUN_OUT_SHARE,
  activeBatterTarget,
  activeWicketTarget,
  ballsPlanned,
  inningsWicketScale,
  phaseWeight,
  scoringPlan,
} from "./modifiers";
import { phaseOfOver } from "./priors";
import { mulberry32 } from "./rng";
import type {
  BallEvent,
  InningsSummary,
  MatchConfig,
  MatchResult,
  Outcome,
  Player,
  Side,
  TeamConfig,
} from "./types";

interface InningsState {
  score: number;
  wickets: number;
  legalBalls: number;
  extras: number;
  strikerIdx: number;
  nonStrikerIdx: number;
  nextIdx: number;
  ballsSinceWicket: number;
  batRuns: number[];
  batBalls: number[];
  bowlerBalls: Map<string, number>;
  bowlerWickets: Map<string, number>;
}

export function simulateMatch(config: MatchConfig, seed = config.seed): MatchResult {
  const rng = mulberry32(seed);
  const teamA = prefixTeam(config.teamA, "a");
  const teamB = prefixTeam(config.teamB, "b");
  const firstKey = config.battingFirst;
  const firstBatting = firstKey === "A" ? teamA : teamB;
  const secondBatting = firstKey === "A" ? teamB : teamA;
  const allowHigh = config.allowHighWicketTargets ?? false;

  const first = simulateInnings({
    batting: firstBatting,
    bowling: secondBatting,
    battingKey: firstKey,
    innings: 1,
    rng,
    allowHigh,
  });

  const target = first.summary.score + 1;
  const secondKey: Side = firstKey === "A" ? "B" : "A";
  const second = simulateInnings({
    batting: secondBatting,
    bowling: firstBatting,
    battingKey: secondKey,
    innings: 2,
    rng,
    allowHigh,
    target,
  });

  const balls = [...first.balls, ...second.balls];
  let winner: Side | "tie" = "tie";
  let margin = "Match tied";
  if (second.summary.score >= target) {
    winner = secondKey;
    const left = 10 - second.summary.wickets;
    margin = `${secondBatting.name} won by ${left} wicket${left === 1 ? "" : "s"}`;
  } else if (second.summary.score < first.summary.score) {
    winner = firstKey;
    const runs = first.summary.score - second.summary.score;
    margin = `${firstBatting.name} won by ${runs} run${runs === 1 ? "" : "s"}`;
  }

  return {
    seed,
    battingFirst: firstKey,
    firstBatting,
    secondBatting,
    balls,
    innings: [first.summary, second.summary],
    winner,
    margin,
    allowHighWicketTargets: allowHigh,
  };
}

function simulateInnings(args: {
  batting: TeamConfig;
  bowling: TeamConfig;
  battingKey: Side;
  innings: 1 | 2;
  rng: () => number;
  allowHigh: boolean;
  target?: number;
}): { balls: BallEvent[]; summary: InningsSummary } {
  const { batting, bowling, rng } = args;
  const plan = scoringPlan(batting);
  const wicketScale = inningsWicketScale(bowling, args.allowHigh);
  const state: InningsState = {
    score: 0,
    wickets: 0,
    legalBalls: 0,
    extras: 0,
    strikerIdx: 0,
    nonStrikerIdx: 1,
    nextIdx: 2,
    ballsSinceWicket: 99,
    batRuns: batting.players.map(() => 0),
    batBalls: batting.players.map(() => 0),
    bowlerBalls: new Map(),
    bowlerWickets: new Map(),
  };
  const balls: BallEvent[] = [];

  while (state.legalBalls < 120 && state.wickets < 10) {
    if (args.target != null && state.score >= args.target) break;

    const over = Math.floor(state.legalBalls / 6);
    const ballInOver = state.legalBalls % 6;
    const bowler = requirePlayer(bowling, bowling.bowlingPlan[over]);
    const striker = batting.players[state.strikerIdx];
    const nonStriker = batting.players[state.nonStrikerIdx];
    const ballsRemaining = 120 - state.legalBalls;
    const requiredRuns = args.target != null ? args.target - state.score : undefined;
    const rrr =
      requiredRuns != null && ballsRemaining > 0 ? (requiredRuns * 6) / ballsRemaining : undefined;

    const ctx: DistributionContext = {
      phase: phaseOfOver(over),
      batter: striker,
      bowler,
      wickets: state.wickets,
      strikerBalls: state.batBalls[state.strikerIdx],
      strikerRuns: state.batRuns[state.strikerIdx],
      ballsSinceWicket: state.ballsSinceWicket,
      residualRpb: plan.residualRpb,
      batterTarget: activeBatterTarget(batting.targets, striker.id, striker.batting.strikeRate),
      bowlerTargetWickets: activeWicketTarget(bowling.targets, bowler.id),
      bowlerBallsPlanned: ballsPlanned(bowling, bowler.id),
      bowlerWickets: state.bowlerWickets.get(bowler.id) ?? 0,
      remainingPhaseWeights: remainingWeights(bowling, bowler, over, ballInOver),
      inningsWicketScale: wicketScale,
      rrr,
      requiredRuns,
      ballsRemaining,
      innings: args.innings,
    };

    const outcome = sampleOutcome(buildDistribution(ctx), rng);
    balls.push(applyDelivery({ args, state, outcome, over, ballInOver, bowler, striker, nonStriker, rng }));
  }

  return {
    balls,
    summary: {
      battingKey: args.battingKey,
      battingTeamName: batting.name,
      bowlingTeamName: bowling.name,
      score: state.score,
      wickets: state.wickets,
      legalBalls: state.legalBalls,
      extras: state.extras,
      allOut: state.wickets >= 10,
      target: args.target,
    },
  };
}

function applyDelivery(input: {
  args: { innings: 1 | 2; target?: number; batting: TeamConfig };
  state: InningsState;
  outcome: Outcome;
  over: number;
  ballInOver: number;
  bowler: Player;
  striker: Player;
  nonStriker: Player;
  rng: () => number;
}): BallEvent {
  const { state, outcome, bowler, striker, nonStriker, rng } = input;
  const batting = input.args.batting;
  let legal = true;
  let batRuns = 0;
  let extraRuns = 0;
  let wicket = false;
  let creditsBowler = false;
  let dismissal: string | undefined;
  let dismissedId: string | undefined;

  if (outcome === "Wd" || outcome === "Nb") {
    legal = false;
    extraRuns = 1;
    state.score += 1;
    state.extras += 1;
  } else {
    state.legalBalls += 1;
    state.ballsSinceWicket += 1;
    state.batBalls[state.strikerIdx] += 1;
    state.bowlerBalls.set(bowler.id, (state.bowlerBalls.get(bowler.id) ?? 0) + 1);

    if (outcome === "W") {
      wicket = true;
      state.wickets += 1;
      state.ballsSinceWicket = 0;
      const kind = sampleDismissal(rng, phaseOfOver(input.over));
      dismissal = kind.label;
      creditsBowler = kind.creditsBowler;
      dismissedId = striker.id;
      if (creditsBowler) {
        state.bowlerWickets.set(bowler.id, (state.bowlerWickets.get(bowler.id) ?? 0) + 1);
      }
      if (state.wickets < 10) {
        state.strikerIdx = state.nextIdx;
        state.nextIdx += 1;
      }
      if (state.legalBalls % 6 === 0) swapEnds(state);
    } else {
      batRuns = outcome;
      state.score += batRuns;
      state.batRuns[state.strikerIdx] += batRuns;
      if (batRuns % 2 === 1) swapEnds(state);
      if (state.legalBalls % 6 === 0) swapEnds(state);
    }
  }

  const nextStriker = batting.players[state.strikerIdx];
  const nextNonStriker = batting.players[state.nonStrikerIdx];

  return {
    innings: input.args.innings,
    over: input.over,
    ballInOver: input.ballInOver,
    legal,
    bowlerId: bowler.id,
    bowlerName: bowler.name,
    strikerId: striker.id,
    strikerName: striker.name,
    nonStrikerId: nonStriker.id,
    nonStrikerName: nonStriker.name,
    nextStrikerId: nextStriker?.id ?? striker.id,
    nextStrikerName: nextStriker?.name ?? striker.name,
    nextNonStrikerId: nextNonStriker?.id ?? nonStriker.id,
    nextNonStrikerName: nextNonStriker?.name ?? nonStriker.name,
    outcome,
    runs: batRuns + extraRuns,
    batRuns,
    extraRuns,
    wicket,
    creditsBowler,
    dismissal,
    dismissedId,
    score: state.score,
    wickets: state.wickets,
    legalBalls: state.legalBalls,
    commentary: describe(rng, outcome, striker.name, bowler.name, dismissal),
    target: input.args.target,
  };
}

function sampleDismissal(
  rng: () => number,
  phase: ReturnType<typeof phaseOfOver>,
): { label: string; creditsBowler: boolean } {
  const u = rng();
  if (u < RUN_OUT_SHARE) return { label: "run out", creditsBowler: false };
  const credited = (u - RUN_OUT_SHARE) / (1 - RUN_OUT_SHARE);
  if (phase === "powerplay") {
    if (credited < 0.5) return { label: "caught", creditsBowler: true };
    if (credited < 0.72) return { label: "bowled", creditsBowler: true };
    if (credited < 0.88) return { label: "lbw", creditsBowler: true };
    return { label: "caught behind", creditsBowler: true };
  }
  if (phase === "death") {
    if (credited < 0.34) return { label: "caught", creditsBowler: true };
    if (credited < 0.58) return { label: "bowled", creditsBowler: true };
    if (credited < 0.78) return { label: "lbw", creditsBowler: true };
    return { label: "caught behind", creditsBowler: true };
  }
  if (credited < 0.4) return { label: "caught", creditsBowler: true };
  if (credited < 0.66) return { label: "bowled", creditsBowler: true };
  if (credited < 0.86) return { label: "lbw", creditsBowler: true };
  return { label: "caught behind", creditsBowler: true };
}

function describe(
  rng: () => number,
  outcome: Outcome,
  strikerName: string,
  bowlerName: string,
  dismissal?: string,
): string {
  const batter = lastName(strikerName);
  const attack = lastName(bowlerName);
  const pick = (lines: string[]) => lines[Math.floor(rng() * lines.length) % lines.length];

  if (outcome === "Wd") return pick([`${attack} strays down the leg side. Wide.`, `Wide from ${attack}.`]);
  if (outcome === "Nb") return pick([`No ball by ${attack}.`, `${attack} oversteps. No ball.`]);
  if (outcome === "W") {
    if (dismissal === "run out") return `${batter} is run out.`;
    if (dismissal === "bowled") return `${attack} bowls ${batter}.`;
    if (dismissal === "lbw") return `${batter} is lbw to ${attack}.`;
    if (dismissal === "caught behind") return `${batter} edges ${attack} and is caught behind.`;
    return `${batter} is caught off the bowling of ${attack}.`;
  }
  if (outcome === 0) {
    return pick([
      `${attack} to ${batter}, no run.`,
      `Dot ball. ${batter} defends ${attack}.`,
      `${batter} lets it go through to the keeper.`,
    ]);
  }
  if (outcome === 1) return pick([`${batter} works ${attack} for a single.`, `One run to ${batter}.`]);
  if (outcome === 2) return pick([`${batter} places it into the gap for two.`, `They come back for two.`]);
  if (outcome === 3) return `${batter} splits the field and they run three.`;
  if (outcome === 4) {
    return pick([
      `${batter} finds the boundary off ${attack}. Four.`,
      `Four! ${batter} pierces the infield.`,
    ]);
  }
  return pick([
    `${batter} goes the distance off ${attack}. Six!`,
    `Six. ${batter} clears the rope.`,
  ]);
}

function remainingWeights(team: TeamConfig, bowler: Player, over: number, ballInOver: number): number[] {
  const weights: number[] = [];
  for (let slot = over; slot < team.bowlingPlan.length; slot++) {
    if (team.bowlingPlan[slot] !== bowler.id) continue;
    const start = slot === over ? ballInOver : 0;
    for (let ball = start; ball < 6; ball++) weights.push(phaseWeight(bowler, slot));
  }
  return weights.length > 0 ? weights : [1];
}

function swapEnds(state: InningsState) {
  const swap = state.strikerIdx;
  state.strikerIdx = state.nonStrikerIdx;
  state.nonStrikerIdx = swap;
}

function prefixTeam(team: TeamConfig, prefix: string): TeamConfig {
  const map = new Map(team.players.map((player) => [player.id, `${prefix}:${player.id}`]));
  return {
    ...team,
    id: `${prefix}:${team.id}`,
    players: team.players.map((player) => ({ ...player, id: map.get(player.id) ?? player.id })),
    bowlingPlan: team.bowlingPlan.map((id) => map.get(id) ?? id),
    targets: team.targets.map((target) => ({
      ...target,
      playerId: map.get(target.playerId) ?? target.playerId,
    })),
  };
}

function requirePlayer(team: TeamConfig, id: string): Player {
  const player = team.players.find((entry) => entry.id === id);
  if (!player) throw new Error(`Bowling plan for ${team.name} references unknown player ${id}`);
  return player;
}

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}
