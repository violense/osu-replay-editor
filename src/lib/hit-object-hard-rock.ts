import { OSU_PLAYFIELD_HEIGHT } from '../config/replay';
import type { ParsedHitObject } from '../types/beatmap';

function flipY(y: number): number {
  return OSU_PLAYFIELD_HEIGHT - y;
}

export function applyHardRockFlipToHitObjects(objects: ParsedHitObject[]): ParsedHitObject[] {
  return objects.map((o) => {
    if (o.kind === 'circle') return { ...o, y: flipY(o.y) };
    if (o.kind === 'spinner') return { ...o, y: flipY(o.y) };
    return {
      ...o,
      y: flipY(o.y),
      points: o.points.map((pt) => ({ x: pt.x, y: flipY(pt.y) })),
    };
  });
}
