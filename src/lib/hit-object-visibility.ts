import type { ParsedHitObject } from '../types/beatmap';
import {
  SLIDER_DURATION_MIN_MS,
  SLIDER_DURATION_MAX_MS,
  SLIDER_TAIL_VISIBLE_MS,
  SPINNER_PAD_AFTER_MS,
  SPINNER_PAD_BEFORE_MS,
} from '../config/replay';

export function pathLengthOsuPx(points: { x: number; y: number }[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    sum += Math.hypot(dx, dy);
  }
  return sum;
}

export function sliderApproxEndMs(o: Extract<ParsedHitObject, { kind: 'slider' }>): number {
  if (o.approxEndMs != null && Number.isFinite(o.approxEndMs) && o.approxEndMs > o.time) {
    return o.approxEndMs;
  }
  const repeats = Math.max(0, o.repeatCount ?? 0);
  const oneWay =
    o.lengthPx != null && Number.isFinite(o.lengthPx) && o.lengthPx > 0 ? o.lengthPx : pathLengthOsuPx(o.points);
  const span = oneWay * (1 + repeats);
  const fromPath = (span / 180) * 450;
  return o.time + Math.min(SLIDER_DURATION_MAX_MS, Math.max(SLIDER_DURATION_MIN_MS, fromPath));
}

export function isHitObjectVisibleAt(
  nowMs: number,
  o: ParsedHitObject,
  preemptMs: number,
  circleHideAtMs: number | null,
  sliderTailMs: number = SLIDER_TAIL_VISIBLE_MS
): boolean {
  if (o.kind === 'spinner') {
    return nowMs >= o.time - SPINNER_PAD_BEFORE_MS && nowMs <= o.endTime + SPINNER_PAD_AFTER_MS;
  }
  if (o.kind === 'slider') {
    const end = sliderApproxEndMs(o);
    return nowMs >= o.time - preemptMs && nowMs <= end + sliderTailMs;
  }
  const hideAt = circleHideAtMs != null && Number.isFinite(circleHideAtMs) ? circleHideAtMs : o.time;
  return nowMs >= o.time - preemptMs && nowMs <= hideAt + 1;
}
