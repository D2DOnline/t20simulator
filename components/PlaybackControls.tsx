"use client";

export type PlaybackSpeed = "1x" | "4x" | "over";

export function PlaybackControls({
  playing,
  speed,
  cursor,
  total,
  onPlay,
  onPause,
  onSpeed,
  onScrub,
  onInningsBreak,
  onEnd,
}: {
  playing: boolean;
  speed: PlaybackSpeed;
  cursor: number;
  total: number;
  onPlay: () => void;
  onPause: () => void;
  onSpeed: (speed: PlaybackSpeed) => void;
  onScrub: (cursor: number) => void;
  onInningsBreak: () => void;
  onEnd: () => void;
}) {
  const label = cursor === 0 ? "0.0" : `${cursor} / ${total} deliveries`;

  return (
    <section className="rounded-2xl border border-line bg-canopy/80 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {playing ? (
          <button type="button" className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink" onClick={onPause}>
            Pause
          </button>
        ) : (
          <button
            type="button"
            className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink"
            onClick={onPlay}
            disabled={cursor >= total}
          >
            Play
          </button>
        )}
        {(["1x", "4x", "over"] as PlaybackSpeed[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSpeed(option)}
            className={`rounded-full px-3 py-2 text-xs font-semibold tracking-wide uppercase ${
              speed === option ? "bg-panel-2 text-cream" : "text-muted hover:text-foam"
            }`}
          >
            {option === "over" ? "Over" : option}
          </button>
        ))}
        <button type="button" className="rounded-full px-3 py-2 text-xs text-muted hover:text-foam" onClick={onInningsBreak}>
          Innings break
        </button>
        <button type="button" className="rounded-full px-3 py-2 text-xs text-muted hover:text-foam" onClick={onEnd}>
          Jump to end
        </button>
        <p className="ml-auto text-xs text-muted">{label}</p>
      </div>
      <label className="mt-3 block">
        <span className="sr-only">Match position</span>
        <input
          type="range"
          min={0}
          max={total}
          value={cursor}
          className="w-full accent-gold"
          aria-valuetext={`${cursor} of ${total} deliveries`}
          onChange={(event) => onScrub(Number(event.target.value))}
        />
      </label>
    </section>
  );
}
