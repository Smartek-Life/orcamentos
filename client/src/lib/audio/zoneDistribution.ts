import { pointInPolygon } from '../geometry/perimeter';
import type { AudioZone, PlanPoint, SpeakerDevice } from '../../types';

function getPolygonBounds(points: PlanPoint[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function getPolygonCentroid(points: PlanPoint[]): PlanPoint {
  const sum = points.reduce(
    (acc, point) => ({
      x: acc.x + point.x,
      y: acc.y + point.y,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: sum.x / points.length,
    y: sum.y / points.length,
  };
}

function buildCandidateGrid(zone: AudioZone) {
  const bounds = getPolygonBounds(zone.points);
  const width = Math.max(bounds.maxX - bounds.minX, 0.0001);
  const height = Math.max(bounds.maxY - bounds.minY, 0.0001);
  const aspect = width / height;
  const columns = Math.min(
    zone.speakerCount,
    Math.max(1, Math.round(Math.sqrt(zone.speakerCount * aspect))),
  );
  const rows = Math.max(1, Math.ceil(zone.speakerCount / columns));
  const paddingX = width * 0.18;
  const paddingY = height * 0.18;
  const innerMinX = bounds.minX + paddingX;
  const innerMaxX = bounds.maxX - paddingX;
  const innerMinY = bounds.minY + paddingY;
  const innerMaxY = bounds.maxY - paddingY;
  const stepX = columns > 1 ? (innerMaxX - innerMinX) / (columns - 1) : 0;
  const stepY = rows > 1 ? (innerMaxY - innerMinY) / (rows - 1) : 0;
  const primaryCandidates: PlanPoint[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      if (primaryCandidates.length >= zone.speakerCount) {
        break;
      }

      const candidate = {
        x: columns === 1 ? (bounds.minX + bounds.maxX) / 2 : innerMinX + stepX * col,
        y: rows === 1 ? (bounds.minY + bounds.maxY) / 2 : innerMinY + stepY * row,
      };

      if (pointInPolygon(candidate, zone.points)) {
        primaryCandidates.push(candidate);
      }
    }
  }

  if (primaryCandidates.length >= zone.speakerCount) {
    return primaryCandidates;
  }

  const denseCandidates: PlanPoint[] = [];
  const denseColumns = Math.max(columns * 2, 3);
  const denseRows = Math.max(rows * 2, 3);
  const denseCellWidth = width / denseColumns;
  const denseCellHeight = height / denseRows;

  for (let row = 0; row < denseRows; row += 1) {
    for (let col = 0; col < denseColumns; col += 1) {
      const candidate = {
        x: bounds.minX + denseCellWidth * (col + 0.5),
        y: bounds.minY + denseCellHeight * (row + 0.5),
      };

      if (pointInPolygon(candidate, zone.points)) {
        denseCandidates.push(candidate);
      }
    }
  }

  if (denseCandidates.length > 0) {
    return denseCandidates;
  }

  return [getPolygonCentroid(zone.points)];
}

function takeBalancedCandidates(candidates: PlanPoint[], count: number) {
  if (candidates.length === 0) {
    return [];
  }

  if (candidates.length <= count) {
    return candidates;
  }

  const picks: PlanPoint[] = [];
  const step = (candidates.length - 1) / Math.max(count - 1, 1);

  for (let index = 0; index < count; index += 1) {
    picks.push(candidates[Math.round(step * index)]);
  }

  return picks;
}

function createZoneSpeaker(
  id: number,
  zone: AudioZone,
  point: PlanPoint,
  order: number,
  type: SpeakerDevice['type'],
): SpeakerDevice {
  const baseName = type === 'subwoofer' ? 'Subwoofer' : 'Caixa';

  return {
    id,
    nome: `${baseName} ${id}`,
    type,
    sizeInches: type === 'subwoofer' ? Math.max(8, zone.speakerSizeInches) : zone.speakerSizeInches,
    x: point.x,
    y: point.y,
    rotationDeg: 0,
    zoneId: zone.id,
  };
}

export function distributeSpeakersInZone(zone: AudioZone, nextIdStart: number): SpeakerDevice[] {
  if (zone.points.length < 3 || zone.speakerCount <= 0) {
    return [];
  }

  const candidates = buildCandidateGrid(zone);
  const speakerPoints = takeBalancedCandidates(candidates, zone.speakerCount);
  const speakers = speakerPoints.map((point, index) =>
    createZoneSpeaker(nextIdStart + index, zone, point, index, zone.speakerType),
  );

  if (!zone.includeSubwoofer) {
    return speakers;
  }

  const bounds = getPolygonBounds(zone.points);
  const candidate = {
    x: bounds.minX + (bounds.maxX - bounds.minX) * 0.82,
    y: bounds.minY + (bounds.maxY - bounds.minY) * 0.78,
  };
  const subPoint = pointInPolygon(candidate, zone.points) ? candidate : getPolygonCentroid(zone.points);

  return [
    ...speakers,
    createZoneSpeaker(nextIdStart + speakers.length, zone, subPoint, speakers.length, 'subwoofer'),
  ];
}
