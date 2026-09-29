import type { Player } from "./types";

/** A run of overs from one end. The other end bowls in between. */
export interface BowlingSpell {
  bowlerId: string;
  overs: number;
}

export interface BowlingEnds {
  /** Overs 1, 3, 5, and so on. */
  odd: BowlingSpell[];
  /** Overs 2, 4, 6, and so on. */
  even: BowlingSpell[];
}

export type SpellPlan =
  | { ok: true; plan: string[] }
  | { ok: false; error: string };

export function planToEnds(plan: readonly string[]): BowlingEnds {
  const ends: BowlingEnds = { odd: [], even: [] };
  for (let over = 0; over < plan.length; over++) {
    const spells = over % 2 === 0 ? ends.odd : ends.even;
    const bowlerId = plan[over];
    const last = spells[spells.length - 1];
    if (last && last.bowlerId === bowlerId) last.overs += 1;
    else spells.push({ bowlerId, overs: 1 });
  }
  return ends;
}

export function describeSpellPlan(ends: BowlingEnds, players: readonly Player[]): SpellPlan {
  const nameOf = (id: string) => players.find((player) => player.id === id)?.name ?? "A bowler";

  for (const [label, spells] of [
    ["Odd-end", ends.odd],
    ["Even-end", ends.even],
  ] as const) {
    let total = 0;
    for (const spell of spells) {
      const bowler = players.find((player) => player.id === spell.bowlerId);
      if (!bowler?.bowling) return { ok: false, error: `${nameOf(spell.bowlerId)} does not bowl.` };
      if (!Number.isInteger(spell.overs) || spell.overs < 1 || spell.overs > 4) {
        return { ok: false, error: `${bowler.name}'s spell must be from 1 to 4 overs.` };
      }
      total += spell.overs;
    }
    if (total !== 10) {
      return { ok: false, error: `${label} spells add up to ${total} overs. Each end bowls 10.` };
    }
  }

  const counts = new Map<string, number>();
  for (const spell of [...ends.odd, ...ends.even]) {
    counts.set(spell.bowlerId, (counts.get(spell.bowlerId) ?? 0) + spell.overs);
  }
  for (const [id, overs] of counts) {
    if (overs > 4) return { ok: false, error: `${nameOf(id)} is down for ${overs} overs. The limit is 4.` };
  }

  const odd = expand(ends.odd);
  const even = expand(ends.even);
  const plan: string[] = [];
  for (let pair = 0; pair < 10; pair++) plan.push(odd[pair], even[pair]);

  for (let index = 1; index < plan.length; index++) {
    if (plan[index] === plan[index - 1]) {
      return {
        ok: false,
        error: `${nameOf(plan[index])} would bowl overs ${index} and ${index + 1} in a row.`,
      };
    }
  }

  return { ok: true, plan };
}

function expand(spells: readonly BowlingSpell[]): string[] {
  const slots: string[] = [];
  for (const spell of spells) {
    for (let over = 0; over < spell.overs; over++) slots.push(spell.bowlerId);
  }
  return slots;
}
