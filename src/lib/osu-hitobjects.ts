import type { OsuParseResult, ParsedHitObject } from '../types/beatmap';
import { SLIDER_DURATION_MAX_MS, SLIDER_DURATION_MIN_MS } from '../config/replay';
import { pathLengthOsuPx } from './hit-object-visibility';
import { parseBeatmapFieldsFromOsuText, sliderTimingAtHitTime } from './osu-beatmap-meta';
import { tessellateSliderPath, trimPolylineToLength } from './osu-slider-tessellation';
import { decodeOsuFile, splitOsuCsvPrefix } from './osu-text';

type BeatmapFields = ReturnType<typeof parseBeatmapFieldsFromOsuText>;

function splitSliderTailMetadata(tail: string): {
  pathPart: string;
  slides: number;
  lengthPx: number | null;
} {
  const t = tail.trim();
  const parts = t.split(',');
  const pathPart = parts[0]?.trim() ?? '';
  const slides = Number(parts[1]);
  const lengthPx = Number(parts[2]);
  return {
    pathPart,
    slides: Number.isFinite(slides) && slides > 0 ? Math.floor(slides) : 1,
    lengthPx: Number.isFinite(lengthPx) ? lengthPx : null,
  };
}

function dedupePathPoints(pts: { x: number; y: number }[], eps: number): { x: number; y: number }[] {
  if (pts.length < 2) return pts;
  const out: { x: number; y: number }[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    const q = out[out.length - 1];
    if (Math.hypot(p.x - q.x, p.y - q.y) >= eps) out.push(p);
  }
  if (out.length === 1) out.push(pts[pts.length - 1]);
  return out;
}

function sliderEndAbsoluteMs(
  time: number,
  lengthPx: number | null,
  pathLenPx: number,
  slides: number,
  sliderMultiplier: number,
  beatMs: number,
  svMultiplier: number
): number {
  const oneWay = lengthPx != null && lengthPx > 0 ? lengthPx : pathLenPx;
  const span = oneWay * Math.max(1, slides);
  const vel = 100 * sliderMultiplier * svMultiplier;
  const dur = (span / vel) * beatMs;
  const clamped = Math.min(SLIDER_DURATION_MAX_MS, Math.max(SLIDER_DURATION_MIN_MS, dur));
  return time + clamped;
}

function findHitObjectsSectionStart(lines: string[]): number {
  return lines.findIndex((raw) => {
    const line = raw.replace(/^\uFEFF/, '').trim();
    return /^\[HitObjects\]$/i.test(line);
  });
}

function parseHitObjectLine(rawLine: string, fields: BeatmapFields): ParsedHitObject | null {
  const line = rawLine.trim();
  if (!line || line.startsWith('//') || line.startsWith('_')) return null;
  const parts = splitOsuCsvPrefix(line, 6);
  if (parts.length < 5) return null;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  const time = Number(parts[2]);
  const type = Number(parts[3]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(time) || !Number.isFinite(type)) return null;

  const newCombo = (type & 4) !== 0;
  const tail = (parts[5] ?? '').trim();

  if ((type & 8) !== 0) {
    const first = tail.split(',')[0] ?? '';
    const endTime = Number(first);
    return {
      kind: 'spinner',
      x,
      y,
      time,
      endTime: Number.isFinite(endTime) ? endTime : time + 2000,
    };
  }

  if ((type & 2) !== 0) {
    if (!tail) return null;
    const { pathPart, slides, lengthPx } = splitSliderTailMetadata(tail);
    const rawPts = tessellateSliderPath(pathPart, x, y);
    const trimmed = trimPolylineToLength(rawPts.length > 1 ? rawPts : [{ x, y }, { x: x + 0.5, y: y + 0.5 }], lengthPx);
    const pts = dedupePathPoints(trimmed, 0.35);
    const pathLen = pathLengthOsuPx(pts);
    const sliderTiming = sliderTimingAtHitTime(fields.timingPoints, time);
    const approxEndMs = sliderEndAbsoluteMs(
      time,
      lengthPx,
      pathLen,
      slides,
      fields.sliderMultiplier,
      sliderTiming.beatLengthMs,
      sliderTiming.sliderVelocityMultiplier
    );
    return {
      kind: 'slider',
      x,
      y,
      time,
      points: pts.length > 1 ? pts : [{ x, y }, { x: x + 0.5, y: y + 0.5 }],
      repeatCount: Math.max(0, slides - 1),
      slides,
      approxEndMs,
      ...(lengthPx != null && lengthPx > 0 ? { lengthPx } : {}),
      ...(newCombo ? { newCombo: true } : {}),
    };
  }

  if ((type & 1) !== 0) {
    return { kind: 'circle', x, y, time, ...(newCombo ? { newCombo: true } : {}) };
  }

  return null;
}

export function parseHitObjectsFromOsuText(text: string): OsuParseResult {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const fields = parseBeatmapFieldsFromOsuText(normalized);
  const lines = normalized.split('\n');
  const start = findHitObjectsSectionStart(lines);
  if (start === -1) {
    return {
      objects: [],
      hitObjectLineCount: 0,
      skippedLines: 0,
      approachRate: fields.approachRate,
      sliderMultiplier: fields.sliderMultiplier,
      beatLengthMs: fields.beatLengthMs,
      timingPoints: fields.timingPoints,
    };
  }
  const objects: ParsedHitObject[] = [];
  let hitObjectLineCount = 0;
  let skippedLines = 0;
  for (let i = start + 1; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    if (!t) continue;
    if (t.startsWith('[')) break;
    hitObjectLineCount += 1;
    const obj = parseHitObjectLine(t, fields);
    if (obj) objects.push(obj);
    else skippedLines += 1;
  }
  objects.sort((a, b) => a.time - b.time);
  return {
    objects,
    hitObjectLineCount,
    skippedLines,
    approachRate: fields.approachRate,
    sliderMultiplier: fields.sliderMultiplier,
    beatLengthMs: fields.beatLengthMs,
    timingPoints: fields.timingPoints,
  };
}

export function parseHitObjectsFromOsuBuffer(buffer: ArrayBuffer): OsuParseResult {
  return parseHitObjectsFromOsuText(decodeOsuFile(buffer));
}

export function parseHitObjectsFromOsu(text: string): ParsedHitObject[] {
  return parseHitObjectsFromOsuText(text).objects;
}
