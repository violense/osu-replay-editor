export type Vec2 = { x: number; y: number };

const BEZIER_TOLERANCE = 0.25;
const CATMULL_DETAIL = 36;
const CIRCULAR_ARC_TOLERANCE = 0.1;

export type SliderPathSegment = { type: 'B' | 'L' | 'C' | 'P'; points: Vec2[] };

function distSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function catmullFindPoint(v1: Vec2, v2: Vec2, v3: Vec2, v4: Vec2, t: number): Vec2 {
  const t2 = t * t;
  const t3 = t * t2;
  return {
    x:
      0.5 *
      (2 * v2.x +
        (-v1.x + v3.x) * t +
        (2 * v1.x - 5 * v2.x + 4 * v3.x - v4.x) * t2 +
        (-v1.x + 3 * v2.x - 3 * v3.x + v4.x) * t3),
    y:
      0.5 *
      (2 * v2.y +
        (-v1.y + v3.y) * t +
        (2 * v1.y - 5 * v2.y + 4 * v3.y - v4.y) * t2 +
        (-v1.y + 3 * v2.y - 3 * v3.y + v4.y) * t3),
  };
}

function catmullToPiecewiseLinear(controlPoints: Vec2[]): Vec2[] {
  if (controlPoints.length < 2) return controlPoints.slice();
  const result: Vec2[] = [];
  for (let i = 0; i < controlPoints.length - 1; i++) {
    const v1 = i > 0 ? controlPoints[i - 1] : controlPoints[i];
    const v2 = controlPoints[i];
    const v3 = i < controlPoints.length - 1 ? controlPoints[i + 1] : { x: v2.x + v2.x - v1.x, y: v2.y + v2.y - v1.y };
    const v4 =
      i < controlPoints.length - 2
        ? controlPoints[i + 2]
        : { x: v3.x + v3.x - v2.x, y: v3.y + v3.y - v2.y };
    for (let c = 0; c < CATMULL_DETAIL; c++) {
      result.push(catmullFindPoint(v1, v2, v3, v4, c / CATMULL_DETAIL));
      result.push(catmullFindPoint(v1, v2, v3, v4, (c + 1) / CATMULL_DETAIL));
    }
  }
  return result;
}

function linearToPiecewiseLinear(controlPoints: Vec2[]): Vec2[] {
  return controlPoints.map((p) => ({ ...p }));
}

type CircularArcPr =
  | { valid: false }
  | { valid: true; thetaStart: number; thetaRange: number; direction: number; radius: number; centre: Vec2 };

function circularArcProps(a: Vec2, b: Vec2, c: Vec2): CircularArcPr {
  const cross = (b.y - a.y) * (c.x - a.x) - (b.x - a.x) * (c.y - a.y);
  if (Math.abs(cross) < 1e-5) return { valid: false };

  const aSq = a.x * a.x + a.y * a.y;
  const bSq = b.x * b.x + b.y * b.y;
  const cSq = c.x * c.x + c.y * c.y;
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  const centre: Vec2 = {
    x: (aSq * (b.y - c.y) + bSq * (c.y - a.y) + cSq * (a.y - b.y)) / d,
    y: (aSq * (c.x - b.x) + bSq * (a.x - c.x) + cSq * (b.x - a.x)) / d,
  };

  const dA = { x: a.x - centre.x, y: a.y - centre.y };
  const dC = { x: c.x - centre.x, y: c.y - centre.y };
  const radius = Math.hypot(dA.x, dA.y);
  let thetaStart = Math.atan2(dA.y, dA.x);
  let thetaEnd = Math.atan2(dC.y, dC.x);
  while (thetaEnd < thetaStart) thetaEnd += 2 * Math.PI;

  let direction = 1;
  let thetaRange = thetaEnd - thetaStart;
  const orthoAtoC = { x: c.y - a.y, y: -(c.x - a.x) };
  if (orthoAtoC.x * (b.x - a.x) + orthoAtoC.y * (b.y - a.y) < 0) {
    direction = -1;
    thetaRange = 2 * Math.PI - thetaRange;
  }
  return { valid: true, thetaStart, thetaRange, direction, radius, centre };
}

function circularArcToPiecewiseLinear(controlPoints: Vec2[]): Vec2[] {
  if (controlPoints.length < 3) return linearToPiecewiseLinear(controlPoints);
  const pr = circularArcProps(controlPoints[0], controlPoints[1], controlPoints[2]);
  if (!pr.valid) return linearToPiecewiseLinear(controlPoints);

  const { thetaStart, thetaRange, direction, radius, centre } = pr;
  const amountPoints =
    2 * radius <= CIRCULAR_ARC_TOLERANCE
      ? 2
      : Math.min(
          512,
          Math.max(
            2,
            Math.ceil(
              thetaRange / (2 * Math.acos(Math.min(1, Math.max(-1, 1 - CIRCULAR_ARC_TOLERANCE / radius))))
            )
          )
        );
  const out: Vec2[] = [];
  for (let i = 0; i < amountPoints; ++i) {
    const fract = i / (amountPoints - 1);
    const theta = thetaStart + direction * fract * thetaRange;
    out.push({ x: centre.x + Math.cos(theta) * radius, y: centre.y + Math.sin(theta) * radius });
  }
  return out;
}

function bezierIsFlatEnough(controlPoints: Vec2[]): boolean {
  for (let i = 1; i < controlPoints.length - 1; i++) {
    const ax = controlPoints[i - 1].x - 2 * controlPoints[i].x + controlPoints[i + 1].x;
    const ay = controlPoints[i - 1].y - 2 * controlPoints[i].y + controlPoints[i + 1].y;
    if (ax * ax + ay * ay >= BEZIER_TOLERANCE * BEZIER_TOLERANCE * 4) return false;
  }
  return true;
}

function bezierSubdivide(controlPoints: Vec2[], l: Vec2[], r: Vec2[], mid: Vec2[], count: number): void {
  for (let i = 0; i < count; ++i) mid[i] = { ...controlPoints[i] };
  for (let i = 0; i < count; i++) {
    l[i] = { ...mid[0] };
    r[count - i - 1] = { ...mid[count - i - 1] };
    for (let j = 0; j < count - i - 1; j++) {
      mid[j] = { x: (mid[j].x + mid[j + 1].x) / 2, y: (mid[j].y + mid[j + 1].y) / 2 };
    }
  }
}

function bezierApproximate(controlPoints: Vec2[], output: Vec2[], buf1: Vec2[], buf2: Vec2[], count: number): void {
  const l = buf2;
  const r = buf1;
  bezierSubdivide(controlPoints, l, r, buf1, count);
  for (let i = 0; i < count - 1; ++i) l[count + i] = { ...r[i + 1] };
  output.push({ ...controlPoints[0] });
  for (let i = 1; i < count - 1; ++i) {
    const index = 2 * i;
    output.push({
      x: 0.25 * (l[index - 1].x + 2 * l[index].x + l[index + 1].x),
      y: 0.25 * (l[index - 1].y + 2 * l[index].y + l[index + 1].y),
    });
  }
}

function bSplineToBezierInternal(controlPoints: Vec2[], degreeRef: { v: number }): Vec2[][] {
  let degree = Math.min(degreeRef.v, controlPoints.length - 1);
  degreeRef.v = degree;
  const pointCount = controlPoints.length - 1;
  const points = controlPoints.map((p) => ({ ...p }));
  const result: Vec2[][] = [];

  if (degree === pointCount) {
    result.push(points.map((p) => ({ ...p })));
  } else {
    for (let i = 0; i < pointCount - degree; i++) {
      const subBezier: Vec2[] = new Array(degree + 1);
      subBezier[0] = { ...points[i] };
      for (let j = 0; j < degree - 1; j++) {
        subBezier[j + 1] = { ...points[i + 1] };
        for (let k = 1; k < degree - j; k++) {
          const l = Math.min(k, pointCount - degree - i);
          const pi = i + k;
          points[pi] = {
            x: (l * points[pi].x + points[pi + 1].x) / (l + 1),
            y: (l * points[pi].y + points[pi + 1].y) / (l + 1),
          };
        }
      }
      subBezier[degree] = { ...points[i + 1] };
      result.push(subBezier);
    }
    result.push(points.slice(pointCount - degree).map((p) => ({ ...p })));
  }
  return result;
}

function bSplineToPiecewiseLinear(controlPoints: Vec2[], degree: number): Vec2[] {
  if (controlPoints.length < 2) return controlPoints.length === 0 ? [] : [{ ...controlPoints[0] }];
  const degRef = { v: degree };
  const beziers = bSplineToBezierInternal(controlPoints, degRef);
  const d = degRef.v;
  const pointCount = controlPoints.length - 1;
  const output: Vec2[] = [];
  const subdivisionBuffer1: Vec2[] = new Array(d + 1);
  const subdivisionBuffer2: Vec2[] = new Array(d * 2 + 1);
  const leftChild = subdivisionBuffer2;
  const stack: Vec2[][] = [...beziers].reverse().map((bz) => bz.map((p) => ({ ...p })));

  while (stack.length > 0) {
    const parent = stack.pop()!;
    if (bezierIsFlatEnough(parent)) {
      bezierApproximate(parent, output, subdivisionBuffer1, subdivisionBuffer2, d + 1);
    } else {
      const rightChild: Vec2[] = Array.from({ length: d + 1 }, () => ({ x: 0, y: 0 }));
      bezierSubdivide(parent, leftChild, rightChild, subdivisionBuffer1, d + 1);
      for (let i = 0; i < d + 1; ++i) parent[i] = { ...leftChild[i] };
      stack.push(rightChild);
      stack.push(parent);
    }
  }
  output.push({ ...controlPoints[pointCount] });
  return output;
}

function bezierTypeToPiecewiseLinear(controlPoints: Vec2[]): Vec2[] {
  if (controlPoints.length < 2) return controlPoints.length === 0 ? [] : [{ ...controlPoints[0] }];
  const degree = Math.max(1, controlPoints.length - 1);
  return bSplineToPiecewiseLinear(controlPoints, degree);
}

function tessellateOneSegment(seg: SliderPathSegment): Vec2[] {
  const pts = seg.points;
  if (pts.length < 2) return pts.map((p) => ({ ...p }));
  switch (seg.type) {
    case 'L':
      return linearToPiecewiseLinear(pts);
    case 'C':
      return catmullToPiecewiseLinear(pts);
    case 'P':
      return pts.length === 3 ? circularArcToPiecewiseLinear(pts) : bezierTypeToPiecewiseLinear(pts);
    default:
      return bezierTypeToPiecewiseLinear(pts);
  }
}

export function parseSliderPathSegments(pathPart: string, startX: number, startY: number): SliderPathSegment[] {
  const segs: SliderPathSegment[] = [];
  const tokens = pathPart.split('|');
  let current: SliderPathSegment | null = null;
  let lastX = startX;
  let lastY = startY;

  const flush = () => {
    if (current && current.points.length >= 2) segs.push(current);
  };

  const startSegment = (type: SliderPathSegment['type'], x = lastX, y = lastY) => {
    current = { type, points: [{ x, y }] };
  };

  const pushPoint = (x: number, y: number) => {
    if (!current) {
      current = { type: 'B', points: [{ x: lastX, y: lastY }] };
    }
    const active = current;
    const prev = active.points[active.points.length - 1];
    if (active.type === 'B' && active.points.length > 1 && distSq(prev, { x, y }) < 0.01) {
      flush();
      startSegment(active.type, x, y);
      lastX = x;
      lastY = y;
      return;
    }
    active.points.push({ x, y });
    lastX = x;
    lastY = y;
  };

  for (let i = 0; i < tokens.length; i++) {
    let s = tokens[i];
    if (!s) continue;
    if (/^[BLPC]$/i.test(s)) {
      const letter = s.toUpperCase() as SliderPathSegment['type'];
      flush();
      startSegment(letter);
      continue;
    }
    if (/^[BLPC]/i.test(s)) {
      const letter = s[0].toUpperCase() as SliderPathSegment['type'];
      s = s.slice(1);
      flush();
      startSegment(letter);
      if (!s) continue;
    }
    const m = /^(-?\d+(?:\.\d+)?)\s*:\s*(-?\d+(?:\.\d+)?)$/.exec(s);
    if (m) pushPoint(Number(m[1]), Number(m[2]));
  }
  flush();
  return segs;
}

function nearlySame(a: Vec2, b: Vec2): boolean {
  return distSq(a, b) < 0.25;
}

export function tessellateSliderPath(pathPart: string, startX: number, startY: number): Vec2[] {
  const segments = parseSliderPathSegments(pathPart, startX, startY);
  if (segments.length === 0) return [{ x: startX, y: startY }];
  const out: Vec2[] = [];
  for (const seg of segments) {
    const piece = tessellateOneSegment(seg);
    for (let i = 0; i < piece.length; i++) {
      if (out.length > 0 && nearlySame(out[out.length - 1], piece[i])) continue;
      out.push(piece[i]);
    }
  }
  return out.length > 1 ? out : [{ x: startX, y: startY }, { x: startX, y: startY }];
}

export function trimPolylineToLength(points: Vec2[], expectedLength: number | null | undefined): Vec2[] {
  if (!Number.isFinite(expectedLength) || expectedLength == null || expectedLength <= 0 || points.length < 2) {
    return points;
  }

  const out: Vec2[] = [{ ...points[0] }];
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len <= 1e-6) continue;
    if (walked + len >= expectedLength) {
      const u = Math.max(0, Math.min(1, (expectedLength - walked) / len));
      out.push({ x: a.x + dx * u, y: a.y + dy * u });
      return out;
    }
    out.push({ ...b });
    walked += len;
  }

  const last = out[out.length - 1];
  const prev = out.length >= 2 ? out[out.length - 2] : points[points.length - 2];
  const remaining = expectedLength - walked;
  const dx = last.x - prev.x;
  const dy = last.y - prev.y;
  const len = Math.hypot(dx, dy);
  if (remaining > 0 && len > 1e-6 && distSq(points[points.length - 1], points[points.length - 2]) >= 0.01) {
    out.push({ x: last.x + (dx / len) * remaining, y: last.y + (dy / len) * remaining });
  }
  return out;
}
