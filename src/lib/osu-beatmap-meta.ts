import { MOD_EASY, MOD_HARD_ROCK } from '../config/replay';

export type TimingPoint = {
  time: number;
  beatLengthMs: number;
  sliderVelocityMultiplier: number;
  inherited: boolean;
};

export type SliderTiming = {
  beatLengthMs: number;
  sliderVelocityMultiplier: number;
};

export type BeatmapParseFields = {
  approachRate: number;
  sliderMultiplier: number;
  beatLengthMs: number;
  timingPoints: TimingPoint[];
};

export function sliderTimingAtHitTime(points: TimingPoint[], hitTime: number): SliderTiming {
  let beatLengthMs = 500;
  let sliderVelocityMultiplier = 1;
  for (const p of points) {
    if (p.time > hitTime) break;
    if (p.inherited) sliderVelocityMultiplier = p.sliderVelocityMultiplier;
    else {
      beatLengthMs = p.beatLengthMs;
      sliderVelocityMultiplier = 1;
    }
  }
  return { beatLengthMs, sliderVelocityMultiplier };
}

export function parseBeatmapFieldsFromOsuText(text: string): BeatmapParseFields {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  let section: 'none' | 'diff' | 'timing' = 'none';
  let approachRate = 5;
  let sliderMultiplier = 1.4;
  const timingPoints: TimingPoint[] = [];
  for (const raw of lines) {
    const line = raw.replace(/^\uFEFF/, '').trim();
    if (!line || line.startsWith('//')) continue;
    if (/^\[Difficulty\]$/i.test(line)) {
      section = 'diff';
      continue;
    }
    if (/^\[TimingPoints\]$/i.test(line)) {
      section = 'timing';
      continue;
    }
    if (line.startsWith('[')) {
      section = 'none';
      continue;
    }
    if (section === 'diff') {
      let m = /^(?:ApproachRate|AR)\s*:\s*([\d.]+)\s*$/i.exec(line);
      if (m) {
        const v = Number(m[1]);
        if (Number.isFinite(v)) approachRate = Math.max(0, Math.min(10, v));
      }
      m = /^SliderMultiplier\s*:\s*([\d.]+)\s*$/i.exec(line);
      if (m) {
        const v = Number(m[1]);
        if (Number.isFinite(v)) sliderMultiplier = Math.max(0.4, Math.min(4, v));
      }
    }
    if (section === 'timing') {
      const m = /^(-?\d+(?:\.\d+)?),(-?[\d.]+),/.exec(line);
      if (m) {
        const t = Number(m[1]);
        const bl = Number(m[2]);
        if (Number.isFinite(t) && Number.isFinite(bl) && bl > 0) {
          timingPoints.push({
            time: t,
            beatLengthMs: Math.min(2000, Math.max(120, bl)),
            sliderVelocityMultiplier: 1,
            inherited: false,
          });
        } else if (Number.isFinite(t) && Number.isFinite(bl) && bl < 0) {
          timingPoints.push({
            time: t,
            beatLengthMs: 0,
            sliderVelocityMultiplier: Math.min(10, Math.max(0.1, -100 / bl)),
            inherited: true,
          });
        }
      }
    }
  }
  timingPoints.sort((a, b) => a.time - b.time);
  const firstBase = timingPoints.find((p) => !p.inherited);
  const beatLengthMs = firstBase ? firstBase.beatLengthMs : 500;
  return { approachRate, sliderMultiplier, beatLengthMs, timingPoints };
}

export function parseApproachRateFromOsuText(text: string): number {
  return parseBeatmapFieldsFromOsuText(text).approachRate;
}

export function preemptMsFromApproachRate(ar: number): number {
  const clamped = Math.max(0, Math.min(10, ar));
  if (clamped < 5) return 1200 + (600 * (5 - clamped)) / 5;
  return 1200 - (750 * (clamped - 5)) / 5;
}

export function approachRateWithMods(ar: number, mods: number): number {
  let out = Math.max(0, Math.min(10, ar));
  if ((mods & MOD_EASY) !== 0) out *= 0.5;
  if ((mods & MOD_HARD_ROCK) !== 0) out *= 1.4;
  return Math.max(0, Math.min(10, out));
}
