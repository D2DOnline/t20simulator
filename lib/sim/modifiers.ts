import type { DistributionContext } from "./distribution-context";
import { PHASE_PRIORS, phaseOfOver } from "./priors";
import type { Dist, Player, PlayerTarget, TeamConfig } from "./types";

export const RUN_OUT_SHARE = 0.1;
const RATIO_MIN = 0.35;
const RATIO_MAX = 3.2;

export interface ScoringPlan {
  residualRpb: number;
  warning: string | null;
  targetedRuns: number;
}

export function scoringPlan(team: TeamConfig): ScoringPlan {
  const targeted = team.targets.filter((target) => (target.runs ?? 0) > 0);
  const targetedRuns = targeted.reduce((sum, target) => sum + (target.runs ?? 0), 0);
  const targetedBalls = targeted.reduce((sum, target) => {
    if ((target.balls ?? 0) > 0) return sum + (target.balls ?? 0);
    return sum + Math.max(1, Math.round((target.runs ?? 0) / 1.3));
  }, 0);
  const warning =
    targetedRuns > team.averageScore
      ? `Batter targets sum to ${targetedRuns}, above the team average of ${team.averageScore}. The sim will favor those batters and the total may overshoot.`
      : null;

  if (targeted.length === 0) {
    return { residualRpb: team.averageScore / 120, warning, targetedRuns };
  }

  const remainingBalls = Math.max(18, 120 - targetedBalls);
  const remainingRuns = team.averageScore - targetedRuns;
  const residualRpb =
    remainingRuns > 0 ? remainingRuns / remainingBalls : (team.averageScore / 120) * 0.75;

  return { residualRpb, warning, targetedRuns };
}

export function targetWarning(team: TeamConfig): string | null {
  return scoringPlan(team).warning;
}

/** Expected wickets from the bowling plan, using targets where they exist. */
export function expectedInningsWickets(team: TeamConfig): number {
  const counts = new Map<string, number>();
  for (const bowlerId of team.bowlingPlan) {
    counts.set(bowlerId, (counts.get(bowlerId) ?? 0) + 6);
  }

  let expected = 0;
  for (const [bowlerId, balls] of counts) {
    const target = team.targets.find(
      (entry) => entry.playerId === bowlerId && (entry.wickets ?? 0) > 0,
    );
    if (target?.wickets) {
      expected += target.wickets;
      continue;
    }
    const player = team.players.find((entry) => entry.id === bowlerId);
    const strikeRate = player?.bowling?.strikeRate ?? 24;
    expected += balls / strikeRate;
  }
  return expected;
}

/** Pulls combined wicket expectation into the 4–9 band unless the user overrides it. */
export function inningsWicketScale(team: TeamConfig, allowHigh: boolean): number {
  const expected = expectedInningsWickets(team);
  if (allowHigh) return 1;
  if (expected > 9) return 9 / expected;
  if (expected < 4) return 4 / Math.max(expected, 0.5);
  return 1;
}

export function ballsPlanned(team: TeamConfig, bowlerId: string): number {
  return team.bowlingPlan.filter((id) => id === bowlerId).length * 6;
}

/**
 * Per-over wicket multiplier that averages to 1 across this bowler's spell,
 * so a death specialist spikes late without changing their expected wickets.
 */
export function phaseWeight(bowler: Player, over: number): number {
  const phase = phaseOfOver(over);
  const prefers = bowler.bowling?.phases.includes(phase) ?? false;
  return prefers ? 1.45 : 0.7;
}

export function activeBatterTarget(
  targets: PlayerTarget[],
  playerId: string,
  strikeRate = 130,
): { runs: number; balls: number } | undefined {
  const target = targets.find((entry) => entry.playerId === playerId);
  if (!target || (target.runs ?? 0) <= 0) return undefined;
  const runs = target.runs ?? 0;
  const balls =
    (target.balls ?? 0) > 0
      ? (target.balls ?? 0)
      : Math.max(1, Math.round((runs * 100) / Math.max(80, strikeRate)));
  return { runs, balls };
}

/** Runs still needed to reach the configured score. Null when this batter has no run target. */
export function runsShort(ctx: DistributionContext): number | null {
  if (!ctx.batterTarget) return null;
  return ctx.batterTarget.runs - ctx.strikerRuns;
}

export function activeWicketTarget(targets: PlayerTarget[], playerId: string): number | undefined {
  const target = targets.find((entry) => entry.playerId === playerId);
  if (!target || (target.wickets ?? 0) <= 0) return undefined;
  return target.wickets;
}

/** Slow-then-accelerate curve. At 0 balls the expectation is 0; at the budget it is the target. */
export function expectedRunsOnCurve(ballsFaced: number, runs: number, balls: number): number {
  if (balls <= 0) return 0;
  const fraction = Math.min(1, Math.max(0, ballsFaced / balls));
  return runs * Math.pow(fraction, 1.25);
}

/** Boundary-shape multiplier. Capped so a stuck batter accelerates without certain boundaries. */
export function catchUpBoundaryFactor(
  runs: number,
  ballsFaced: number,
  targetRuns: number,
  targetBalls: number,
): number {
  if (ballsFaced >= targetBalls) return 1;
  const expected = expectedRunsOnCurve(ballsFaced, targetRuns, targetBalls);
  const ballsLeft = Math.max(1, targetBalls - ballsFaced);
  const deficit = expected - runs;
  if (deficit > 0) return Math.min(2.5, 1 + 1.1 * (deficit / ballsLeft));
  const surplus = -deficit;
  return Math.max(0.45, 1 - 0.7 * (surplus / ballsLeft));
}

export function desiredBatRpb(ctx: DistributionContext): number {
  const short = runsShort(ctx);
  if (short != null && ctx.batterTarget) {
    if (short <= 0) return 0.05;
    const ballsLeft = Math.max(1, ctx.batterTarget.balls - ctx.strikerBalls);
    let rate = short / ballsLeft;
    if (ctx.batterTarget.runs >= 20 && ctx.batterTarget.balls >= 15 && ctx.strikerBalls < 10) {
      const earlyCap = 0.72 * (ctx.batterTarget.runs / ctx.batterTarget.balls);
      rate = Math.min(rate, Math.max(0.45, earlyCap));
    }
    if (short <= 3) rate = Math.min(rate, short);
    return clamp(rate, 0.15, 2.8);
  }

  let rate = ctx.residualRpb;
  if (ctx.strikerBalls < 10) rate *= 0.96;
  if (ctx.wickets > 0 && ctx.ballsSinceWicket < 4) rate *= 0.94;
  rate *= Math.pow(0.996, ctx.wickets);

  if (ctx.innings === 2 && ctx.requiredRuns != null && ctx.ballsRemaining != null) {
    const need = Math.max(0, ctx.requiredRuns) / Math.max(1, ctx.ballsRemaining);
    const rrr = ctx.rrr ?? need * 6;
    if (rrr >= 12) rate = rate * 0.25 + need * 0.75;
    else if (rrr >= 10) rate = rate * 0.5 + need * 0.5;
    else if (rrr < 7) rate = rate * 0.45 + Math.min(need, rate) * 0.55;
  }

  return clamp(rate, 0.35, 2.8);
}

/**
 * Wicket probability for this ball.
 * A wicket target is spread across the remaining spell in proportion to phase weight,
 * which both spikes the preferred overs and catches up if wickets are behind.
 */
export function wicketProbability(ctx: DistributionContext, naturalP: number): number {
  let pW = clamp(naturalP, 0.012, 0.12);

  if (ctx.bowlerTargetWickets != null && ctx.bowlerBallsPlanned > 0) {
    const taken = ctx.bowlerWickets;
    const remaining = Math.max(0, ctx.bowlerTargetWickets - taken);
    const future = ctx.remainingPhaseWeights;
    const weightSum = future.reduce((sum, weight) => sum + weight, 0);
    const share = weightSum > 0 ? future[0] / weightSum : 1 / Math.max(1, future.length);
    const pCredit = remaining * share;
    pW = pCredit / (1 - RUN_OUT_SHARE);
  }

  const short = runsShort(ctx);
  if (short == null) {
    pW *= ctx.inningsWicketScale;
  } else if (short > 6) {
    pW = Math.min(pW, 0.0015);
  } else if (short > 0) {
    pW = Math.min(pW, 0.025);
  } else {
    pW = Math.max(pW, 0.82);
  }

  const cap = short != null && short <= 0 ? 0.92 : ctx.bowlerTargetWickets != null ? 0.4 : 0.18;
  const floor = short != null && short > 0 ? 0.001 : 0.004;
  return clamp(pW, floor, cap);
}

export function applyContext(weights: Dist, ctx: DistributionContext): Dist {
  const next = { ...weights };
  const phase = PHASE_PRIORS[ctx.phase];
  // Light extra tilt on top of the phase prior so death and powerplay stay distinct after matchup.
  if (ctx.phase === "powerplay") {
    next[0] *= 0.9;
    next[4] *= 1.15;
    next.W *= 1.08;
  } else if (ctx.phase === "death") {
    next[0] *= 1.18;
    next[1] *= 0.72;
    next[2] *= 0.78;
    next[4] *= 1.22;
    next[6] *= 1.4;
    next.W *= 1.28;
  } else if (ctx.bowler.bowling?.style === "spin") {
    next[1] *= 1.22;
    next[4] *= 0.88;
    next[6] *= 0.82;
  }

  const stillShort = runsShort(ctx);
  const chasingTarget = stillShort != null && stillShort > 0;
  if (!chasingTarget) {
    if (ctx.strikerBalls < 10) {
      next[0] *= 1.18;
      next[4] *= 0.78;
      next[6] *= 0.72;
    } else {
      next[0] *= 0.94;
      next[4] *= 1.06;
      next[6] *= 1.06;
    }
  }

  if (ctx.innings === 2 && ctx.rrr != null) {
    if (ctx.rrr < 7) {
      next[1] *= 1.4;
      next[2] *= 1.25;
      next[4] *= 0.68;
      next[6] *= 0.52;
      next.W *= 0.72;
    } else if (ctx.rrr >= 12) {
      next[0] *= 1.12;
      next[1] *= 0.55;
      next[2] *= 0.62;
      next[4] *= 1.85;
      next[6] *= 2.15;
      next.W *= 1.75;
    } else if (ctx.rrr >= 10) {
      next[1] *= 0.82;
      next[4] *= 1.35;
      next[6] *= 1.5;
      next.W *= 1.3;
    }
  }

  // Keep the phase prior's extra rate from collapsing to zero in the matchup.
  next.Wd = Math.max(next.Wd, phase.Wd * 0.25);
  next.Nb = Math.max(next.Nb, phase.Nb * 0.25);
  return next;
}

export function applyCatchUp(weights: Dist, ctx: DistributionContext): Dist {
  const short = runsShort(ctx);
  if (!ctx.batterTarget || short == null || short <= 0) return weights;
  const factor = catchUpBoundaryFactor(
    ctx.strikerRuns,
    ctx.strikerBalls,
    ctx.batterTarget.runs,
    ctx.batterTarget.balls,
  );
  return { ...weights, 4: weights[4] * factor, 6: weights[6] * factor };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampRatio(value: number): number {
  return clamp(value, RATIO_MIN, RATIO_MAX);
}
