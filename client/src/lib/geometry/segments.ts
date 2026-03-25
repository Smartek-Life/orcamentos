import { clamp, distanceBetweenPoints } from '../utils';
import type { PlanPoint, WallSegment } from '../../types';

export function pointToSegmentDistance(point: PlanPoint, start: PlanPoint, end: PlanPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return distanceBetweenPoints(point, start);
  }

  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  const projection = { x: start.x + t * dx, y: start.y + t * dy };
  return distanceBetweenPoints(point, projection);
}

export function findNearestWall(walls: WallSegment[], point: PlanPoint, threshold: number): WallSegment | null {
  let best: WallSegment | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const wall of walls) {
    const distance = pointToSegmentDistance(point, wall.start, wall.end);
    if (distance < threshold && distance < bestDistance) {
      best = wall;
      bestDistance = distance;
    }
  }

  return best;
}
