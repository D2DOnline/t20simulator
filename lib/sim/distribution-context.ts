import type { Phase, Player } from "./types";

/** Everything the next-ball distribution is allowed to see. */
export interface DistributionContext {
  phase: Phase;
  batter: Player;
  bowler: Player;
  wickets: number;
  strikerBalls: number;
  strikerRuns: number;
  ballsSinceWicket: number;
  residualRpb: number;
  batterTarget?: { runs: number; balls: number };
  bowlerTargetWickets?: number;
  bowlerBallsPlanned: number;
  bowlerWickets: number;
  /** Phase weights for this ball and every later ball in the spell. Index 0 is the current ball. */
  remainingPhaseWeights: number[];
  inningsWicketScale: number;
  rrr?: number;
  requiredRuns?: number;
  ballsRemaining?: number;
  innings: 1 | 2;
}
