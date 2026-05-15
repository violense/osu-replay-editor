import React, { useMemo } from 'react';
import type { ParsedHitObject } from '../types/beatmap';
import type { ReplayFrame } from '../types/replay';

const K1_MASK = 1 | 4;
const K2_MASK = 2 | 8;

type ReplayTimelineProps = {
  frames: ReplayFrame[];
  cum: number[];
  durationMs: number;
  currentTimeMs: number;
  hitObjects: ParsedHitObject[];
  onSeek: (ms: number) => void;
};

function buildKeyBlocks(frames: ReplayFrame[], cum: number[], durationMs: number, mask: number) {
  const dur = Math.max(1, durationMs);
  const blocks: { l: number; w: number }[] = [];
  let i = 0;
  const n = frames.length;
  while (i < n) {
    while (i < n && (frames[i].keys & mask) === 0) i += 1;
    if (i >= n) break;
    const t0 = i === 0 ? 0 : cum[i - 1];
    let j = i;
    while (j < n && (frames[j].keys & mask) !== 0) j += 1;
    const t1 = cum[j - 1];
    blocks.push({ l: (t0 / dur) * 100, w: Math.max(((t1 - t0) / dur) * 100, 0.06) });
    i = j;
  }
  return blocks;
}

export function ReplayTimeline({
  frames,
  cum,
  durationMs,
  currentTimeMs,
  hitObjects,
  onSeek,
}: ReplayTimelineProps) {
  const dur = Math.max(1, durationMs);
  const playPct = Math.min(100, Math.max(0, (Math.min(currentTimeMs, dur) / dur) * 100));

  const k1Blocks = useMemo(
    () => buildKeyBlocks(frames, cum, durationMs, K1_MASK),
    [frames, cum, durationMs]
  );
  const k2Blocks = useMemo(
    () => buildKeyBlocks(frames, cum, durationMs, K2_MASK),
    [frames, cum, durationMs]
  );

  const objectTicks = useMemo(() => {
    const maxTicks = 2400;
    if (hitObjects.length <= maxTicks) return hitObjects.map((o, i) => ({ o, i }));
    const step = Math.ceil(hitObjects.length / maxTicks);
    const out: { o: ParsedHitObject; i: number }[] = [];
    for (let i = 0; i < hitObjects.length; i += step) out.push({ o: hitObjects[i], i });
    return out;
  }, [hitObjects]);

  const onTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onSeek((x / rect.width) * dur);
  };

  const trackClass =
    'relative h-4 rounded-md bg-[#140810] border border-rose-500/15 cursor-pointer overflow-hidden';

  return (
    <div className="flex flex-col gap-0.5 px-1.5 pb-1.5 select-none">
      <div className={trackClass} onClick={onTrackClick}>
        <div className="absolute inset-y-0 left-0 w-full pointer-events-none">
          {k1Blocks.map((b, i) => (
            <div
              key={`k1b-${i}-${b.l}`}
              className="absolute top-0.5 bottom-0.5 rounded-sm bg-rose-400/55"
              style={{ left: `${b.l}%`, width: `${b.w}%` }}
            />
          ))}
        </div>
        <div
          className="absolute top-0 bottom-0 w-px bg-rose-100 z-10 pointer-events-none shadow-[0_0_6px_rgba(251,113,133,0.9)]"
          style={{ left: `${playPct}%` }}
        />
        <span className="absolute left-1 top-0.5 text-[7px] font-bold text-rose-300/35 uppercase tracking-wider">
          K1
        </span>
      </div>
      <div className={trackClass} onClick={onTrackClick}>
        <div className="absolute inset-y-0 left-0 w-full pointer-events-none">
          {objectTicks.map(({ o, i }) => {
            const pct = (o.time / dur) * 100;
            const left = Math.min(100, Math.max(0, pct));
            return (
            <div
              key={`obj-${i}-${o.time}`}
              className="absolute top-1 bottom-1 w-px bg-pink-300/75"
              style={{ left: `${left}%` }}
            />
            );
          })}
        </div>
        <div
          className="absolute top-0 bottom-0 w-px bg-rose-100 z-10 pointer-events-none shadow-[0_0_6px_rgba(251,113,133,0.9)]"
          style={{ left: `${playPct}%` }}
        />
        <span className="absolute left-1 top-0.5 text-[7px] font-bold text-rose-300/35 uppercase tracking-wider">
          Obj
        </span>
      </div>
      <div className={trackClass} onClick={onTrackClick}>
        <div className="absolute inset-y-0 left-0 w-full pointer-events-none">
          {k2Blocks.map((b, i) => (
            <div
              key={`k2b-${i}-${b.l}`}
              className="absolute top-0.5 bottom-0.5 rounded-sm bg-pink-400/50"
              style={{ left: `${b.l}%`, width: `${b.w}%` }}
            />
          ))}
        </div>
        <div
          className="absolute top-0 bottom-0 w-px bg-rose-100 z-10 pointer-events-none shadow-[0_0_6px_rgba(251,113,133,0.9)]"
          style={{ left: `${playPct}%` }}
        />
        <span className="absolute left-1 top-0.5 text-[7px] font-bold text-rose-300/35 uppercase tracking-wider">
          K2
        </span>
      </div>
    </div>
  );
}
