import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const frac = Math.floor(ms % 1000);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(frac).padStart(3, '0')}`;
}

type ReplayTransportProps = {
  currentTimeMs: number;
  durationMs: number;
  playing: boolean;
  speed: number;
  onPlayPause: () => void;
  onSeek: (ms: number) => void;
  onSpeed: (v: number) => void;
};

export function ReplayTransport({
  currentTimeMs,
  durationMs,
  playing,
  speed,
  onPlayPause,
  onSeek,
  onSpeed,
}: ReplayTransportProps) {
  const dur = Math.max(1, durationMs);
  return (
    <div className="flex flex-col gap-1 px-1.5 py-1 border-t border-rose-500/15 bg-[#10060c]/98">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="p-1 rounded-md bg-rose-950/80 hover:bg-rose-900/90 text-rose-200/80 border border-rose-500/20"
          onClick={() => onSeek(0)}
        >
          <SkipBack size={13} />
        </button>
        <button
          type="button"
          className="p-1.5 rounded-lg bg-gradient-to-br from-rose-400 to-pink-500 hover:from-rose-300 hover:to-pink-400 text-white shadow-md shadow-rose-900/40"
          onClick={onPlayPause}
        >
          {playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
        </button>
        <button
          type="button"
          className="p-1 rounded-md bg-rose-950/80 hover:bg-rose-900/90 text-rose-200/80 border border-rose-500/20"
          onClick={() => onSeek(durationMs)}
        >
          <SkipForward size={13} />
        </button>
        <span className="text-[9px] font-mono text-rose-200/90 tabular-nums shrink-0">
          {formatMs(currentTimeMs)} / {formatMs(durationMs)}
        </span>
        <input
          type="range"
          className="flex-1 min-w-0 h-1 accent-rose-400"
          min={0}
          max={dur}
          step={1}
          value={Math.min(currentTimeMs, dur)}
          onChange={(e) => onSeek(Number(e.target.value))}
        />
        <select
          className="text-[9px] bg-rose-950/90 border border-rose-500/25 rounded px-1 py-0.5 text-rose-100/90"
          value={String(speed)}
          onChange={(e) => onSpeed(Number(e.target.value))}
        >
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((v) => (
            <option key={v} value={v}>
              {v.toFixed(2)}×
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
