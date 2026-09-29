import { describe, expect, it } from "vitest";
import { TEAMS } from "../../data/teams";
import { buildDistribution } from "./distribution";
import type { DistributionContext } from "./distribution-context";
import { simulateMatch } from "./engine";
import { boundaryRate, sumDist } from "./priors";
import { describeSpellPlan, planToEnds } from "./spells";
import { moveBatter, moveOver, placeOver, replacePlayer, setBowlingPlan, setOverBowler } from "./team-edit";
import type { MatchConfig, Phase, TeamConfig } from "./types";

const PHASES: Phase[] = ["powerplay", "middle", "death"];

function bare(team: TeamConfig, averageScore = 170): TeamConfig {
  return { ...structuredClone(team), averageScore, targets: [] };
}

function config(patch: Partial<MatchConfig> = {}): MatchConfig {
  return {
    teamA: bare(TEAMS[0], 170),
    teamB: bare(TEAMS[1], 170),
    battingFirst: "A",
    seed: 1,
    allowHighWicketTargets: false,
    ...patch,
  };
}

function context(overrides: Partial<DistributionContext> = {}): DistributionContext {
  const batter = TEAMS[0].players[2];
  const bowler = TEAMS[0].players[8];
  return {
    phase: "middle",
    batter,
    bowler,
    wickets: 1,
    strikerBalls: 18,
    strikerRuns: 24,
    ballsSinceWicket: 12,
    residualRpb: 170 / 120,
    bowlerBallsPlanned: 24,
    bowlerWickets: 0,
    remainingPhaseWeights: Array.from({ length: 12 }, () => 1),
    inningsWicketScale: 1,
    innings: 1,
    ...overrides,
  };
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

describe("presets", () => {
  it("gives every squad 11 players and a legal 20-over attack", () => {
    expect(TEAMS).toHaveLength(7);
    for (const team of TEAMS) {
      expect(team.players).toHaveLength(11);
      expect(team.bowlingPlan).toHaveLength(20);
      const counts = new Map<string, number>();
      for (const id of team.bowlingPlan) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
        expect(team.players.some((player) => player.id === id)).toBe(true);
      }
      for (const overs of counts.values()) expect(overs).toBeLessThanOrEqual(4);
    }
  });

  it("keeps a full attack when a frontline bowler is replaced by a batter", () => {
    const india = structuredClone(TEAMS[0]);
    for (const player of india.players) {
      if (!india.bowlingPlan.includes(player.id)) player.bowling = undefined;
    }
    const next = replacePlayer(india, 8, {
      id: "custom-guest",
      name: "Guest Batter",
      role: "batter",
      batting: { strikeRate: 130, average: 25 },
    });
    expect(next.bowlingPlan.filter((id) => id === "custom-guest")).toHaveLength(4);
    expect(next.players[8].bowling).toBeDefined();
    const counts = new Map<string, number>();
    for (const id of next.bowlingPlan) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const overs of counts.values()) expect(overs).toBeLessThanOrEqual(4);
  });

  it("reorders the batting list and the over spell without breaking the four-over cap", () => {
    const india = structuredClone(TEAMS[0]);
    const moved = moveBatter(india, 0, 1);
    expect(moved.players[0].id).toBe(india.players[1].id);
    expect(moved.players[1].id).toBe(india.players[0].id);
    expect(moveBatter(india, 0, -1)).toBe(india);

    const swapped = moveOver(india, 0, 1);
    expect(swapped.bowlingPlan[0]).toBe(india.bowlingPlan[1]);
    expect(swapped.bowlingPlan[1]).toBe(india.bowlingPlan[0]);
    const placed = placeOver(india, 0, 3);
    expect(placed.bowlingPlan[2]).toBe(india.bowlingPlan[0]);
    expect(placed.bowlingPlan[0]).toBe(india.bowlingPlan[1]);
    expect(placeOver(india, 0, 1)).toBe(india);

    const bowler = india.players.find((player) => player.bowling && !india.bowlingPlan.includes(player.id));
    expect(bowler).toBeTruthy();
    const assigned = setOverBowler(india, 0, bowler!.id);
    expect(assigned.bowlingPlan[0]).toBe(bowler!.id);
    const incumbent = india.bowlingPlan[0];
    const otherOver = india.bowlingPlan.findIndex((id) => id !== incumbent);
    expect(setOverBowler(india, otherOver, incumbent)).toBe(india);
  });

  it("rebuilds the twenty overs from spells and their lengths", () => {
    for (const team of TEAMS) {
      const built = describeSpellPlan(planToEnds(team.bowlingPlan), team.players);
      expect(built.ok, team.name).toBe(true);
      if (built.ok) expect(built.plan).toEqual(team.bowlingPlan);
    }

    const india = structuredClone(TEAMS[0]);
    const ends = planToEnds(india.bowlingPlan);
    const kuldeep = ends.odd.find((spell) => spell.bowlerId === "ind-kuldeep");
    expect(kuldeep).toBeTruthy();
    kuldeep!.overs -= 1;
    ends.odd.unshift({ bowlerId: "ind-axar", overs: 1 });
    const built = describeSpellPlan(ends, india.players);
    expect(built.ok, built.ok ? "" : built.error).toBe(true);
    if (!built.ok) return;
    const next = setBowlingPlan(india, built.plan);
    expect(next.bowlingPlan[0]).toBe("ind-axar");
    expect(next.bowlingPlan.filter((id) => id === "ind-axar")).toHaveLength(1);
    expect(next.bowlingPlan.filter((id) => id === "ind-kuldeep")).toHaveLength(3);
    expect(next.bowlingPlan.filter((_, index) => index % 2 === 0)).toHaveLength(10);

    const short = planToEnds(india.bowlingPlan);
    short.odd[0] = { ...short.odd[0], overs: short.odd[0].overs - 1 };
    expect(describeSpellPlan(short, india.players).ok).toBe(false);

    const crowded = describeSpellPlan(
      {
        odd: [
          { bowlerId: "ind-bumrah", overs: 2 },
          { bowlerId: "ind-jadeja", overs: 4 },
          { bowlerId: "ind-kuldeep", overs: 4 },
        ],
        even: [
          { bowlerId: "ind-bumrah", overs: 2 },
          { bowlerId: "ind-hardik", overs: 4 },
          { bowlerId: "ind-arshdeep", overs: 4 },
        ],
      },
      india.players,
    );
    expect(crowded.ok).toBe(false);
    if (!crowded.ok) expect(crowded.error).toContain("in a row");
    expect(setBowlingPlan(india, india.bowlingPlan)).toBe(india);
  });
});

describe("distribution", () => {
  it("renormalizes to 1 in every phase", () => {
    for (const phase of PHASES) {
      const dist = buildDistribution(context({ phase }));
      expect(sumDist(dist)).toBeCloseTo(1, 5);
      for (const weight of Object.values(dist)) {
        expect(weight).toBeGreaterThan(0);
        expect(Number.isFinite(weight)).toBe(true);
      }
    }
  });

  it("raises the boundary rate when a chase needs more than 12 an over", () => {
    const shared = {
      innings: 2 as const,
      ballsRemaining: 30,
      strikerBalls: 22,
      strikerRuns: 30,
    };
    const cruise = buildDistribution(
      context({ ...shared, rrr: 5, requiredRuns: 20, ballsRemaining: 24 }),
    );
    const pressure = buildDistribution(
      context({ ...shared, rrr: 14, requiredRuns: 70, ballsRemaining: 30 }),
    );
    expect(boundaryRate(pressure)).toBeGreaterThan(boundaryRate(cruise) + 0.05);
  });
});

describe("simulateMatch", () => {
  it("replays the same ball log for the same seed", () => {
    const matchConfig = config({ seed: 42 });
    const first = simulateMatch(matchConfig, 42);
    const second = simulateMatch(matchConfig, 42);
    expect(first.balls).toEqual(second.balls);
    expect(first.margin).toBe(second.margin);
  });

  it("lands the mean first-innings total near the configured average", () => {
    const totals: number[] = [];
    for (let seed = 0; seed < 160; seed++) {
      totals.push(simulateMatch(config(), seed).innings[0].score);
    }
    const average = mean(totals);
    expect(average, `mean total ${average.toFixed(1)}`).toBeGreaterThan(162);
    expect(average).toBeLessThan(178);
  });

  it("tracks a 55 off 40 batter target across the batters who face that spell", () => {
    const teamA = bare(TEAMS[0], 170);
    const kohli = teamA.players[2];
    teamA.targets = [{ playerId: kohli.id, runs: 55, balls: 40 }];
    const samples: number[] = [];

    for (let seed = 0; seed < 160; seed++) {
      const match = simulateMatch(config({ teamA }), seed);
      const faced = match.balls.filter(
        (ball) => ball.innings === 1 && ball.strikerId === `a:${kohli.id}` && ball.legal,
      );
      if (faced.length < 40) continue;
      samples.push(faced.slice(0, 40).reduce((sum, ball) => sum + ball.batRuns, 0));
    }

    expect(samples.length).toBeGreaterThan(25);
    const average = mean(samples);
    expect(average, `mean Kohli spell ${average.toFixed(1)} from ${samples.length}`).toBeGreaterThan(47);
    expect(average).toBeLessThan(63);
  });

  it("dismisses a batter within 5 runs of a runs-only target", () => {
    const teamA = bare(TEAMS[0], 170);
    const rohit = teamA.players[0];
    teamA.targets = [{ playerId: rohit.id, runs: 1 }];
    const knocks: number[] = [];
    let near = 0;

    for (let seed = 0; seed < 80; seed++) {
      const match = simulateMatch(config({ teamA }), seed);
      const id = `a:${rohit.id}`;
      const faced = match.balls.filter((ball) => ball.innings === 1 && ball.strikerId === id);
      const runs = faced.reduce((sum, ball) => sum + ball.batRuns, 0);
      const out = match.balls.some((ball) => ball.innings === 1 && ball.dismissedId === id);
      knocks.push(runs);
      if (out && Math.abs(runs - 1) <= 5) near += 1;
    }

    const average = mean(knocks);
    expect(average, `mean Rohit ${average.toFixed(2)}`).toBeGreaterThan(0);
    expect(average).toBeLessThan(4);
    expect(near / knocks.length).toBeGreaterThan(0.8);
  });

  it("tracks a 3-wicket bowling target across the spell", () => {
    const teamB = bare(TEAMS[1], 170);
    const bumrah = TEAMS[0].players[8];
    const teamA = bare(TEAMS[0], 170);
    teamA.targets = [{ playerId: bumrah.id, wickets: 3 }];
    const wickets: number[] = [];

    for (let seed = 0; seed < 160; seed++) {
      const match = simulateMatch(config({ teamA, teamB, battingFirst: "B" }), seed);
      const taken = match.balls.filter(
        (ball) => ball.innings === 1 && ball.bowlerId === `a:${bumrah.id}` && ball.creditsBowler && ball.wicket,
      ).length;
      wickets.push(taken);
    }

    const average = mean(wickets);
    expect(average, `mean Bumrah wickets ${average.toFixed(2)}`).toBeGreaterThan(2.3);
    expect(average).toBeLessThan(3.7);
  });
});
