import type { PlanPoint } from '../../types';
import type { AutoWallLine } from '../geometry/perimeter';

export function detectWallsFromImage(image: HTMLImageElement): AutoWallLine[] {
  const maxDimension = 1280;
  const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  if (!context) {
    return [];
  }

  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  const dark = new Uint8Array(width * height);

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    dark[index] = brightness < 192 && chroma < 96 ? 1 : 0;
  }

  const horizontal = collectRuns(dark, width, height, 'horizontal');
  const vertical = collectRuns(dark, width, height, 'vertical');
  return mergeAutoWalls([...horizontal, ...vertical]).slice(0, 180);
}

function collectRuns(
  dark: Uint8Array,
  width: number,
  height: number,
  orientation: 'horizontal' | 'vertical',
): AutoWallLine[] {
  const lines: AutoWallLine[] = [];
  const primaryLimit = orientation === 'horizontal' ? height : width;
  const secondaryLimit = orientation === 'horizontal' ? width : height;
  const minRun = 18;

  for (let primary = 0; primary < primaryLimit; primary += 1) {
    let runStart = -1;

    for (let secondary = 0; secondary <= secondaryLimit; secondary += 1) {
      const isDark =
        secondary < secondaryLimit &&
        (orientation === 'horizontal'
          ? dark[primary * width + secondary] === 1
          : dark[secondary * width + primary] === 1);

      if (isDark) {
        if (runStart < 0) {
          runStart = secondary;
        }
        continue;
      }

      if (runStart >= 0) {
        const runLength = secondary - runStart;
        if (runLength >= minRun) {
          const thickness = sampleThickness(dark, width, height, orientation, primary, runStart, secondary - 1);
          if (thickness >= 1.6) {
            if (orientation === 'horizontal') {
              lines.push({
                start: { x: runStart / width, y: primary / height },
                end: { x: (secondary - 1) / width, y: primary / height },
              });
            } else {
              lines.push({
                start: { x: primary / width, y: runStart / height },
                end: { x: primary / width, y: (secondary - 1) / height },
              });
            }
          }
        }
        runStart = -1;
      }
    }
  }

  return lines;
}

function sampleThickness(
  dark: Uint8Array,
  width: number,
  height: number,
  orientation: 'horizontal' | 'vertical',
  primary: number,
  runStart: number,
  runEnd: number,
): number {
  const samples = 5;
  let score = 0;

  for (let sample = 0; sample < samples; sample += 1) {
    const along = Math.round(runStart + ((runEnd - runStart) * sample) / Math.max(samples - 1, 1));
    let localThickness = 0;

    for (let offset = -3; offset <= 3; offset += 1) {
      const x = orientation === 'horizontal' ? along : primary + offset;
      const y = orientation === 'horizontal' ? primary + offset : along;

      if (x < 0 || x >= width || y < 0 || y >= height) {
        continue;
      }

      if (dark[y * width + x] === 1) {
        localThickness += 1;
      }
    }

    score += localThickness;
  }

  return score / samples;
}

function mergeAutoWalls(lines: AutoWallLine[]): AutoWallLine[] {
  const horizontals = lines.filter((line) => Math.abs(line.start.y - line.end.y) < 0.0025);
  const verticals = lines.filter((line) => Math.abs(line.start.x - line.end.x) < 0.0025);

  return [...mergeDirectionalLines(horizontals, 'horizontal'), ...mergeDirectionalLines(verticals, 'vertical')];
}

function mergeDirectionalLines(
  lines: AutoWallLine[],
  orientation: 'horizontal' | 'vertical',
): AutoWallLine[] {
  const sorted = [...lines].sort((a, b) => {
    if (orientation === 'horizontal') {
      return a.start.y - b.start.y || a.start.x - b.start.x;
    }
    return a.start.x - b.start.x || a.start.y - b.start.y;
  });

  const merged: AutoWallLine[] = [];

  for (const line of sorted) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ start: { ...line.start }, end: { ...line.end } });
      continue;
    }

    const sameBand =
      orientation === 'horizontal'
        ? Math.abs(last.start.y - line.start.y) < 0.007
        : Math.abs(last.start.x - line.start.x) < 0.007;
    const closeEnough =
      orientation === 'horizontal'
        ? line.start.x <= last.end.x + 0.014
        : line.start.y <= last.end.y + 0.014;

    if (sameBand && closeEnough) {
      if (orientation === 'horizontal') {
        last.end.x = Math.max(last.end.x, line.end.x);
        const averageY = (last.start.y + line.start.y) * 0.5;
        last.start.y = averageY;
        last.end.y = averageY;
      } else {
        last.end.y = Math.max(last.end.y, line.end.y);
        const averageX = (last.start.x + line.start.x) * 0.5;
        last.start.x = averageX;
        last.end.x = averageX;
      }
      continue;
    }

    merged.push({ start: { ...line.start }, end: { ...line.end } });
  }

  return merged.filter((line) => {
    const length =
      orientation === 'horizontal' ? line.end.x - line.start.x : line.end.y - line.start.y;
    return length > 0.03;
  });
}

export function buildInteriorMask(
  perimeterPoints: PlanPoint[],
  canvasWidth: number,
  canvasHeight: number,
  pointInPolygon: (point: PlanPoint, polygon: PlanPoint[]) => boolean,
): { interior: boolean[][]; rows: number; cols: number } | null {
  if (perimeterPoints.length < 3) {
    return null;
  }

  const cols = Math.max(80, Math.round(canvasWidth / 14));
  const rows = Math.max(60, Math.round(canvasHeight / 14));
  const interior = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) =>
      pointInPolygon({ x: (col + 0.5) / cols, y: (row + 0.5) / rows }, perimeterPoints),
    ),
  );

  return { interior, rows, cols };
}
