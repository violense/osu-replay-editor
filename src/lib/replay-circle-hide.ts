import type { ParsedHitObject } from '../types/beatmap';
import type { ReplayFrame } from '../types/replay';
import { frameIndexAtTime } from './replay-time';

const KEY_MASK = 1 | 2 | 4 | 8;

export function buildCircleHideAtByIndex(
  hitObjects: ParsedHitObject[],
  frames: ReplayFrame[],
  cum: number[]
): Float64Array {
  const out = new Float64Array(hitObjects.length);
  if (!cum.length) {
    for (let i = 0; i < hitObjects.length; i++) {
      const o = hitObjects[i];
      out[i] = o.kind === 'circle' ? o.time : 0;
    }
    return out;
  }

  for (let i = 0; i < hitObjects.length; i++) {
    const o = hitObjects[i];
    if (o.kind !== 'circle') {
      out[i] = 0;
      continue;
    }
    const t = o.time;
    let hideAt = t;
    const fiLo = frameIndexAtTime(frames, cum, Math.max(0, t - 100));
    for (let fi = Math.max(0, fiLo - 2); fi < frames.length; fi++) {
      const pt = cum[fi];
      if (pt < t - 85) continue;
      if (pt > t + 140) break;
      const prevK = fi > 0 ? frames[fi - 1].keys & KEY_MASK : 0;
      const k = frames[fi].keys & KEY_MASK;
      if ((k & ~prevK) === 0) continue;
      hideAt = pt;
      break;
    }
    out[i] = hideAt;
  }
  return out;
}
