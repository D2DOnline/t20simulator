import type { DistributionContext } from "./distribution-context";
import {
  applyCatchUp,
  applyContext,
  clampRatio,
  desiredBatRpb,
  wicketProbability,
} from "./modifiers";
import {
  LEAGUE_PRIOR,
  PHASE_PRIORS,
  emptyDist,
  expectedBatRpb,
  normalize,
  sumDist,
} from "./priors";
import { OUTCOMES, type BowlingProfile, type Dist, type Outcome, type Player } from "./types";

const PART_TIMER: BowlingProfile = {
  economy: 9.4,
  strikeRate: 28,
  style: "pace",
  phases: ["middle"],
};

export function buildDistribution(ctx: DistributionContext): Dist {
  let dist = normalize(applyCatchUp(applyContext(matchupWeights(ctx), ctx), ctx));
  dist = imposeWicket(dist, wicketProbability(ctx, dist.W));
  dist = scaleToBatRate(dist, desiredBatRpb(ctx));
  dist = clipToBatterTarget(dist, ctx);
  return ensureSupport(dist);
}

export function sampleOutcome(dist: Dist, rng: () => number): Outcome {
  const u = rng();
  let cursor = 0;
  for (const outcome of OUTCOMES) {
    cursor += dist[outcome];
    if (u <= cursor) return outcome;
  }
  return OUTCOMES[OUTCOMES.length - 1];
}

/** Once a batter is within a boundary of the target, keep the next shots small so they are out near that score. */
function clipToBatterTarget(dist: Dist, ctx: DistributionContext): Dist {
  if (!ctx.batterTarget) return dist;
  const short = ctx.batterTarget.runs - ctx.strikerRuns;
  if (short >= 4) return dist;

  const next = { ...dist };
  const scoring: Outcome[] = [0, 1, 2, 3, 4, 6];
  const allowed = new Set<Outcome>(short <= 0 ? [0] : short === 1 ? [0, 1] : short === 2 ? [0, 1, 2] : [0, 1, 2, 3]);
  let freed = 0;
  for (const outcome of scoring) {
    if (!allowed.has(outcome)) {
      freed += next[outcome];
      next[outcome] = 0;
    }
  }
  const sink: Outcome = short <= 0 ? 0 : 1;
  next[sink] += freed;
  return next;
}

function matchupWeights(ctx: DistributionContext): Dist {
  const prior = PHASE_PRIORS[ctx.phase];
  const batter = playerShape(ctx.batter, "bat");
  const bowler = playerShape(ctx.bowler, "bowl");
  const weights = emptyDist();
  for (const outcome of OUTCOMES) {
    const league = Math.max(LEAGUE_PRIOR[outcome], 0.004);
    weights[outcome] =
      prior[outcome] *
      clampRatio(batter[outcome] / league) *
      clampRatio(bowler[outcome] / league);
  }
  return weights;
}

function playerShape(player: Player, side: "bat" | "bowl"): Dist {
  const bowling = player.bowling ?? PART_TIMER;
  const phase =
    side === "bowl" && bowling.phases.includes("death")
      ? PHASE_PRIORS.death
      : side === "bowl" && bowling.phases.includes("powerplay") && !bowling.phases.includes("middle")
        ? PHASE_PRIORS.powerplay
        : PHASE_PRIORS.middle;

  const rpb = side === "bat" ? player.batting.strikeRate / 100 : bowling.economy / 6;
  const pW =
    side === "bat"
      ? 1 / Math.max(8, (player.batting.average * 100) / Math.max(40, player.batting.strikeRate))
      : 1 / Math.max(8, bowling.strikeRate);

  const seeded = normalize({
    ...phase,
    W: pW,
    Wd: side === "bowl" ? (bowling.style === "pace" ? 0.035 : 0.012) : 0.02,
    Nb: side === "bowl" ? 0.008 : 0.006,
  });
  return scaleToBatRate(imposeWicket(seeded, pW), clamp(rpb, 0.4, 2.4));
}

function imposeWicket(dist: Dist, pW: number): Dist {
  const next = { ...dist };
  const others = 1 - dist.W;
  const targetOthers = 1 - pW;
  if (others <= 1e-6) {
    const share = targetOthers / (OUTCOMES.length - 1);
    for (const outcome of OUTCOMES) next[outcome] = outcome === "W" ? pW : share;
    return next;
  }
  const scale = targetOthers / others;
  for (const outcome of OUTCOMES) {
    next[outcome] = outcome === "W" ? pW : dist[outcome] * scale;
  }
  return next;
}

function scaleToBatRate(dist: Dist, targetBatRpb: number): Dist {
  const pW = dist.W;
  const pWd = dist.Wd;
  const pNb = dist.Nb;
  const mass = Math.max(0.25, 1 - pW - pWd - pNb);
  const base = {
    0: Math.max(dist[0], 1e-4),
    1: Math.max(dist[1], 1e-4),
    2: Math.max(dist[2], 1e-4),
    3: Math.max(dist[3], 1e-4),
    4: Math.max(dist[4], 1e-4),
    6: Math.max(dist[6], 1e-4),
  };

  const compose = (tilt: number): Dist => {
    const raw = {
      0: base[0] / Math.pow(tilt, 0.7),
      1: base[1] / Math.pow(tilt, 0.12),
      2: base[2] * Math.pow(tilt, 0.2),
      3: base[3] * Math.pow(tilt, 0.35),
      4: base[4] * tilt,
      6: base[6] * Math.pow(tilt, 1.35),
    };
    const sum = raw[0] + raw[1] + raw[2] + raw[3] + raw[4] + raw[6];
    return {
      0: (raw[0] / sum) * mass,
      1: (raw[1] / sum) * mass,
      2: (raw[2] / sum) * mass,
      3: (raw[3] / sum) * mass,
      4: (raw[4] / sum) * mass,
      6: (raw[6] / sum) * mass,
      W: pW,
      Wd: pWd,
      Nb: pNb,
    };
  };

  let lo = 0.05;
  let hi = 24;
  let best = compose(1);
  for (let i = 0; i < 22; i++) {
    const mid = Math.sqrt(lo * hi);
    best = compose(mid);
    if (expectedBatRpb(best) > targetBatRpb) hi = mid;
    else lo = mid;
  }
  return best;
}

function ensureSupport(dist: Dist): Dist {
  const next = { ...dist };
  const floor = 0.0008;
  let added = 0;
  for (const outcome of OUTCOMES) {
    if (next[outcome] < floor) {
      added += floor - next[outcome];
      next[outcome] = floor;
    }
  }
  if (added > 0) {
    const donors = OUTCOMES.filter((outcome) => next[outcome] > floor);
    const donorSum = donors.reduce<number>((sum, outcome) => sum + next[outcome], 0);
    for (const outcome of donors) {
      next[outcome] -= added * (next[outcome] / donorSum);
    }
  }
  return normalize(next);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function assertUnit(dist: Dist): number {
  return sumDist(dist);
}
