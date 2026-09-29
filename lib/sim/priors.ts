import type { Dist, Outcome, Phase } from "./types";
import { OUTCOMES } from "./types";

/**
 * Phase baselines for a ~170 T20. Powerplay leans to fours with fewer dots,
 * the middle is rotation, and the death piles onto dots, boundaries, and wickets.
 * Each row sums to 1.
 */
export const PHASE_PRIORS: Record<Phase, Dist> = {
  powerplay: {
    0: 0.28,
    1: 0.3,
    2: 0.06,
    3: 0.008,
    4: 0.18,
    6: 0.06,
    W: 0.055,
    Wd: 0.04,
    Nb: 0.017,
  },
  middle: {
    0: 0.36,
    1: 0.36,
    2: 0.08,
    3: 0.01,
    4: 0.09,
    6: 0.035,
    W: 0.045,
    Wd: 0.015,
    Nb: 0.005,
  },
  death: {
    0: 0.32,
    1: 0.18,
    2: 0.05,
    3: 0.005,
    4: 0.16,
    6: 0.12,
    W: 0.1,
    Wd: 0.05,
    Nb: 0.015,
  },
};

const PHASE_WEIGHT: Record<Phase, number> = {
  powerplay: 6 / 20,
  middle: 9 / 20,
  death: 5 / 20,
};

export const LEAGUE_PRIOR: Dist = OUTCOMES.reduce((dist, outcome) => {
  dist[outcome] =
    PHASE_PRIORS.powerplay[outcome] * PHASE_WEIGHT.powerplay +
    PHASE_PRIORS.middle[outcome] * PHASE_WEIGHT.middle +
    PHASE_PRIORS.death[outcome] * PHASE_WEIGHT.death;
  return dist;
}, {} as Dist);

export function phaseOfOver(over: number): Phase {
  if (over < 6) return "powerplay";
  if (over < 15) return "middle";
  return "death";
}

export function emptyDist(): Dist {
  return OUTCOMES.reduce((dist, outcome) => {
    dist[outcome] = 0;
    return dist;
  }, {} as Dist);
}

export function sumDist(dist: Dist): number {
  return OUTCOMES.reduce<number>((sum, outcome) => sum + dist[outcome], 0);
}

export function normalize(weights: Dist): Dist {
  const total = sumDist(weights);
  const dist = emptyDist();
  if (total <= 0) {
    const share = 1 / OUTCOMES.length;
    for (const outcome of OUTCOMES) dist[outcome] = share;
    return dist;
  }
  for (const outcome of OUTCOMES) dist[outcome] = Math.max(weights[outcome], 0) / total;
  return dist;
}

/** Bat-scoring runs per legal ball, excluding wides and no-balls. */
export function expectedBatRpb(dist: Dist): number {
  const pLegal = Math.max(0.5, 1 - dist.Wd - dist.Nb);
  const bat =
    dist[1] * 1 + dist[2] * 2 + dist[3] * 3 + dist[4] * 4 + dist[6] * 6;
  return bat / pLegal;
}

export function boundaryRate(dist: Dist): number {
  return dist[4] + dist[6];
}

export function cloneDist(dist: Dist): Dist {
  return { ...dist };
}

export function outcomeKey(outcome: Outcome): string {
  return String(outcome);
}
