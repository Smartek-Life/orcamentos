import { clamp } from '../utils';
import type { PlanPoint } from '../../types';

export interface AutoWallLine {
  start: PlanPoint;
  end: PlanPoint;
}

export function derivePerimeterFromWalls(lines: AutoWallLine[]): PlanPoint[] {
  if (lines.length === 0) {
    return [];
  }

  const buckets = new Map<number, { min: number; max: number }>();
  for (const line of lines) {
    const minY = Math.min(line.start.y, line.end.y);
    const maxY = Math.max(line.start.y, line.end.y);
    const minX = Math.min(line.start.x, line.end.x);
    const maxX = Math.max(line.start.x, line.end.x);

    for (let row = Math.floor(minY * 100); row <= Math.ceil(maxY * 100); row += 1) {
      const current = buckets.get(row) ?? { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY };
      current.min = Math.min(current.min, minX);
      current.max = Math.max(current.max, maxX);
      buckets.set(row, current);
    }
  }

  const rows = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
  if (rows.length < 4) {
    return [];
  }

  const leftChain = simplifyChain(
    rows.map(([row, span]) => ({
      x: clamp(span.min, 0, 1),
      y: clamp(row / 100, 0, 1),
    })),
  );
  const rightChain = simplifyChain(
    rows
      .map(([row, span]) => ({
        x: clamp(span.max, 0, 1),
        y: clamp(row / 100, 0, 1),
      }))
      .reverse(),
  );

  return [...leftChain, ...rightChain];
}

export function simplifyChain(points: PlanPoint[]): PlanPoint[] {
  const simplified: PlanPoint[] = [];

  for (const point of points) {
    const last = simplified[simplified.length - 1];
    if (!last || Math.abs(last.x - point.x) > 0.01 || Math.abs(last.y - point.y) > 0.03) {
      simplified.push(point);
    }
  }

  return simplified;
}

export function findNearestPerimeterPoint(points: PlanPoint[], point: PlanPoint, threshold: number): number {
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  points.forEach((candidate, index) => {
    const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (distance < threshold && distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

export function pointInPolygon(point: PlanPoint, polygon: PlanPoint[]): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / Math.max(yj - yi, 0.0000001) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}
