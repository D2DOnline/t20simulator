import type { Player, PlayerTarget, TeamConfig } from "./types";

export function setAverage(team: TeamConfig, averageScore: number): TeamConfig {
  if (!Number.isFinite(averageScore)) return team;
  return { ...team, averageScore: clamp(Math.round(averageScore), 80, 280) };
}

export function setPlayerTarget(
  team: TeamConfig,
  playerId: string,
  patch: { runs?: number | null; balls?: number | null; wickets?: number | null },
): TeamConfig {
  const current = team.targets.find((target) => target.playerId === playerId) ?? { playerId };
  const next: PlayerTarget = { ...current, playerId };

  if ("runs" in patch) assignOptional(next, "runs", patch.runs);
  if ("balls" in patch) assignOptional(next, "balls", patch.balls);
  if ("wickets" in patch) assignOptional(next, "wickets", patch.wickets);

  const targets = team.targets.filter((target) => target.playerId !== playerId);
  if (next.runs != null || next.balls != null || next.wickets != null) targets.push(next);
  return { ...team, targets };
}

export function moveBatter(team: TeamConfig, index: number, direction: -1 | 1): TeamConfig {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= team.players.length) return team;
  const players = team.players.slice();
  const [moved] = players.splice(index, 1);
  players.splice(nextIndex, 0, moved);
  return { ...team, players };
}

export function moveOver(team: TeamConfig, index: number, direction: -1 | 1): TeamConfig {
  return placeOver(team, index, index + direction + 1);
}

/** `order` is the 1-based over this slot should move to. */
export function placeOver(team: TeamConfig, index: number, order: number): TeamConfig {
  const target = order - 1;
  if (!Number.isInteger(order) || target < 0 || target >= team.bowlingPlan.length) return team;
  if (index < 0 || index >= team.bowlingPlan.length || target === index) return team;
  const bowlingPlan = team.bowlingPlan.slice();
  const [moved] = bowlingPlan.splice(index, 1);
  bowlingPlan.splice(target, 0, moved);
  return { ...team, bowlingPlan };
}

export function setBowlingPlan(team: TeamConfig, bowlingPlan: readonly string[]): TeamConfig {
  if (bowlingPlan.length !== team.bowlingPlan.length) return team;
  if (bowlingPlan.every((id, index) => id === team.bowlingPlan[index])) return team;
  const known = new Set(team.players.filter((player) => player.bowling).map((player) => player.id));
  const counts = new Map<string, number>();
  for (const id of bowlingPlan) {
    if (!known.has(id)) return team;
    const next = (counts.get(id) ?? 0) + 1;
    if (next > 4) return team;
    counts.set(id, next);
  }
  return { ...team, bowlingPlan: [...bowlingPlan] };
}

export function setOverBowler(team: TeamConfig, overIndex: number, bowlerId: string): TeamConfig {
  if (overIndex < 0 || overIndex >= team.bowlingPlan.length) return team;
  if (team.bowlingPlan[overIndex] === bowlerId) return team;
  const bowler = team.players.find((player) => player.id === bowlerId);
  if (!bowler?.bowling) return team;
  const already = team.bowlingPlan.filter((id) => id === bowlerId).length;
  if (already >= 4) return team;
  const bowlingPlan = team.bowlingPlan.slice();
  bowlingPlan[overIndex] = bowlerId;
  return { ...team, bowlingPlan };
}

export function replacePlayer(team: TeamConfig, index: number, player: Player): TeamConfig {
  const previous = team.players[index];
  const players = team.players.slice();
  players[index] = player;
  let bowlingPlan = team.bowlingPlan.slice();

  if (previous && bowlingPlan.includes(previous.id)) {
    if (player.bowling || !attackHasRoom(bowlingPlan, previous.id, players)) {
      const seated = player.bowling
        ? player
        : {
            ...player,
            bowling: {
              economy: 8.6,
              strikeRate: 24,
              style: "pace" as const,
              phases: ["middle" as const],
            },
          };
      players[index] = seated;
      bowlingPlan = bowlingPlan.map((id) => (id === previous.id ? seated.id : id));
    } else {
      bowlingPlan = reassignOvers(bowlingPlan, previous.id, players);
    }
  }

  return {
    ...team,
    players,
    bowlingPlan,
    targets: team.targets.filter((target) => target.playerId !== previous?.id),
  };
}

function reassignOvers(plan: string[], removedId: string, players: Player[]): string[] {
  const bowlers = players.filter((player) => player.bowling);
  const next = plan.slice();
  for (let over = 0; over < next.length; over++) {
    if (next[over] !== removedId) continue;
    const counts = new Map<string, number>();
    for (const id of next) {
      if (id === removedId) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const choice = bowlers
      .filter((bowler) => (counts.get(bowler.id) ?? 0) < 4)
      .sort((a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0))[0];
    if (!choice) throw new Error("No bowler can take the spare over");
    next[over] = choice.id;
  }
  return next;
}

function attackHasRoom(plan: string[], removedId: string, players: Player[]): boolean {
  const spare = plan.filter((id) => id === removedId).length;
  const counts = new Map<string, number>();
  for (const id of plan) {
    if (id === removedId) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  let room = 0;
  for (const player of players) {
    if (!player.bowling) continue;
    room += Math.max(0, 4 - (counts.get(player.id) ?? 0));
  }
  return room >= spare;
}

function assignOptional(
  target: PlayerTarget,
  key: "runs" | "balls" | "wickets",
  value: number | null | undefined,
) {
  if (value == null || Number.isNaN(value) || value <= 0) {
    delete target[key];
    return;
  }
  target[key] = Math.round(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
