import type { ParsedHitObject } from '../types/beatmap';
import type { ReplayFrame } from '../types/replay';
import { cumulativeTimes, cursorAtTime } from './replay-time';

const KEY_MASK = 1 | 2 | 4 | 8;

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export function syncAnchors(objects: ParsedHitObject[], limit = 96): { time: number; x: number; y: number }[] {
  const out: { time: number; x: number; y: number }[] = [];
  for (const o of objects) {
    if (o.kind === 'circle') out.push({ time: o.time, x: o.x, y: o.y });
    else if (o.kind === 'slider') out.push({ time: o.time, x: o.x, y: o.y });
    if (out.length >= limit) break;
  }
  return out;
}

function pressTimes(frames: ReplayFrame[], limit = 120): number[] {
  const out: number[] = [];
  let t = 0;
  let prev = 0;
  for (const f of frames) {
    t += f.timeDelta;
    const k = f.keys & KEY_MASK;
    if ((k & ~prev) !== 0) {
      out.push(t);
      if (out.length >= limit) break;
    }
    prev = k;
  }
  return out;
}

function nearestPressHint(objects: ParsedHitObject[], frames: ReplayFrame[]): number | null {
  const heads: { time: number }[] = [];
  for (const o of objects) {
    if (o.kind === 'circle' || o.kind === 'slider') {
      heads.push({ time: o.time });
      if (heads.length >= 40) break;
    }
  }
  if (!heads.length) return null;
  const presses = pressTimes(frames);
  if (!presses.length) return null;
  const deltas: number[] = [];
  for (const h of heads) {
    let bestAbs = 1e12;
    let bestD = 0;
    for (const p of presses) {
      const d = p - h.time;
      const ad = Math.abs(d);
      if (ad < bestAbs && ad < 950) {
        bestAbs = ad;
        bestD = d;
      }
    }
    if (bestAbs < 950) deltas.push(bestD);
  }
  return median(deltas);
}

function scoreOffset(
  offsetMs: number,
  anchors: { time: number; x: number; y: number }[],
  frames: ReplayFrame[],
  cum: number[],
  hint: number | null
): number {
  const tMax = cum[cum.length - 1];
  const ds: number[] = [];
  for (const a of anchors) {
    const t = Math.min(Math.max(0, a.time + offsetMs), tMax);
    const c = cursorAtTime(frames, cum, t);
    ds.push(Math.hypot(c.x - a.x, c.y - a.y));
  }
  const base = median(ds);
  if (base == null) return Number.POSITIVE_INFINITY;
  const pen = hint == null ? 0 : Math.abs(offsetMs - hint) * 0.012;
  return base + pen;
}

function bestInRange(
  center: number,
  radius: number,
  step: number,
  anchors: { time: number; x: number; y: number }[],
  frames: ReplayFrame[],
  cum: number[],
  hint: number | null
): number {
  let best = center;
  let bestS = Number.POSITIVE_INFINITY;
  for (let o = center - radius; o <= center + radius; o += step) {
    const r = Math.round(o);
    const s = scoreOffset(r, anchors, frames, cum, hint);
    if (s < bestS) {
      bestS = s;
      best = r;
    }
  }
  return best;
}

export function estimateBeatmapOffsetMs(objects: ParsedHitObject[], frames: ReplayFrame[]): number {
  const anchors = syncAnchors(objects, 96);
  if (!anchors.length || !frames.length) return 0;
  const cum = cumulativeTimes(frames);
  const hint = nearestPressHint(objects, frames);
  if (anchors.length < 4) return Math.round(hint ?? 0);

  const coarseCenter = hint ?? 0;
  const coarseRadius = hint == null ? 12000 : 2800;
  const coarseStep = hint == null ? 120 : 35;
  const coarse = bestInRange(coarseCenter, coarseRadius, coarseStep, anchors, frames, cum, hint);
  const fine = bestInRange(coarse, 140, 5, anchors, frames, cum, hint);
  return Math.round(bestInRange(fine, 18, 1, anchors, frames, cum, hint));
}
