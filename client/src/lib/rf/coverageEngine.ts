import { pointInPolygon, derivePerimeterFromWalls, type AutoWallLine } from '../geometry/perimeter';
import { buildInteriorMask } from '../walls/detection';
import { clamp } from '../utils';
import type { AccessPoint, EditablePlan, FloorAnalysis, PlanPoint } from '../../types';

export interface CoverageRadii {
  outer: number;
  inner: number;
}

const OFFICIAL_U6_PLUS_OPEN_AREA_M2 = 140;
const OFFICIAL_U6_PLUS_OPEN_RADIUS_M = Math.sqrt(OFFICIAL_U6_PLUS_OPEN_AREA_M2 / Math.PI);

export function getCoverageRadii(
  analysis: FloorAnalysis,
  plan: EditablePlan,
  canvasWidth: number,
  canvasHeight: number,
): CoverageRadii {
  const minDimension = Math.min(canvasWidth, canvasHeight);
  const fallbackOuter = analysis.access_points[0]
    ? clamp(analysis.access_points[0].raio_cobertura_normalizado, 0.05, 0.25) * minDimension
    : minDimension * 0.18;

  if (!plan.metersPerPixel || plan.pixelWidth <= 0) {
    return {
      outer: fallbackOuter,
      inner: fallbackOuter * 0.82,
    };
  }

  const scaleX = canvasWidth / Math.max(plan.pixelWidth, 1);
  const scaleY = canvasHeight / Math.max(plan.pixelHeight, 1);
  const displayPixelsPerMeter = Math.min(scaleX, scaleY) / plan.metersPerPixel;
  const outer = clamp(OFFICIAL_U6_PLUS_OPEN_RADIUS_M * displayPixelsPerMeter, 48, minDimension * 0.34);
  const inner = outer * 0.82;

  return { outer, inner };
}

export function getCombinedSignalStrength(
  point: PlanPoint,
  accessPoints: AccessPoint[],
  plan: EditablePlan,
  detectedWalls: AutoWallLine[],
  canvasWidth: number,
  canvasHeight: number,
  fallbackOuterRadiusPx: number,
): number {
  if (accessPoints.length === 0) {
    return 0;
  }

  let combined = 0;

  for (const ap of accessPoints) {
    const distanceMeters = getDistanceMeters(point, ap, plan, canvasWidth, canvasHeight, fallbackOuterRadiusPx);
    const crossings = countWallCrossings(ap, point, detectedWalls);
    const distanceDecay = Math.exp(-Math.pow(distanceMeters / OFFICIAL_U6_PLUS_OPEN_RADIUS_M, 1.7));
    const wallDecay = Math.exp(-crossings * 0.42);
    const signal = clamp(distanceDecay * wallDecay, 0, 0.98);
    combined = 1 - (1 - combined) * (1 - signal);
  }

  return combined;
}

export function getHeatmapColor(strength: number): string {
  if (strength >= 0.76) {
    return 'rgba(130, 197, 97, 0.42)';
  }
  if (strength >= 0.58) {
    return 'rgba(173, 216, 99, 0.36)';
  }
  if (strength >= 0.4) {
    return 'rgba(252, 212, 99, 0.3)';
  }
  if (strength >= 0.23) {
    return 'rgba(246, 170, 80, 0.18)';
  }
  return 'rgba(199, 78, 88, 0.13)';
}

export function getProcessingBounds(detectedWalls: AutoWallLine[], canvasWidth: number, canvasHeight: number) {
  if (detectedWalls.length === 0) {
    return { left: 0, top: 0, right: canvasWidth, bottom: canvasHeight };
  }

  let left = 1;
  let top = 1;
  let right = 0;
  let bottom = 0;

  for (const wall of detectedWalls) {
    left = Math.min(left, wall.start.x, wall.end.x);
    top = Math.min(top, wall.start.y, wall.end.y);
    right = Math.max(right, wall.start.x, wall.end.x);
    bottom = Math.max(bottom, wall.start.y, wall.end.y);
  }

  const padX = 0.18;
  const padY = 0.18;
  return {
    left: Math.max(0, Math.floor((left - padX) * canvasWidth)),
    top: Math.max(0, Math.floor((top - padY) * canvasHeight)),
    right: Math.min(canvasWidth, Math.ceil((right + padX) * canvasWidth)),
    bottom: Math.min(canvasHeight, Math.ceil((bottom + padY) * canvasHeight)),
  };
}

export function computeDynamicMetrics(
  analysis: FloorAnalysis,
  plan: EditablePlan,
  detectedWalls: AutoWallLine[],
  canvasWidth: number,
  canvasHeight: number,
) {
  const perimeterPoints = plan.perimeterPoints.length >= 4 ? plan.perimeterPoints : derivePerimeterFromWalls(detectedWalls);
  const mask = buildInteriorMask(perimeterPoints, canvasWidth, canvasHeight, pointInPolygon);
  if (!mask) {
    return {
      areaM2: plan.metersPerPixel ? analysis.area_estimada_m2 : null,
      coveragePercent: null,
    };
  }

  let interiorCells = 0;
  let coveredCells = 0;
  for (let row = 0; row < mask.rows; row += 1) {
    for (let col = 0; col < mask.cols; col += 1) {
      if (!mask.interior[row][col]) {
        continue;
      }

      interiorCells += 1;
      const point = {
        x: (col + 0.5) / mask.cols,
        y: (row + 0.5) / mask.rows,
      };
      const strength = getCombinedSignalStrength(
        point,
        analysis.access_points,
        plan,
        detectedWalls,
        canvasWidth,
        canvasHeight,
        120,
      );
      if (strength >= 0.4) {
        coveredCells += 1;
      }
    }
  }

  const normalizedArea = interiorCells / Math.max(mask.rows * mask.cols, 1);
  const sourcePixelArea = plan.pixelWidth * plan.pixelHeight * normalizedArea;
  const areaM2 =
    plan.calibratedAreaM2 ??
    (plan.metersPerPixel && plan.metersPerPixel > 0
      ? Math.round(sourcePixelArea * plan.metersPerPixel * plan.metersPerPixel)
      : null);
  const coveragePercent = interiorCells > 0 ? Math.round((coveredCells / interiorCells) * 100) : null;

  return {
    areaM2,
    coveragePercent,
  };
}

function getDistanceMeters(
  point: PlanPoint,
  ap: AccessPoint,
  plan: EditablePlan,
  canvasWidth: number,
  canvasHeight: number,
  fallbackOuterRadiusPx: number,
): number {
  const deltaXNorm = ap.x - point.x;
  const deltaYNorm = ap.y - point.y;

  if (plan.metersPerPixel && plan.pixelWidth > 0 && plan.pixelHeight > 0) {
    const dxSourcePixels = deltaXNorm * plan.pixelWidth;
    const dySourcePixels = deltaYNorm * plan.pixelHeight;
    return Math.hypot(dxSourcePixels, dySourcePixels) * plan.metersPerPixel;
  }

  const distanceDisplayPixels = Math.hypot(deltaXNorm * canvasWidth, deltaYNorm * canvasHeight);
  return (distanceDisplayPixels / Math.max(fallbackOuterRadiusPx, 1)) * OFFICIAL_U6_PLUS_OPEN_RADIUS_M;
}

function countWallCrossings(start: PlanPoint, end: PlanPoint, detectedWalls: AutoWallLine[]): number {
  let count = 0;

  for (const wall of detectedWalls) {
    if (segmentsIntersect(start, end, wall.start, wall.end)) {
      count += 1;
    }
  }

  return count;
}

function segmentsIntersect(a1: PlanPoint, a2: PlanPoint, b1: PlanPoint, b2: PlanPoint): boolean {
  const denominator = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);

  if (Math.abs(denominator) < 0.000001) {
    return false;
  }

  const ua = ((b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x)) / denominator;
  const ub = ((a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x)) / denominator;

  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}
