"use client";

import { useState } from "react";
import { cloneTeam } from "@/data/teams";
import { targetWarning } from "@/lib/sim/modifiers";
import { phaseOfOver } from "@/lib/sim/priors";
import { moveBatter, moveOver, placeOver, replacePlayer, setAverage, setOverBowler, setPlayerTarget } from "@/lib/sim/team-edit";
import type { BowlingStyle, Phase, Player, Role, Side, TeamConfig } from "@/lib/sim/types";

interface SetupFormProps {
  teams: TeamConfig[];
  teamA: TeamConfig;
  teamB: TeamConfig;
  battingFirst: Side;
  seed: number;
  allowHigh: boolean;
  hasReplay: boolean;
  onTeamA: (team: TeamConfig) => void;
  onTeamB: (team: TeamConfig) => void;
  onBattingFirst: (side: Side) => void;
  onSeed: (seed: number) => void;
  onAllowHigh: (value: boolean) => void;
  onSimulate: () => void;
  onReturn: () => void;
}

export function SetupForm(props: SetupFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <TeamCard
          side="A"
          team={props.teamA}
          presets={props.teams}
          batting={props.battingFirst === "A"}
          onChange={props.onTeamA}
          onBat={() => props.onBattingFirst("A")}
        />
        <TeamCard
          side="B"
          team={props.teamB}
          presets={props.teams}
          batting={props.battingFirst === "B"}
          onChange={props.onTeamB}
          onBat={() => props.onBattingFirst("B")}
        />
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-canopy/80 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-xs tracking-wide text-muted uppercase">
            Seed
            <input
              type="number"
              value={props.seed}
              className="w-36 rounded-lg border border-line bg-pitch px-3 py-2 text-sm text-cream"
              onChange={(event) => props.onSeed(Number(event.target.value) || 1)}
            />
          </label>
          <label className="flex max-w-sm items-start gap-2 pb-2 text-sm text-muted">
            <input
              type="checkbox"
              className="mt-1 accent-gold"
              checked={props.allowHigh}
              onChange={(event) => props.onAllowHigh(event.target.checked)}
            />
            <span>Allow combined wicket targets outside the usual 4–9 range.</span>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {props.hasReplay ? (
            <button
              type="button"
              className="rounded-full border border-line px-4 py-2.5 text-sm text-foam hover:bg-panel"
              onClick={props.onReturn}
            >
              Return to replay
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink hover:bg-gold-2"
            onClick={props.onSimulate}
          >
            Simulate match
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamCard({
  side,
  team,
  presets,
  batting,
  onChange,
  onBat,
}: {
  side: Side;
  team: TeamConfig;
  presets: TeamConfig[];
  batting: boolean;
  onChange: (team: TeamConfig) => void;
  onBat: () => void;
}) {
  const warning = targetWarning(team);
  const [replacing, setReplacing] = useState<number | null>(null);
  const [order, setOrder] = useState<"batting" | "bowling">("batting");

  return (
    <section className="rounded-2xl border border-line bg-canopy/80 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.18em] text-muted uppercase">Side {side}</p>
          <h2 className="font-condensed text-3xl font-semibold text-cream">{team.name}</h2>
        </div>
        <button
          type="button"
          onClick={onBat}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide uppercase ${
            batting ? "bg-gold text-ink" : "border border-line text-muted hover:text-foam"
          }`}
        >
          {batting ? "Batting first" : "Bowl first"}
        </button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="flex flex-col gap-1 text-xs tracking-wide text-muted uppercase">
          Squad
          <select
            className="rounded-lg border border-line bg-pitch px-3 py-2 text-sm text-cream"
            value={team.id}
            onChange={(event) => {
              const preset = presets.find((entry) => entry.id === event.target.value);
              if (preset) onChange(cloneTeam(preset));
              setReplacing(null);
            }}
          >
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs tracking-wide text-muted uppercase">
          Average score
          <input
            type="number"
            min={80}
            max={280}
            value={team.averageScore}
            className="w-28 rounded-lg border border-line bg-pitch px-3 py-2 text-sm text-cream"
            onChange={(event) => onChange(setAverage(team, Number(event.target.value)))}
          />
        </label>
      </div>

      {warning ? (
        <p className="mb-3 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold-2">{warning}</p>
      ) : null}

      <div className="mb-3 flex gap-1" role="tablist" aria-label={`${team.name} order`}>
        <OrderTab active={order === "batting"} onClick={() => setOrder("batting")}>
          Batting order
        </OrderTab>
        <OrderTab active={order === "bowling"} onClick={() => setOrder("bowling")}>
          Bowling order
        </OrderTab>
      </div>

      {order === "batting" ? (
      <ol className="flex flex-col gap-2">
        {team.players.map((player, index) =>
          replacing === index ? (
            <ReplaceForm
              key={player.id}
              inAttack={team.bowlingPlan.includes(player.id)}
              onCancel={() => setReplacing(null)}
              onSave={(next) => {
                onChange(replacePlayer(team, index, next));
                setReplacing(null);
              }}
            />
          ) : (
            <PlayerRow
              key={player.id}
              index={index}
              player={player}
              team={team}
              onTarget={(patch) => onChange(setPlayerTarget(team, player.id, patch))}
              onReplace={() => setReplacing(index)}
              onMove={(direction) => {
                setReplacing((current) => shiftOpenIndex(current, index, direction));
                onChange(moveBatter(team, index, direction));
              }}
            />
          ),
        )}
      </ol>
      ) : (
        <BowlingOrder team={team} onChange={onChange} />
      )}
    </section>
  );
}

function OrderTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide uppercase ${
        active ? "bg-panel-2 text-cream" : "text-muted hover:text-foam"
      }`}
    >
      {children}
    </button>
  );
}

function BowlingOrder({ team, onChange }: { team: TeamConfig; onChange: (team: TeamConfig) => void }) {
  const [draft, setDraft] = useState<{ index: number; value: string } | null>(null);
  const counts = new Map<string, number>();
  for (const bowlerId of team.bowlingPlan) counts.set(bowlerId, (counts.get(bowlerId) ?? 0) + 1);
  const names = new Map(team.players.map((player) => [player.id, player.name]));
  const backToBack = team.bowlingPlan.findIndex((bowlerId, index) => index > 0 && bowlerId === team.bowlingPlan[index - 1]);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs leading-relaxed text-muted">
        One row per over. Choose who bowls it, and set its place from 1 to 20. A bowler can bowl at most 4 overs.
      </p>
      <ol className="flex max-h-[32rem] flex-col gap-1.5 overflow-y-auto pr-1">
        {team.bowlingPlan.map((bowlerId, index) => {
          const choices = team.players.filter(
            (player) => player.id === bowlerId || (player.bowling && (counts.get(player.id) ?? 0) < 4),
          );
          return (
            <li key={`${index}-${bowlerId}`} className="flex items-center gap-2 rounded-lg border border-line/80 bg-panel px-2 py-1.5">
              <input
                type="number"
                min={1}
                max={20}
                inputMode="numeric"
                aria-label={`Over ${index + 1} order`}
                className="w-14 rounded-md border border-line bg-pitch px-2 py-1 text-center font-condensed text-gold"
                value={draft?.index === index ? draft.value : String(index + 1)}
                onFocus={(event) => {
                  setDraft({ index, value: String(index + 1) });
                  event.target.select();
                }}
                onChange={(event) => setDraft({ index, value: event.target.value })}
                onBlur={(event) => {
                  setDraft(null);
                  onChange(placeOver(team, index, Number(event.target.value)));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
              <select
                aria-label={`Over ${index + 1} bowler`}
                className="min-w-0 flex-1 rounded-md border border-line bg-pitch px-2 py-1 text-sm text-cream"
                value={bowlerId}
                onChange={(event) => onChange(setOverBowler(team, index, event.target.value))}
              >
                {choices.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
              <span className="w-10 text-[10px] tracking-wide text-muted uppercase">{phaseLabel(phaseOfOver(index))}</span>
              <MoveButtons
                upLabel={`Move over ${index + 1} earlier`}
                downLabel={`Move over ${index + 1} later`}
                upDisabled={index === 0}
                downDisabled={index === team.bowlingPlan.length - 1}
                onMove={(direction) => onChange(moveOver(team, index, direction))}
              />
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted">
        {team.players
          .filter((player) => counts.has(player.id))
          .map((player) => `${player.name} ${counts.get(player.id)}`)
          .join(" · ")}
      </p>
      {backToBack > 0 ? (
        <p className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold-2">
          {names.get(team.bowlingPlan[backToBack])} is listed for overs {backToBack} and {backToBack + 1} in a row.
        </p>
      ) : null}
    </div>
  );
}

function MoveButtons({
  upLabel,
  downLabel,
  upDisabled,
  downDisabled,
  onMove,
}: {
  upLabel: string;
  downLabel: string;
  upDisabled: boolean;
  downDisabled: boolean;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <span className="flex gap-0.5">
      <button
        type="button"
        aria-label={upLabel}
        disabled={upDisabled}
        className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-pitch hover:text-cream disabled:opacity-30"
        onClick={() => onMove(-1)}
      >
        ↑
      </button>
      <button
        type="button"
        aria-label={downLabel}
        disabled={downDisabled}
        className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-pitch hover:text-cream disabled:opacity-30"
        onClick={() => onMove(1)}
      >
        ↓
      </button>
    </span>
  );
}

function phaseLabel(phase: Phase): string {
  if (phase === "powerplay") return "PP";
  if (phase === "death") return "Death";
  return "Mid";
}

function shiftOpenIndex(current: number | null, index: number, direction: -1 | 1): number | null {
  if (current == null) return null;
  if (current === index) return index + direction;
  if (current === index + direction) return index;
  return current;
}

function PlayerRow({
  index,
  player,
  team,
  onTarget,
  onReplace,
  onMove,
}: {
  index: number;
  player: Player;
  team: TeamConfig;
  onTarget: (patch: { runs?: number | null; balls?: number | null; wickets?: number | null }) => void;
  onReplace: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const target = team.targets.find((entry) => entry.playerId === player.id);
  const inAttack = team.bowlingPlan.includes(player.id);

  return (
    <li className="rounded-xl border border-line/80 bg-panel px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-cream">
            <span className="mr-2 font-condensed text-gold">{String(index + 1).padStart(2, "0")}</span>
            {player.name}
          </p>
          <p className="text-xs text-muted">
            {roleLabel(player.role)} · SR {player.batting.strikeRate}
            {player.bowling ? ` · Econ ${player.bowling.economy}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <MoveButtons
            upLabel={`Move ${player.name} up the order`}
            downLabel={`Move ${player.name} down the order`}
            upDisabled={index === 0}
            downDisabled={index === team.players.length - 1}
            onMove={onMove}
          />
          <button type="button" className="text-xs text-mint hover:text-cream" onClick={onReplace}>
            Replace
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <NumberField
          label="Runs"
          value={target?.runs}
          title="Dismissed around this score"
          onChange={(runs) => onTarget({ runs })}
        />
        <NumberField
          label="Balls"
          value={target?.balls}
          onChange={(balls) => onTarget({ balls })}
        />
        {inAttack ? (
          <NumberField
            label="Wickets"
            value={target?.wickets}
            onChange={(wickets) => onTarget({ wickets })}
          />
        ) : null}
      </div>
    </li>
  );
}

function NumberField({
  label,
  value,
  title,
  onChange,
}: {
  label: string;
  value?: number;
  title?: string;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-[11px] tracking-wide text-muted uppercase" title={title}>
      {label}
      <input
        type="number"
        min={0}
        value={value ?? ""}
        placeholder="–"
        className="w-16 rounded-md border border-line bg-pitch px-2 py-1 text-sm text-cream"
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === "" ? null : Number(raw));
        }}
      />
    </label>
  );
}

function ReplaceForm({
  inAttack,
  onCancel,
  onSave,
}: {
  inAttack: boolean;
  onCancel: () => void;
  onSave: (player: Player) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("batter");
  const [strikeRate, setStrikeRate] = useState(140);
  const [average, setAverageRuns] = useState(30);
  const [bowls, setBowls] = useState(inAttack);
  const [economy, setEconomy] = useState(8);
  const [bowlSr, setBowlSr] = useState(20);
  const [style, setStyle] = useState<BowlingStyle>("pace");
  const [phases, setPhases] = useState<Phase[]>(["middle"]);

  function togglePhase(phase: Phase) {
    setPhases((current) =>
      current.includes(phase) ? current.filter((entry) => entry !== phase) : [...current, phase],
    );
  }

  return (
    <li className="rounded-xl border border-gold/40 bg-panel p-3">
      <p className="mb-2 text-xs tracking-wide text-gold uppercase">Custom player</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[11px] text-muted uppercase">
          Name
          <input
            value={name}
            className="rounded-md border border-line bg-pitch px-2 py-1 text-sm text-cream normal-case"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-muted uppercase">
          Role
          <select
            value={role}
            className="rounded-md border border-line bg-pitch px-2 py-1 text-sm text-cream"
            onChange={(event) => setRole(event.target.value as Role)}
          >
            <option value="batter">Batter</option>
            <option value="wicketkeeper">Wicketkeeper</option>
            <option value="allrounder">Allrounder</option>
            <option value="bowler">Bowler</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-muted uppercase">
          Strike rate
          <input
            type="number"
            value={strikeRate}
            className="rounded-md border border-line bg-pitch px-2 py-1 text-sm text-cream"
            onChange={(event) => setStrikeRate(Number(event.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-muted uppercase">
          Average
          <input
            type="number"
            value={average}
            className="rounded-md border border-line bg-pitch px-2 py-1 text-sm text-cream"
            onChange={(event) => setAverageRuns(Number(event.target.value))}
          />
        </label>
      </div>
      <label className="mt-2 flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" className="accent-gold" checked={bowls} onChange={(event) => setBowls(event.target.checked)} />
        Bowling figures
      </label>
      {inAttack ? (
        <p className="mt-1 text-xs text-muted">
          This place is in the attack. Turning bowling off keeps a part-time spell when the other bowlers are already on four overs.
        </p>
      ) : null}
      {bowls ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[11px] text-muted uppercase">
            Economy
            <input
              type="number"
              value={economy}
              className="rounded-md border border-line bg-pitch px-2 py-1 text-sm text-cream"
              onChange={(event) => setEconomy(Number(event.target.value))}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-muted uppercase">
            Bowling strike rate
            <input
              type="number"
              value={bowlSr}
              className="rounded-md border border-line bg-pitch px-2 py-1 text-sm text-cream"
              onChange={(event) => setBowlSr(Number(event.target.value))}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-muted uppercase">
            Style
            <select
              value={style}
              className="rounded-md border border-line bg-pitch px-2 py-1 text-sm text-cream"
              onChange={(event) => setStyle(event.target.value as BowlingStyle)}
            >
              <option value="pace">Pace</option>
              <option value="spin">Spin</option>
            </select>
          </label>
          <fieldset className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <legend className="mb-1 text-[11px] tracking-wide uppercase">Phases</legend>
            {(["powerplay", "middle", "death"] as Phase[]).map((phase) => (
              <label key={phase} className="flex items-center gap-1 capitalize">
                <input
                  type="checkbox"
                  className="accent-gold"
                  checked={phases.includes(phase)}
                  onChange={() => togglePhase(phase)}
                />
                {phase}
              </label>
            ))}
          </fieldset>
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-40"
          disabled={name.trim().length === 0}
          onClick={() =>
            onSave({
              id: `custom-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
              name: name.trim(),
              role,
              batting: {
                strikeRate: clamp(strikeRate, 40, 250),
                average: clamp(average, 4, 80),
              },
              bowling: bowls
                ? {
                    economy: clamp(economy, 4, 16),
                    strikeRate: clamp(bowlSr, 8, 40),
                    style,
                    phases: phases.length > 0 ? phases : ["middle"],
                  }
                : undefined,
            })
          }
        >
          Save player
        </button>
        <button type="button" className="rounded-full px-3 py-1.5 text-xs text-muted hover:text-foam" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </li>
  );
}

function roleLabel(role: Role): string {
  if (role === "wicketkeeper") return "WK";
  if (role === "allrounder") return "AR";
  if (role === "bowler") return "BOWL";
  return "BAT";
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
