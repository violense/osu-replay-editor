import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  HIT_CIRCLE_RADIUS,
  OSU_PLAYFIELD_HEIGHT,
  OSU_PLAYFIELD_PADDING,
  OSU_PLAYFIELD_WIDTH,
  SLIDER_TAIL_VISIBLE_MS,
  SLIDER_BODY_WIDTH,
  SLIDER_BORDER_WIDTH,
  SLIDER_HIGHLIGHT_WIDTH,
  SLIDER_OUTER_WIDTH,
  TRAIL_MAX_POINTS,
  TRAIL_MIN_POINT_DIST_OSU,
  TRAIL_WINDOW_AHEAD_MS,
  TRAIL_WINDOW_BACK_MS,
  VISIBLE_OBJECT_LOOKAHEAD_MS,
} from '../config/replay';
import { isHitObjectVisibleAt } from '../lib/hit-object-visibility';
import { buildCircleHideAtByIndex } from '../lib/replay-circle-hide';
import { cursorAtTime, trailIndexRange } from '../lib/replay-time';
import type { ParsedHitObject } from '../types/beatmap';
import type { ReplayFrame } from '../types/replay';

function buildComboLabels(hitObjects: ParsedHitObject[]): Int32Array {
  const labels = new Int32Array(hitObjects.length);
  let n = 0;
  for (let i = 0; i < hitObjects.length; i++) {
    const h = hitObjects[i];
    if (h.kind === 'circle' || h.kind === 'slider') {
      n += 1;
      labels[i] = n;
    }
  }
  return labels;
}

function pathTotalLength(pts: { x: number; y: number }[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return s;
}

function pointOnPolylineAt(
  pts: { x: number; y: number }[],
  dist: number
): { x: number; y: number; ang: number } | null {
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i - 1].x;
    const ay = pts[i - 1].y;
    const bx = pts[i].x;
    const by = pts[i].y;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    if (d + len >= dist) {
      const u = (dist - d) / len;
      return { x: ax + dx * u, y: ay + dy * u, ang: Math.atan2(dy, dx) };
    }
    d += len;
  }
  return null;
}

function drawSliderTicks(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], spacing: number) {
  const total = pathTotalLength(pts);
  if (total < spacing * 1.5) return;
  const tick = 4.2;
  for (let s = spacing; s < total - 6; s += spacing) {
    const p = pointOnPolylineAt(pts, s);
    if (!p) break;
    const c = Math.cos(p.ang);
    const sn = Math.sin(p.ang);
    const nx = -sn;
    const ny = c;
    ctx.beginPath();
    ctx.moveTo(p.x - c * tick * 0.35 + nx * tick * 0.35, p.y - sn * tick * 0.35 + ny * tick * 0.35);
    ctx.lineTo(p.x + c * tick * 0.35 - nx * tick * 0.35, p.y + sn * tick * 0.35 - ny * tick * 0.35);
    ctx.moveTo(p.x - c * tick * 0.35 - nx * tick * 0.35, p.y - sn * tick * 0.35 - ny * tick * 0.35);
    ctx.lineTo(p.x + c * tick * 0.35 + nx * tick * 0.35, p.y + sn * tick * 0.35 + ny * tick * 0.35);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.lineWidth = 1.05;
    ctx.stroke();
  }
}

function strokePolyline(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  width: number,
  color: string,
  lineCap: CanvasLineCap = 'round'
) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = lineCap;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function drawSliderBody(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], repeatCount: number) {
  const body = repeatCount > 0 ? 'rgba(82, 38, 78, 0.82)' : 'rgba(70, 34, 46, 0.8)';
  strokePolyline(ctx, pts, SLIDER_OUTER_WIDTH, 'rgba(255, 255, 255, 0.78)');
  strokePolyline(ctx, pts, SLIDER_BORDER_WIDTH, 'rgba(20, 11, 15, 0.96)');
  strokePolyline(ctx, pts, SLIDER_BODY_WIDTH, body);
  strokePolyline(ctx, pts, SLIDER_HIGHLIGHT_WIDTH, 'rgba(255, 255, 255, 0.32)');
}

function hitAccent(o: ParsedHitObject): { border: string; glow: string } {
  if ('newCombo' in o && o.newCombo) {
    return { border: 'rgba(196, 220, 255, 0.93)', glow: 'rgba(96, 165, 250, 0.32)' };
  }
  return { border: 'rgba(251, 207, 232, 0.95)', glow: 'rgba(244, 63, 94, 0.34)' };
}

function drawSliderRepeatHint(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  if (pts.length < 2) return;
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const px = -uy;
  const py = ux;
  const s = 6.5;
  ctx.beginPath();
  ctx.moveTo(b.x - ux * 2.2 + px * s * 0.45, b.y - uy * 2.2 + py * s * 0.45);
  ctx.lineTo(b.x - ux * 0.2, b.y - uy * 0.2);
  ctx.lineTo(b.x - ux * 2.2 - px * s * 0.45, b.y - uy * 2.2 - py * s * 0.45);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 1.35;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawApproachRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cr: number,
  preemptMs: number,
  nowMs: number,
  hitTime: number
) {
  if (nowMs >= hitTime || nowMs < hitTime - preemptMs) return;
  const u = (nowMs - (hitTime - preemptMs)) / Math.max(1, preemptMs);
  const outer = cr + (1 - u) * Math.min(92, preemptMs * 0.044);
  const a = 0.18 + 0.52 * (1 - u);
  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(251, 113, 133, ${a})`;
  ctx.lineWidth = 2.85;
  ctx.stroke();
}

type PlayfieldCanvasProps = {
  frames: ReplayFrame[];
  cum: number[];
  hitObjects: ParsedHitObject[];
  currentTimeMs: number;
  preemptMs: number;
  canEdit: boolean;
  onMoveCursor: (frameIndex: number, x: number, y: number) => void;
  hint?: string | null;
};

export function PlayfieldCanvas({
  frames,
  cum,
  hitObjects,
  currentTimeMs,
  preemptMs,
  canEdit,
  onMoveCursor,
  hint,
}: PlayfieldCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 640, h: 480 });
  const dragRef = useRef(false);

  const circleHideAt = useMemo(
    () => buildCircleHideAtByIndex(hitObjects, frames, cum),
    [hitObjects, frames, cum]
  );
  const comboLabels = useMemo(() => buildComboLabels(hitObjects), [hitObjects]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(160, r.width), h: Math.max(120, r.height) });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setSize({ w: Math.max(160, r.width), h: Math.max(120, r.height) });
    return () => ro.disconnect();
  }, []);

  const cssToOsu = useCallback(
    (px: number, py: number) => {
      const sc = Math.min(
        size.w / (OSU_PLAYFIELD_WIDTH + OSU_PLAYFIELD_PADDING * 2),
        size.h / (OSU_PLAYFIELD_HEIGHT + OSU_PLAYFIELD_PADDING * 2)
      );
      const offX = (size.w - OSU_PLAYFIELD_WIDTH * sc) / 2;
      const offY = (size.h - OSU_PLAYFIELD_HEIGHT * sc) / 2;
      const x = (px - offX) / sc;
      const y = (py - offY) / sc;
      return {
        x: Math.max(0, Math.min(OSU_PLAYFIELD_WIDTH, x)),
        y: Math.max(0, Math.min(OSU_PLAYFIELD_HEIGHT, y)),
      };
    },
    [size]
  );

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.floor(size.w * dpr);
    c.height = Math.floor(size.h * dpr);
    c.style.width = `${size.w}px`;
    c.style.height = `${size.h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    const sc = Math.min(
      size.w / (OSU_PLAYFIELD_WIDTH + OSU_PLAYFIELD_PADDING * 2),
      size.h / (OSU_PLAYFIELD_HEIGHT + OSU_PLAYFIELD_PADDING * 2)
    );
    const offX = (size.w - OSU_PLAYFIELD_WIDTH * sc) / 2;
    const offY = (size.h - OSU_PLAYFIELD_HEIGHT * sc) / 2;
    ctx.fillStyle = '#090508';
    ctx.fillRect(0, 0, size.w, size.h);
    const vignette = ctx.createRadialGradient(
      size.w * 0.5,
      size.h * 0.42,
      0,
      size.w * 0.5,
      size.h * 0.5,
      Math.max(size.w, size.h) * 0.72
    );
    vignette.addColorStop(0, 'rgba(26, 8, 18, 0.35)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, size.w, size.h);
    ctx.save();
    ctx.translate(offX, offY);
    ctx.scale(sc, sc);
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.035)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= OSU_PLAYFIELD_WIDTH; gx += 32) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, OSU_PLAYFIELD_HEIGHT);
      ctx.stroke();
    }
    for (let gy = 0; gy <= OSU_PLAYFIELD_HEIGHT; gy += 32) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(OSU_PLAYFIELD_WIDTH, gy);
      ctx.stroke();
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(
      -OSU_PLAYFIELD_PADDING,
      -OSU_PLAYFIELD_PADDING,
      OSU_PLAYFIELD_WIDTH + OSU_PLAYFIELD_PADDING * 2,
      OSU_PLAYFIELD_HEIGHT + OSU_PLAYFIELD_PADDING * 2
    );
    ctx.clip();

    if (frames.length > 1 && cum.length === frames.length) {
      const { start, end } = trailIndexRange(cum, currentTimeMs, TRAIL_WINDOW_BACK_MS, TRAIL_WINDOW_AHEAD_MS);
      const minD = TRAIL_MIN_POINT_DIST_OSU;
      const tPts: { x: number; y: number }[] = [];
      let lx = frames[start].x;
      let ly = frames[start].y;
      tPts.push({ x: lx, y: ly });
      let carry = 0;
      for (let i = start + 1; i <= end; i++) {
        const x = frames[i].x;
        const y = frames[i].y;
        carry += Math.hypot(x - lx, y - ly);
        if (carry >= minD || i === end) {
          tPts.push({ x, y });
          lx = x;
          ly = y;
          carry = 0;
        }
      }
      const curTrail = cursorAtTime(frames, cum, currentTimeMs);
      const lastTrail = tPts[tPts.length - 1];
      if (
        lastTrail &&
        Number.isFinite(curTrail.x) &&
        Number.isFinite(curTrail.y) &&
        Math.hypot(curTrail.x - lastTrail.x, curTrail.y - lastTrail.y) > 0.25
      ) {
        tPts.push({ x: curTrail.x, y: curTrail.y });
      }
      let drawPts = tPts;
      if (tPts.length > TRAIL_MAX_POINTS) {
        const st = Math.ceil(tPts.length / TRAIL_MAX_POINTS);
        const last = tPts.length - 1;
        drawPts = tPts.filter((_, pi) => pi % st === 0 || pi === last);
      }
      if (drawPts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(drawPts[0].x, drawPts[0].y);
        for (let p = 1; p < drawPts.length; p++) {
          const pt = drawPts[p];
          if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue;
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = 'rgba(244, 114, 182, 0.28)';
        ctx.lineWidth = 1.45;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }

    const visibleWindowStart = currentTimeMs - Math.max(preemptMs, TRAIL_WINDOW_BACK_MS) - 120;
    const visibleWindowEnd = currentTimeMs + Math.max(TRAIL_WINDOW_AHEAD_MS, VISIBLE_OBJECT_LOOKAHEAD_MS);
    type DrawEnt = { oi: number; o: ParsedHitObject; t: number; z: number };
    const list: DrawEnt[] = [];
    for (let oi = 0; oi < hitObjects.length; oi++) {
      const o = hitObjects[oi];
      if (o.time > visibleWindowEnd) break;
      if (o.kind !== 'slider' && o.kind !== 'spinner' && o.time < visibleWindowStart) continue;
      const ch = o.kind === 'circle' ? circleHideAt[oi] : null;
      if (!isHitObjectVisibleAt(currentTimeMs, o, preemptMs, ch, SLIDER_TAIL_VISIBLE_MS)) continue;
      const z = o.kind === 'spinner' ? 0 : o.kind === 'slider' ? 1 : 2;
      list.push({ oi, o, t: o.time, z });
    }
    list.sort((a, b) => (a.t !== b.t ? a.t - b.t : a.z - b.z));

    const cr = HIT_CIRCLE_RADIUS;
    for (const { o } of list) {
      if (o.kind === 'spinner') {
        const cx = Number.isFinite(o.x) ? o.x : 256;
        const cy = Number.isFinite(o.y) ? o.y : 192;
        ctx.beginPath();
        ctx.arc(cx, cy, 118, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(251, 182, 206, 0.45)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (o.kind === 'slider') {
        const repeats = Math.max(0, o.repeatCount ?? 0);
        drawSliderBody(ctx, o.points, repeats);
        drawSliderTicks(ctx, o.points, repeats > 0 ? 24 : 28);
        if (repeats > 0) drawSliderRepeatHint(ctx, o.points);
      }
    }

    for (const { oi, o } of list) {
      if (o.kind === 'slider') {
        const p0 = o.points[0];
        const acc = hitAccent(o);
        const lab = comboLabels[oi];
        drawApproachRing(ctx, p0.x, p0.y, cr, preemptMs, currentTimeMs, o.time);
        ctx.beginPath();
        ctx.arc(p0.x, p0.y, cr, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(30, 8, 20, 0.94)';
        ctx.fill();
        ctx.strokeStyle = acc.border;
        ctx.lineWidth = 2.4;
        ctx.shadowColor = acc.glow;
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = 'rgba(255, 241, 246, 0.95)';
        ctx.font = 'bold 17px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(lab), p0.x, p0.y);
      } else if (o.kind === 'circle') {
        const acc = hitAccent(o);
        drawApproachRing(ctx, o.x, o.y, cr, preemptMs, currentTimeMs, o.time);
        ctx.beginPath();
        ctx.arc(o.x, o.y, cr, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(30, 8, 20, 0.92)';
        ctx.fill();
        ctx.strokeStyle = acc.border;
        ctx.lineWidth = 2.4;
        ctx.shadowColor = acc.glow;
        ctx.shadowBlur = 7;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = 'rgba(255, 241, 246, 0.95)';
        ctx.font = 'bold 17px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(comboLabels[oi]), o.x, o.y);
      }
    }

    ctx.restore();

    const cur = cursorAtTime(frames, cum, currentTimeMs);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 2;
    const r = 11;
    ctx.beginPath();
    ctx.moveTo(cur.x - r, cur.y);
    ctx.lineTo(cur.x + r, cur.y);
    ctx.moveTo(cur.x, cur.y - r);
    ctx.lineTo(cur.x, cur.y + r);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cur.x, cur.y, 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.98)';
    ctx.fillStyle = 'rgba(251, 113, 133, 0.15)';
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }, [frames, cum, hitObjects, currentTimeMs, preemptMs, size, circleHideAt, comboLabels]);

  const onPointerDown = (e: PointerEvent) => {
    if (!canEdit || !canvasRef.current) return;
    dragRef.current = true;
    canvasRef.current.setPointerCapture(e.pointerId);
    const rect = canvasRef.current.getBoundingClientRect();
    const { x, y } = cssToOsu(e.clientX - rect.left, e.clientY - rect.top);
    const { index } = cursorAtTime(frames, cum, currentTimeMs);
    onMoveCursor(index, x, y);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragRef.current || !canEdit || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const { x, y } = cssToOsu(e.clientX - rect.left, e.clientY - rect.top);
    const { index } = cursorAtTime(frames, cum, currentTimeMs);
    onMoveCursor(index, x, y);
  };

  const onPointerUp = (e: PointerEvent) => {
    dragRef.current = false;
    canvasRef.current?.releasePointerCapture(e.pointerId);
  };

  const showHint = Boolean(hint);

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full min-h-[160px] rounded-lg overflow-hidden border border-rose-500/20 bg-[#0c0409]"
    >
      <canvas
        ref={canvasRef}
        className={`block touch-none ${canEdit ? 'cursor-crosshair' : 'cursor-default'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          dragRef.current = false;
        }}
      />
      {showHint && (
        <div className="pointer-events-none absolute top-2 left-2 max-w-[min(320px,92%)] rounded-md border border-rose-400/30 bg-black/60 px-2 py-1.5 text-[10px] leading-snug text-rose-100/90">
          {hint}
        </div>
      )}
    </div>
  );
}
