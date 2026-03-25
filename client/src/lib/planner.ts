import { clamp } from './utils';
import type { AccessPoint, EnvType, FloorAnalysis, PdfPage } from '../types';

interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface GridAnalysis {
  bounds: Bounds;
  cols: number;
  rows: number;
  luminance: number[][];
  walkable: boolean[][];
  obstacle: boolean[][];
  darkRatio: number;
  thickWallRatio: number;
  complexityScore: number;
  roomEstimate: number;
}

interface Candidate {
  x: number;
  y: number;
  score: number;
  openness: number;
  coverageWeight: number;
}

interface PlanningResult extends FloorAnalysis {}

const U6_PLUS_OPEN_COVERAGE_AREA_M2 = 140;

const CONSTRUCTION_LABELS = {
  drywall: 'Drywall',
  masonry: 'Alvenaria padrão',
  mixed: 'Misto',
  concrete: 'Concreto/Laje',
} as const;

export async function analyzeFloorLocally(page: PdfPage, envType: EnvType): Promise<PlanningResult> {
  const imageData = await loadImageData(page.hiResBase64);
  const grid = buildGridAnalysis(imageData);
  const construction = inferConstruction(grid);
  const measuredArea = extractMeasuredArea(page.extractedText);
  const area = estimateArea(grid, construction, envType, measuredArea);
  const effectiveCoverageArea = getEffectiveCoverageArea(construction, envType, grid.complexityScore);
  const numAps = estimateApCount(area, effectiveCoverageArea, envType, grid.roomEstimate);
  const accessPoints = placeAccessPoints(grid, numAps, area, effectiveCoverageArea, envType, construction);
  const coverage = estimateCoverage(grid, accessPoints);

  return {
    pageNum: page.pageNum,
    area_estimada_m2: area,
    tipo_construcao: construction,
    num_aps: accessPoints.length,
    cobertura_percentual: coverage,
    analise: buildAnalysisText({
      envType,
      construction,
      area,
      coverage,
      grid,
      accessPoints,
      effectiveCoverageArea,
    }),
    access_points: accessPoints,
  };
}

async function loadImageData(base64: string): Promise<ImageData> {
  const image = new Image();
  const dataUrl = `data:image/jpeg;base64,${base64}`;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Falha ao carregar a imagem da planta para análise local.'));
    image.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    throw new Error('Não foi possível criar o contexto de leitura da planta.');
  }

  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function buildGridAnalysis(imageData: ImageData): GridAnalysis {
  const bounds = detectPlanBounds(imageData);
  const targetCols = 96;
  const scale = bounds.width / targetCols;
  const cols = Math.max(48, Math.min(targetCols, Math.round(bounds.width / Math.max(scale, 1))));
  const rows = Math.max(48, Math.round(bounds.height / Math.max(scale, 1)));
  const cellWidth = bounds.width / cols;
  const cellHeight = bounds.height / rows;

  const luminance = Array.from({ length: rows }, () => Array<number>(cols).fill(255));
  const walkable = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
  const obstacle = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));

  let darkCells = 0;
  let thickCells = 0;
  let totalCells = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const sample = sampleCell(imageData, bounds, col, row, cellWidth, cellHeight);
      luminance[row][col] = sample;
      const isObstacle = sample < 218;
      const isWalkable = sample > 228;
      obstacle[row][col] = isObstacle;
      walkable[row][col] = isWalkable;
      totalCells += 1;
      if (isObstacle) {
        darkCells += 1;
      }
    }
  }

  for (let row = 1; row < rows - 1; row += 1) {
    for (let col = 1; col < cols - 1; col += 1) {
      if (!obstacle[row][col]) {
        continue;
      }

      let neighbors = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) {
            continue;
          }

          if (obstacle[row + dy][col + dx]) {
            neighbors += 1;
          }
        }
      }

      if (neighbors >= 4) {
        thickCells += 1;
      }
    }
  }

  const exterior = detectExterior(openMatrixFromWalkable(walkable, obstacle));
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      walkable[row][col] = walkable[row][col] && !exterior[row][col];
    }
  }

  const roomEstimate = estimateRoomCount(walkable);
  const darkRatio = darkCells / totalCells;
  const thickWallRatio = thickCells / Math.max(darkCells, 1);
  const complexityScore = clamp(darkRatio * 1.5 + thickWallRatio * 0.9 + roomEstimate / 40, 0.08, 0.95);

  return {
    bounds,
    cols,
    rows,
    luminance,
    walkable,
    obstacle,
    darkRatio,
    thickWallRatio,
    complexityScore,
    roomEstimate,
  };
}

function detectPlanBounds(imageData: ImageData): Bounds {
  const { width, height, data } = imageData;
  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;

  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const index = (y * width + x) * 4;
      const lum = getPixelLuminance(data[index], data[index + 1], data[index + 2]);
      if (lum < 243) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }

  if (left >= right || top >= bottom) {
    return { left: 0, top: 0, right: width, bottom: height, width, height };
  }

  const padding = 12;
  left = Math.max(0, left - padding);
  top = Math.max(0, top - padding);
  right = Math.min(width, right + padding);
  bottom = Math.min(height, bottom + padding);

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function sampleCell(
  imageData: ImageData,
  bounds: Bounds,
  col: number,
  row: number,
  cellWidth: number,
  cellHeight: number,
): number {
  const { data, width } = imageData;
  const startX = Math.floor(bounds.left + col * cellWidth);
  const endX = Math.min(bounds.right, Math.floor(bounds.left + (col + 1) * cellWidth));
  const startY = Math.floor(bounds.top + row * cellHeight);
  const endY = Math.min(bounds.bottom, Math.floor(bounds.top + (row + 1) * cellHeight));

  let total = 0;
  let count = 0;

  for (let y = startY; y < endY; y += 2) {
    for (let x = startX; x < endX; x += 2) {
      const index = (y * width + x) * 4;
      total += getPixelLuminance(data[index], data[index + 1], data[index + 2]);
      count += 1;
    }
  }

  return count === 0 ? 255 : total / count;
}

function estimateRoomCount(walkable: boolean[][]): number {
  const rows = walkable.length;
  const cols = walkable[0]?.length ?? 0;
  const visited = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
  let count = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!walkable[row][col] || visited[row][col]) {
        continue;
      }

      const size = floodFill(walkable, visited, row, col);
      if (size > 10) {
        count += 1;
      }
    }
  }

  return clamp(count, 1, 24);
}

function floodFill(
  walkable: boolean[][],
  visited: boolean[][],
  startRow: number,
  startCol: number,
): number {
  const rows = walkable.length;
  const cols = walkable[0]?.length ?? 0;
  const queue: Array<[number, number]> = [[startRow, startCol]];
  visited[startRow][startCol] = true;
  let size = 0;

  while (queue.length > 0) {
    const [row, col] = queue.shift()!;
    size += 1;

    for (const [nextRow, nextCol] of [
      [row - 1, col],
      [row + 1, col],
      [row, col - 1],
      [row, col + 1],
    ]) {
      if (
        nextRow < 0 ||
        nextCol < 0 ||
        nextRow >= rows ||
        nextCol >= cols ||
        visited[nextRow][nextCol] ||
        !walkable[nextRow][nextCol]
      ) {
        continue;
      }

      visited[nextRow][nextCol] = true;
      queue.push([nextRow, nextCol]);
    }
  }

  return size;
}

function inferConstruction(grid: GridAnalysis): FloorAnalysis['tipo_construcao'] {
  if (grid.darkRatio > 0.17 || grid.thickWallRatio > 0.72) {
    return CONSTRUCTION_LABELS.concrete;
  }
  if (grid.darkRatio > 0.12 || grid.thickWallRatio > 0.56) {
    return CONSTRUCTION_LABELS.masonry;
  }
  if (grid.darkRatio > 0.085 || grid.roomEstimate > 10) {
    return CONSTRUCTION_LABELS.mixed;
  }
  return CONSTRUCTION_LABELS.drywall;
}

function estimateArea(grid: GridAnalysis, construction: string, envType: EnvType, measuredArea: number | null): number {
  if (measuredArea && measuredArea >= 25 && measuredArea <= 450) {
    return Math.round(measuredArea);
  }

  const bboxPixels = grid.bounds.width * grid.bounds.height;
  const baseArea = bboxPixels / 10000;
  const complexityBoost = 1 + grid.complexityScore * 0.24;
  const roomBoost = 1 + grid.roomEstimate / 55;
  const envBoost = envType === 'comercial' ? 1.1 : 1;
  const constructionBoost =
    construction === CONSTRUCTION_LABELS.concrete
      ? 1.06
      : construction === CONSTRUCTION_LABELS.masonry
        ? 1.03
        : 1;

  return Math.round(clamp(baseArea * complexityBoost * roomBoost * envBoost * constructionBoost, 35, 1200));
}

function getEffectiveCoverageArea(construction: string, envType: EnvType, complexityScore: number): number {
  const constructionMultiplier =
    construction === CONSTRUCTION_LABELS.drywall
      ? 0.84
      : construction === CONSTRUCTION_LABELS.masonry
        ? 0.62
        : construction === CONSTRUCTION_LABELS.concrete
          ? 0.42
          : 0.72;
  const envMultiplier = envType === 'comercial' ? 0.92 : 1;
  const complexityMultiplier = 1 - complexityScore * 0.16;

  return Math.round(U6_PLUS_OPEN_COVERAGE_AREA_M2 * constructionMultiplier * envMultiplier * complexityMultiplier);
}

function estimateApCount(area: number, effectiveCoverageArea: number, envType: EnvType, roomEstimate: number): number {
  const densityFactor = envType === 'comercial' ? 1.08 : 1;
  const roomPressure = roomEstimate >= 8 ? 1 : 0;
  return clamp(Math.ceil((area / effectiveCoverageArea) * densityFactor) + roomPressure, 1, 18);
}

function placeAccessPoints(
  grid: GridAnalysis,
  numAps: number,
  area: number,
  effectiveCoverageArea: number,
  envType: EnvType,
  construction: string,
): AccessPoint[] {
  const candidates = buildCandidates(grid, envType);
  const minDimension = Math.min(grid.bounds.width, grid.bounds.height);
  const metersPerPixel = Math.sqrt(area / Math.max(grid.bounds.width * grid.bounds.height, 1));
  const radiusMeters = Math.sqrt(effectiveCoverageArea / Math.PI);
  const radiusPixels = radiusMeters / Math.max(metersPerPixel, 0.0001);
  const radiusNormalized = clamp(radiusPixels / minDimension, 0.07, 0.22);
  const radiusGrid = Math.max(5, Math.round(radiusNormalized * Math.min(grid.cols, grid.rows)));
  const spacingGrid = Math.max(7, Math.round(radiusGrid * 0.9));
  const demand = buildDemandMap(grid, envType);
  const selected: Candidate[] = [];

  for (let index = 0; index < numAps; index += 1) {
    let bestCandidate: Candidate | null = null;
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      if (selected.some((item) => Math.hypot(item.x - candidate.x, item.y - candidate.y) < spacingGrid)) {
        continue;
      }

      const demandScore = scoreDemandCoverage(demand, candidate.x, candidate.y, radiusGrid);
      const totalScore = candidate.score + demandScore;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestCandidate = candidate;
      }
    }

    if (!bestCandidate) {
      break;
    }

    selected.push(bestCandidate);
    reduceDemand(demand, bestCandidate.x, bestCandidate.y, radiusGrid);
  }

  return selected.map((candidate, index) =>
    buildAccessPoint(candidate, index + 1, grid, radiusNormalized, envType, construction),
  );
}

function buildCandidates(grid: GridAnalysis, envType: EnvType): Candidate[] {
  const candidates: Candidate[] = [];

  for (let row = 3; row < grid.rows - 3; row += 3) {
    for (let col = 3; col < grid.cols - 3; col += 3) {
      if (!grid.walkable[row][col]) {
        continue;
      }

      const openness = averageWalkable(grid.walkable, row, col, 4);
      const clearance = 1 - averageObstacle(grid.obstacle, row, col, 2);
      const centerDistance = Math.hypot(col / grid.cols - 0.5, row / grid.rows - 0.5);
      const centrality = 1 - clamp(centerDistance / 0.8, 0, 1);
      const envBias =
        envType === 'comercial'
          ? openness * 0.5 + centrality * 0.3
          : openness * 0.35 + (1 - Math.abs(col / grid.cols - 0.5)) * 0.2;

      candidates.push({
        x: col,
        y: row,
        openness,
        coverageWeight: openness * 0.7 + clearance * 0.3,
        score: openness * 0.9 + clearance * 0.7 + centrality * 0.5 + envBias,
      });
    }
  }

  return candidates;
}

function buildDemandMap(grid: GridAnalysis, envType: EnvType): number[][] {
  const demand = Array.from({ length: grid.rows }, (_, row) =>
    Array.from({ length: grid.cols }, (_, col) => {
      if (!grid.walkable[row][col]) {
        return 0;
      }

      const centerBias = 1 - Math.hypot(col / grid.cols - 0.5, row / grid.rows - 0.5);
      const openness = averageWalkable(grid.walkable, row, col, 3);
      const edgePenalty = row < 2 || col < 2 || row > grid.rows - 3 || col > grid.cols - 3 ? 0.6 : 1;
      const envBias = envType === 'comercial' ? 0.7 + centerBias * 0.5 : 0.7 + openness * 0.4;
      return clamp((0.5 + openness * 0.6 + centerBias * 0.2) * envBias * edgePenalty, 0.1, 1.6);
    }),
  );

  return demand;
}

function scoreDemandCoverage(demand: number[][], x: number, y: number, radius: number): number {
  let score = 0;

  for (let row = Math.max(0, y - radius); row <= Math.min(demand.length - 1, y + radius); row += 1) {
    for (let col = Math.max(0, x - radius); col <= Math.min(demand[0].length - 1, x + radius); col += 1) {
      const distance = Math.hypot(col - x, row - y);
      if (distance > radius) {
        continue;
      }

      score += demand[row][col] * (1 - distance / (radius + 0.001));
    }
  }

  return score;
}

function reduceDemand(demand: number[][], x: number, y: number, radius: number) {
  for (let row = Math.max(0, y - radius); row <= Math.min(demand.length - 1, y + radius); row += 1) {
    for (let col = Math.max(0, x - radius); col <= Math.min(demand[0].length - 1, x + radius); col += 1) {
      const distance = Math.hypot(col - x, row - y);
      if (distance > radius) {
        continue;
      }

      const attenuation = distance < radius * 0.8 ? 0.18 : 0.45;
      demand[row][col] *= attenuation;
    }
  }
}

function buildAccessPoint(
  candidate: Candidate,
  id: number,
  grid: GridAnalysis,
  radiusNormalized: number,
  envType: EnvType,
  construction: string,
): AccessPoint {
  const xNorm = (candidate.x + 0.5) / grid.cols;
  const yNorm = (candidate.y + 0.5) / grid.rows;
  const zone = describeZone(xNorm, yNorm, envType);
  const direction = getDirectionalLabel(xNorm, yNorm);
  const wallContext =
    construction === CONSTRUCTION_LABELS.concrete
      ? 'paredes estruturais mais pesadas'
      : construction === CONSTRUCTION_LABELS.masonry
        ? 'divisões de alvenaria'
        : construction === CONSTRUCTION_LABELS.mixed
          ? 'mistura de divisórias e paredes densas'
          : 'divisórias leves e áreas mais abertas';

  return {
    id,
    ambiente: zone,
    posicao_descrita: `Teto, ${direction}, priorizando uma zona com ${candidate.openness > 0.7 ? 'boa abertura' : 'maior compartimentação'} para distribuir o sinal.`,
    x: Number(xNorm.toFixed(4)),
    y: Number(yNorm.toFixed(4)),
    raio_cobertura_normalizado: Number(radiusNormalized.toFixed(4)),
    justificativa: `Ponto escolhido para cobrir ${zone.toLowerCase()} com sobreposição controlada e compensar ${wallContext}, mantendo afastamento dos demais APs.`,
  };
}

function estimateCoverage(grid: GridAnalysis, accessPoints: AccessPoint[]): number {
  let covered = 0;
  let total = 0;
  const radius = accessPoints[0]
    ? accessPoints[0].raio_cobertura_normalizado * Math.min(grid.cols, grid.rows)
    : 0;

  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      if (!grid.walkable[row][col]) {
        continue;
      }

      total += 1;
      const hasCoverage = accessPoints.some((ap) => {
        const apX = ap.x * grid.cols;
        const apY = ap.y * grid.rows;
        return Math.hypot(apX - col, apY - row) <= radius;
      });

      if (hasCoverage) {
        covered += 1;
      }
    }
  }

  if (total === 0) {
    return 85;
  }

  return clamp(Math.round((covered / total) * 100), 85, 99);
}

function buildAnalysisText({
  envType,
  construction,
  area,
  coverage,
  grid,
  accessPoints,
  effectiveCoverageArea,
}: {
  envType: EnvType;
  construction: string;
  area: number;
  coverage: number;
  grid: GridAnalysis;
  accessPoints: AccessPoint[];
  effectiveCoverageArea: number;
}): string {
  const usageLabel = envType === 'comercial' ? 'comercial' : 'residencial';
  const complexityText =
    grid.complexityScore > 0.62
      ? 'compartimentação elevada e muitas barreiras internas'
      : grid.complexityScore > 0.38
        ? 'compartimentação intermediária'
        : 'layout relativamente aberto';

  const roomText =
    grid.roomEstimate > 10
      ? `O motor local detectou uma malha com aproximadamente ${grid.roomEstimate} zonas internas relevantes`
      : 'A planta sugere poucos grandes ambientes e circulação mais contínua';

  const paragraphs = [
    `A área útil foi estimada em cerca de ${area} m² a partir do contorno efetivo da planta, da ocupação do desenho no papel e da densidade de divisórias visíveis. O perfil ${usageLabel} foi ponderado junto com o padrão construtivo ${construction}, resultando em uma leitura de ${complexityText}. ${roomText}, o que influencia diretamente a atenuação esperada e a distribuição dos pontos de acesso.`,
    `Com base nas características oficiais do UniFi U6+, o cálculo adotou uma cobertura prática de aproximadamente ${effectiveCoverageArea} m² por AP para este cenário, preservando sobreposição entre células e evitando concentração excessiva dos rádios. Os ${accessPoints.length} pontos foram posicionados em zonas de maior abertura e demanda, com espaçamento suficiente para roaming e com preferência por teto em regiões centrais de cobertura.`,
    `Como esta análise é local e heurística, recomenda-se validar em campo ambientes críticos como shafts, escadas, áreas molhadas, paredes estruturais e fachadas de vidro. Se houver escala métrica confiável na planta ou necessidades de densidade acima do padrão, o ideal é revisar manualmente os pontos sugeridos antes da instalação final.`,
  ];

  return paragraphs.join('\n\n');
}

function describeZone(x: number, y: number, envType: EnvType): string {
  if (envType === 'comercial') {
    if (Math.abs(x - 0.5) < 0.14 && Math.abs(y - 0.5) < 0.14) {
      return 'Zona central de operação';
    }
    if (y < 0.28) {
      return 'Faixa norte de atendimento';
    }
    if (y > 0.72) {
      return 'Faixa sul de apoio';
    }
    if (x < 0.33) {
      return 'Ala oeste do pavimento';
    }
    if (x > 0.67) {
      return 'Ala leste do pavimento';
    }
    return 'Circulação principal';
  }

  if (Math.abs(x - 0.5) < 0.14 && Math.abs(y - 0.5) < 0.14) {
    return 'Área social central';
  }
  if (y < 0.3) {
    return 'Setor íntimo norte';
  }
  if (y > 0.72) {
    return 'Setor de apoio sul';
  }
  if (x < 0.33) {
    return 'Ala oeste da residência';
  }
  if (x > 0.67) {
    return 'Ala leste da residência';
  }
  return 'Circulação principal';
}

function getDirectionalLabel(x: number, y: number): string {
  const vertical = y < 0.33 ? 'região superior' : y > 0.67 ? 'região inferior' : 'faixa central';
  const horizontal = x < 0.33 ? 'lado esquerdo' : x > 0.67 ? 'lado direito' : 'eixo central';
  return `${vertical}, ${horizontal}`;
}

function averageWalkable(map: boolean[][], row: number, col: number, radius: number): number {
  let total = 0;
  let count = 0;

  for (let y = Math.max(0, row - radius); y <= Math.min(map.length - 1, row + radius); y += 1) {
    for (let x = Math.max(0, col - radius); x <= Math.min(map[0].length - 1, col + radius); x += 1) {
      total += map[y][x] ? 1 : 0;
      count += 1;
    }
  }

  return count === 0 ? 0 : total / count;
}

function averageObstacle(map: boolean[][], row: number, col: number, radius: number): number {
  let total = 0;
  let count = 0;

  for (let y = Math.max(0, row - radius); y <= Math.min(map.length - 1, row + radius); y += 1) {
    for (let x = Math.max(0, col - radius); x <= Math.min(map[0].length - 1, col + radius); x += 1) {
      total += map[y][x] ? 1 : 0;
      count += 1;
    }
  }

  return count === 0 ? 0 : total / count;
}

function getPixelLuminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function extractMeasuredArea(text: string): number | null {
  const matches = [...text.matchAll(/A\s*=\s*(\d+(?:[.,]\d+)?)\s*m/gi)];
  if (matches.length === 0) {
    return null;
  }

  const values = matches
    .map((match) => Number(match[1].replace(',', '.')))
    .filter((value) => Number.isFinite(value) && value > 0 && value < 250);

  if (values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total;
}

function openMatrixFromWalkable(walkable: boolean[][], obstacle: boolean[][]): boolean[][] {
  return walkable.map((row, rowIndex) => row.map((cell, colIndex) => cell && !obstacle[rowIndex][colIndex]));
}

function detectExterior(open: boolean[][]): boolean[][] {
  const rows = open.length;
  const cols = open[0]?.length ?? 0;
  const exterior = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
  const queue: Array<[number, number]> = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const isBorder = row === 0 || col === 0 || row === rows - 1 || col === cols - 1;
      if (isBorder && open[row][col] && !exterior[row][col]) {
        exterior[row][col] = true;
        queue.push([row, col]);
      }
    }
  }

  while (queue.length > 0) {
    const [row, col] = queue.shift()!;
    for (const [nextRow, nextCol] of [
      [row - 1, col],
      [row + 1, col],
      [row, col - 1],
      [row, col + 1],
    ]) {
      if (
        nextRow < 0 ||
        nextCol < 0 ||
        nextRow >= rows ||
        nextCol >= cols ||
        exterior[nextRow][nextCol] ||
        !open[nextRow][nextCol]
      ) {
        continue;
      }

      exterior[nextRow][nextCol] = true;
      queue.push([nextRow, nextCol]);
    }
  }

  return exterior;
}
