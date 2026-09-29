export const OUTCOMES = [0, 1, 2, 3, 4, 6, "W", "Wd", "Nb"] as const;

export type Outcome = (typeof OUTCOMES)[number];

export type Dist = Record<Outcome, number>;

export type Phase = "powerplay" | "middle" | "death";

export type BowlingStyle = "pace" | "spin";

export type Role = "batter" | "bowler" | "allrounder" | "wicketkeeper";

export type Side = "A" | "B";

export interface BattingProfile {
  strikeRate: number;
  average: number;
}

export interface BowlingProfile {
  economy: number;
  /** Legal balls per wicket. */
  strikeRate: number;
  style: BowlingStyle;
  phases: Phase[];
}

export interface Player {
  id: string;
  name: string;
  role: Role;
  batting: BattingProfile;
  bowling?: BowlingProfile;
}

export interface PlayerTarget {
  playerId: string;
  runs?: number;
  balls?: number;
  wickets?: number;
}

export interface TeamConfig {
  id: string;
  name: string;
  shortName: string;
  averageScore: number;
  players: Player[];
  /** Bowler id for each of the 20 overs. */
  bowlingPlan: string[];
  targets: PlayerTarget[];
}

export interface MatchConfig {
  teamA: TeamConfig;
  teamB: TeamConfig;
  battingFirst: Side;
  seed: number;
  /** When true, combined wicket targets may exceed the 4–9 band. */
  allowHighWicketTargets?: boolean;
}

export interface BallEvent {
  innings: 1 | 2;
  over: number;
  ballInOver: number;
  legal: boolean;
  bowlerId: string;
  bowlerName: string;
  strikerId: string;
  strikerName: string;
  nonStrikerId: string;
  nonStrikerName: string;
  nextStrikerId: string;
  nextStrikerName: string;
  nextNonStrikerId: string;
  nextNonStrikerName: string;
  outcome: Outcome;
  runs: number;
  batRuns: number;
  extraRuns: number;
  wicket: boolean;
  creditsBowler: boolean;
  dismissal?: string;
  dismissedId?: string;
  score: number;
  wickets: number;
  legalBalls: number;
  commentary: string;
  target?: number;
}

export interface InningsSummary {
  battingKey: Side;
  battingTeamName: string;
  bowlingTeamName: string;
  score: number;
  wickets: number;
  legalBalls: number;
  extras: number;
  allOut: boolean;
  target?: number;
}

export interface MatchResult {
  seed: number;
  battingFirst: Side;
  firstBatting: TeamConfig;
  secondBatting: TeamConfig;
  balls: BallEvent[];
  innings: [InningsSummary, InningsSummary];
  winner: Side | "tie";
  margin: string;
  allowHighWicketTargets: boolean;
}

export const RUN_VALUE: Record<Outcome, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  6: 6,
  W: 0,
  Wd: 1,
  Nb: 1,
};
