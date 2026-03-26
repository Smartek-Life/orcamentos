import { derivePerimeterFromWalls, type AutoWallLine } from '../geometry/perimeter';
import {
  getCombinedSignalStrength,
  getCoverageRadii,
  getHeatmapColor,
  getProcessingBounds,
  type CoverageRadii,
} from '../rf/coverageEngine';
import { clamp } from '../utils';
import type { EditablePlan, FloorAnalysis, PlanEditorMode, PlanPoint, WallMaterial } from '../../types';

export function drawOverlay(
  context: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  analysis: FloorAnalysis,
  plan: EditablePlan,
  selectedWallId: string | null,
  detectedWalls: AutoWallLine[],
  areaDraftPoints: PlanPoint[],
  isDragging = false,
) {
  const coverageRadii = getCoverageRadii(analysis, plan, canvasWidth, canvasHeight);
  const perimeterPoints =
    plan.perimeterPoints.length >= 3
      ? plan.perimeterPoints
      : areaDraftPoints.length >= 2
        ? areaDraftPoints
        : derivePerimeterFromWalls(detectedWalls);
  const perimeterClosed = plan.perimeterPoints.length >= 3;

  if (!plan.baseReady) {
    drawDetectedArea(context, canvasWidth, canvasHeight, perimeterPoints, perimeterClosed);
  }
  if (!isDragging) {
    drawHeatmap(context, canvasWidth, canvasHeight, plan.accessPoints, plan, detectedWalls, coverageRadii);
  }
  drawDetectedWalls(context, canvasWidth, canvasHeight, detectedWalls);
  drawPerimeter(context, canvasWidth, canvasHeight, perimeterPoints, perimeterClosed);
  drawManualWalls(context, canvasWidth, canvasHeight, plan, selectedWallId);
  drawCalibrationLine(context, canvasWidth, canvasHeight, plan);
  drawApCoverage(context, canvasWidth, canvasHeight, plan.accessPoints, coverageRadii);
  drawLegend(context, analysis, plan, canvasWidth, canvasHeight);
  drawHeader(context, analysis, canvasWidth);
}

export function drawDraftLine(
  context: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  start: PlanPoint,
  end: PlanPoint,
  mode: PlanEditorMode,
) {
  context.save();
  context.strokeStyle = mode === 'scale' ? '#F59E0B' : '#EF4444';
  context.lineWidth = 3;
  context.setLineDash([7, 5]);
  context.beginPath();
  context.moveTo(start.x * canvasWidth, start.y * canvasHeight);
  context.lineTo(end.x * canvasWidth, end.y * canvasHeight);
  context.stroke();
  context.restore();
}

function drawHeatmap(
  context: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  accessPoints: FloorAnalysis['access_points'],
  plan: EditablePlan,
  detectedWalls: AutoWallLine[],
  coverageRadii: CoverageRadii,
) {
  const bounds = getProcessingBounds(detectedWalls, canvasWidth, canvasHeight);
  const cellSize = Math.max(10, Math.round(Math.min(canvasWidth, canvasHeight) / 52));

  context.save();

  for (let y = bounds.top; y < bounds.bottom; y += cellSize) {
    for (let x = bounds.left; x < bounds.right; x += cellSize) {
      const point = {
        x: (x + cellSize * 0.5) / canvasWidth,
        y: (y + cellSize * 0.5) / canvasHeight,
      };
      const strength = getCombinedSignalStrength(
        point,
        accessPoints,
        plan,
        detectedWalls,
        canvasWidth,
        canvasHeight,
        coverageRadii.outer,
      );

      if (strength < 0.05) {
        continue;
      }

      context.fillStyle = getHeatmapColor(strength);
      context.fillRect(x, y, cellSize + 1, cellSize + 1);
    }
  }

  context.restore();
}

function drawPerimeter(
  context: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  points: PlanPoint[],
  closed: boolean,
) {
  if (points.length < 2) {
    return;
  }

  context.save();
  context.strokeStyle = '#16A34A';
  context.lineWidth = 3.2;
  context.beginPath();
  points.forEach((point, index) => {
    const x = point.x * canvasWidth;
    const y = point.y * canvasHeight;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  if (closed) {
    context.closePath();
  }
  context.stroke();

  for (const point of points) {
    const x = point.x * canvasWidth;
    const y = point.y * canvasHeight;
    context.fillStyle = '#16A34A';
    context.beginPath();
    context.arc(x, y, 4.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#FFFFFF';
    context.beginPath();
    context.arc(x, y, 2, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function drawDetectedArea(
  context: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  perimeterPoints: PlanPoint[],
  closed: boolean,
) {
  if (perimeterPoints.length < 2) {
    return;
  }
  context.save();
  context.beginPath();
  perimeterPoints.forEach((point, index) => {
    const x = point.x * canvasWidth;
    const y = point.y * canvasHeight;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  if (closed) {
    context.closePath();
    context.fillStyle = 'rgba(46, 204, 113, 0.06)';
    context.fill();
    context.strokeStyle = 'rgba(46, 204, 113, 0.22)';
    context.lineWidth = 1.2;
    context.stroke();

    context.save();
    context.clip();
    const spacing = 14;
    context.strokeStyle = 'rgba(46, 204, 113, 0.15)';
    context.lineWidth = 1;
    for (let x = -canvasHeight; x < canvasWidth + canvasHeight; x += spacing) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + canvasHeight, canvasHeight);
      context.stroke();
    }
    context.restore();
  } else {
    context.strokeStyle = 'rgba(46, 204, 113, 0.28)';
    context.lineWidth = 1.6;
    context.stroke();
  }
  context.restore();
}

function drawDetectedWalls(
  context: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  detectedWalls: AutoWallLine[],
) {
  for (const wall of detectedWalls) {
    const startX = wall.start.x * canvasWidth;
    const startY = wall.start.y * canvasHeight;
    const endX = wall.end.x * canvasWidth;
    const endY = wall.end.y * canvasHeight;

    context.save();
    context.strokeStyle = 'rgba(25, 18, 14, 0.92)';
    context.lineWidth = 5.2;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();
    context.restore();

    context.save();
    context.strokeStyle = 'rgba(131, 56, 31, 0.98)';
    context.lineWidth = 2.9;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();
    context.restore();
  }
}

function drawManualWalls(
  context: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  plan: EditablePlan,
  selectedWallId: string | null,
) {
  for (const wall of plan.walls) {
    const selected = wall.id === selectedWallId;
    const color = getWallColor(wall.material, selected);
    context.save();
    context.strokeStyle = color;
    context.lineWidth = selected ? 5 : 3;
    context.beginPath();
    context.moveTo(wall.start.x * canvasWidth, wall.start.y * canvasHeight);
    context.lineTo(wall.end.x * canvasWidth, wall.end.y * canvasHeight);
    context.stroke();
    context.restore();
  }
}

function drawCalibrationLine(
  context: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  plan: EditablePlan,
) {
  if (!plan.calibrationLine) {
    return;
  }

  context.save();
  context.strokeStyle = '#F59E0B';
  context.lineWidth = 3;
  context.setLineDash([8, 5]);
  context.beginPath();
  context.moveTo(plan.calibrationLine.start.x * canvasWidth, plan.calibrationLine.start.y * canvasHeight);
  context.lineTo(plan.calibrationLine.end.x * canvasWidth, plan.calibrationLine.end.y * canvasHeight);
  context.stroke();
  context.restore();
}

function drawApCoverage(
  context: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  accessPoints: FloorAnalysis['access_points'],
  coverageRadii: CoverageRadii,
) {
  accessPoints.forEach((ap) => {
    const centerX = clamp(ap.x, 0, 1) * canvasWidth;
    const centerY = clamp(ap.y, 0, 1) * canvasHeight;

    context.save();
    context.setLineDash([6, 4]);
    context.fillStyle = 'rgba(24, 95, 165, 0.015)';
    context.strokeStyle = 'rgba(24, 95, 165, 0.26)';
    context.lineWidth = 1;
    context.beginPath();
    context.arc(centerX, centerY, coverageRadii.outer, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();

    context.save();
    context.setLineDash([5, 4]);
    context.fillStyle = 'rgba(15, 110, 86, 0.02)';
    context.strokeStyle = 'rgba(15, 110, 86, 0.34)';
    context.lineWidth = 1;
    context.beginPath();
    context.arc(centerX, centerY, coverageRadii.inner, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();

    context.save();
    context.fillStyle = '#185FA5';
    context.strokeStyle = '#FFFFFF';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(centerX, centerY, 11, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    drawWifiIcon(context, centerX, centerY);
    context.restore();

    context.save();
    context.fillStyle = '#0C447C';
    context.beginPath();
    context.arc(centerX + 12, centerY - 12, 7, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#FFFFFF';
    context.font = 'bold 8px "Segoe UI"';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(String(ap.id), centerX + 12, centerY - 12);
    context.restore();
  });
}

function getWallColor(material: WallMaterial, selected: boolean): string {
  const colors: Record<WallMaterial, string> = {
    concrete: selected ? '#7C2D12' : '#991B1B',
    brick: selected ? '#9A3412' : '#B45309',
    drywall: selected ? '#1D4ED8' : '#2563EB',
    glass: selected ? '#0891B2' : '#06B6D4',
    wood: selected ? '#854D0E' : '#A16207',
    metal: selected ? '#334155' : '#475569',
  };
  return colors[material];
}

function drawWifiIcon(context: CanvasRenderingContext2D, x: number, y: number) {
  context.save();
  context.strokeStyle = '#FFFFFF';
  context.lineWidth = 1.4;
  [3, 5, 7].forEach((radius) => {
    context.beginPath();
    context.arc(x, y + 1, radius, (210 * Math.PI) / 180, (330 * Math.PI) / 180);
    context.stroke();
  });
  context.restore();
}

function drawLegend(
  context: CanvasRenderingContext2D,
  analysis: FloorAnalysis,
  plan: EditablePlan,
  canvasWidth: number,
  canvasHeight: number,
) {
  const boxWidth = Math.min(360, canvasWidth - 24);
  const boxHeight = 78 + analysis.access_points.length * 16;
  const x = 12;
  const y = canvasHeight - boxHeight - 12;

  context.save();
  context.fillStyle = 'rgba(255,255,255,0.92)';
  roundRect(context, x, y, boxWidth, boxHeight, 8);
  context.fill();

  context.font = '11px "Segoe UI"';
  context.textBaseline = 'middle';
  context.fillStyle = '#0F6E56';
  context.fillText('5GHz', x + 12, y + 18);
  context.fillStyle = '#185FA5';
  context.fillText('2.4GHz', x + 70, y + 18);
  context.fillStyle = '#9A3412';
  context.fillText('Paredes', x + 128, y + 18);
  context.fillStyle = '#F59E0B';
  context.fillText(plan.metersPerPixel ? `Escala: ${plan.metersPerPixel.toFixed(4)} m/px` : 'Escala pendente', x + 196, y + 18);
  context.fillStyle = '#10243A';

  analysis.access_points.forEach((ap, index) => {
    context.fillText(`AP ${ap.id} = ${ap.ambiente}`, x + 12, y + 44 + index * 16);
  });

  context.restore();
}

function drawHeader(context: CanvasRenderingContext2D, analysis: FloorAnalysis, canvasWidth: number) {
  const text = `Pagina ${analysis.pageNum} - ${analysis.num_aps} APs - ~${analysis.area_estimada_m2}m2 - cobertura ${analysis.cobertura_percentual}%`;

  context.save();
  context.font = '11px "Segoe UI"';
  const textWidth = Math.min(context.measureText(text).width + 20, canvasWidth - 24);
  context.fillStyle = 'rgba(255,255,255,0.92)';
  roundRect(context, 12, 12, textWidth, 24, 8);
  context.fill();
  context.fillStyle = '#10243A';
  context.textBaseline = 'middle';
  context.fillText(text, 22, 24);
  context.restore();
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}
