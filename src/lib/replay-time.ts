import type { ReplayFrame } from '../types/replay';

const START_X = 256;
const START_Y = 192;

export function cumulativeTimes(frames: ReplayFrame[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const f of frames) {
    acc += f.timeDelta;
    out.push(acc);
  }
  return out;
}

export function replayDurationMs(frames: ReplayFrame[]): number {
  if (!frames.length) return 0;
  let acc = 0;
  for (const f of frames) acc += f.timeDelta;
  return acc;
}

export function frameIndexAtTime(frames: ReplayFrame[], cum: number[], tMs: number): number {
  if (!frames.length) return 0;
  if (tMs <= 0) return 0;
  for (let i = 0; i < cum.length; i++) {
    if (tMs <= cum[i]) return i;
  }
  return frames.length - 1;
}

export function cursorAtTime(
  frames: ReplayFrame[],
  cum: number[],
  tMs: number
): { x: number; y: number; index: number } {
  if (!frames.length) return { x: START_X, y: START_Y, index: 0 };
  if (!cum.length || cum.length !== frames.length) {
    return { x: frames[0].x, y: frames[0].y, index: 0 };
  }
  const t0 = cum[0];
  if (tMs <= 0) {
    return { x: START_X, y: START_Y, index: 0 };
  }
  if (tMs < t0 && t0 > 0) {
    const u = tMs / t0;
    return {
      x: START_X + (frames[0].x - START_X) * u,
      y: START_Y + (frames[0].y - START_Y) * u,
      index: 0,
    };
  }
  const i = frameIndexAtTime(frames, cum, tMs);
  if (i === 0) return { x: frames[0].x, y: frames[0].y, index: 0 };
  const prevT = cum[i - 1];
  const nextT = cum[i];
  const prevF = frames[i - 1];
  const nextF = frames[i];
  if (nextT <= prevT) return { x: nextF.x, y: nextF.y, index: i };
  const u = Math.max(0, Math.min(1, (tMs - prevT) / (nextT - prevT)));
  return {
    x: prevF.x + (nextF.x - prevF.x) * u,
    y: prevF.y + (nextF.y - prevF.y) * u,
    index: i,
  };
}

export function trailIndexRange(
  cum: number[],
  centerMs: number,
  backMs: number,
  aheadMs: number
): { start: number; end: number } {
  if (!cum.length) return { start: 0, end: 0 };
  const tLo = Math.max(0, centerMs - backMs);
  const tHi = centerMs + aheadMs;
  let start = 0;
  while (start < cum.length && cum[start] < tLo) start += 1;
  if (start > 0) start -= 1;
  let end = start;
  for (let i = start; i < cum.length; i += 1) {
    if (cum[i] <= tHi) end = i;
    else break;
  }
  return { start, end };
}
