import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { drawDraftLine, drawOverlay } from '../lib/canvas/renderers';
import {
  derivePerimeterFromWalls,
  findNearestPerimeterPoint,
  type AutoWallLine,
} from '../lib/geometry/perimeter';
import { findNearestWall } from '../lib/geometry/segments';
import {
  computeDynamicMetrics,
} from '../lib/rf/coverageEngine';
import { detectWallsFromImage } from '../lib/walls/detection';
import { base64ToDataUrl, clamp, distanceBetweenPoints } from '../lib/utils';
import type {
  AccessPoint,
  EditablePlan,
  FloorAnalysis,
  PlanEditorMode,
  PlanPoint,
  WallMaterial,
} from '../types';

interface PlantCanvasProps {
  analysis: FloorAnalysis;
  pageImageBase64: string;
  plan: EditablePlan;
  baseLocked?: boolean;
  onModeChange: (mode: PlanEditorMode) => void;
  onPendingLineChange: (line: [PlanPoint, PlanPoint] | null) => void;
  onCalibrationApply: (lengthMeters: number) => void;
  onWallAdd: (wall: { start: PlanPoint; end: PlanPoint; material: WallMaterial }) => void;
  onWallDelete: (wallId: string) => void;
  onWallMaterialChange: (wallId: string, material: WallMaterial) => void;
  onAccessPointMove: (apId: number, point: PlanPoint) => void;
  onAccessPointDelete: (apId: number) => void;
  onAccessPointAdd: () => void;
  onMetricsChange: (metrics: { areaM2: number | null; coveragePercent: number | null }) => void;
  onPerimeterChange: (points: PlanPoint[]) => void;
  onAreaCalibrationApply: (areaM2: number) => void;
  onSnapshotChange?: (dataUrl: string) => void;
}

interface Hotspot {
  ap: AccessPoint;
  x: number;
  y: number;
}

const wallMaterialOptions: Array<{ value: WallMaterial; label: string }> = [
  { value: 'concrete', label: 'Concreto' },
  { value: 'brick', label: 'Alvenaria' },
  { value: 'drywall', label: 'Drywall' },
  { value: 'glass', label: 'Vidro' },
  { value: 'wood', label: 'Madeira' },
  { value: 'metal', label: 'Metal' },
];

export function PlantCanvas({
  analysis,
  pageImageBase64,
  plan,
  baseLocked = false,
  onModeChange,
  onPendingLineChange,
  onCalibrationApply,
  onWallAdd,
  onWallDelete,
  onWallMaterialChange,
  onAccessPointMove,
  onAccessPointDelete,
  onAccessPointAdd,
  onMetricsChange,
  onPerimeterChange,
  onAreaCalibrationApply,
  onSnapshotChange,
}: PlantCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredAp, setHoveredAp] = useState<AccessPoint | null>(null);
  const [draftStart, setDraftStart] = useState<PlanPoint | null>(null);
  const [draftCursor, setDraftCursor] = useState<PlanPoint | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [draggingApId, setDraggingApId] = useState<number | null>(null);
  const [localApPositions, setLocalApPositions] = useState<Record<number, PlanPoint>>({});
  const [draggingPerimeterPoint, setDraggingPerimeterPoint] = useState<number | null>(null);
  const [areaDraftPoints, setAreaDraftPoints] = useState<PlanPoint[]>([]);
  const [detectedWalls, setDetectedWalls] = useState<AutoWallLine[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 1320, height: 940 });
  const [zoom, setZoom] = useState(1);
  const [scaleInput, setScaleInput] = useState('');
  const [areaInput, setAreaInput] = useState('');
  const imageUrl = useMemo(() => base64ToDataUrl(pageImageBase64), [pageImageBase64]);
  const isDragging = draggingApId !== null;

  const effectivePlan = useMemo<EditablePlan>(() => {
    if (!isDragging || Object.keys(localApPositions).length === 0) {
      return plan;
    }

    return {
      ...plan,
      accessPoints: plan.accessPoints.map((ap) =>
        localApPositions[ap.id] ? { ...ap, ...localApPositions[ap.id] } : ap,
      ),
    };
  }, [isDragging, localApPositions, plan]);

  useEffect(() => {
    if (plan.pendingLine) {
      setScaleInput('');
    }
  }, [plan.pendingLine]);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) {
        setDetectedWalls(detectWallsFromImage(image));
      }
    };
    image.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }

    const image = new Image();
    image.onload = () => {
      if (cancelled) {
        return;
      }

      const maxWidth = 1660 * zoom;
      const maxHeight = 1120 * zoom;
      const ratio = Math.min(maxWidth / image.width, maxHeight / image.height);
      const width = Math.round(image.width * ratio);
      const height = Math.round(image.height * ratio);
      canvas.width = width;
      canvas.height = height;
      setCanvasSize({ width, height });

      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      drawOverlay(
        context,
        width,
        height,
        analysis,
        effectivePlan,
        selectedWallId,
        detectedWalls,
        areaDraftPoints,
        isDragging,
      );
      if (draftStart && draftCursor) {
        drawDraftLine(context, width, height, draftStart, draftCursor, effectivePlan.mode);
      }
      if (!isDragging) {
        onSnapshotChange?.(canvas.toDataURL('image/png'));
      }
    };

    image.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [
    analysis,
    areaDraftPoints,
    detectedWalls,
    draftCursor,
    draftStart,
    effectivePlan,
    imageUrl,
    isDragging,
    onSnapshotChange,
    selectedWallId,
    zoom,
  ]);

  const hotspots = useMemo<Hotspot[]>(() => {
    return effectivePlan.accessPoints.map((ap) => ({
      ap,
      x: clamp(ap.x, 0, 1) * canvasSize.width,
      y: clamp(ap.y, 0, 1) * canvasSize.height,
    }));
  }, [canvasSize.height, canvasSize.width, effectivePlan.accessPoints]);

  const selectedWall = plan.walls.find((wall) => wall.id === selectedWallId) ?? null;
  const pendingPixels = plan.pendingLine
    ? distanceBetweenPoints(plan.pendingLine[0], plan.pendingLine[1]) * Math.min(canvasSize.width, canvasSize.height)
    : 0;
  const autoPerimeter = useMemo(
    () => derivePerimeterFromWalls(detectedWalls),
    [detectedWalls],
  );
  const perimeterPoints = plan.perimeterPoints.length >= 4 ? plan.perimeterPoints : autoPerimeter;
  const activePerimeterPoints = plan.perimeterPoints.length >= 3 ? plan.perimeterPoints : areaDraftPoints;

  useEffect(() => {
    if (isDragging) {
      return;
    }
    const metrics = computeDynamicMetrics(analysis, effectivePlan, detectedWalls, canvasSize.width, canvasSize.height);
    onMetricsChange(metrics);
  }, [analysis, canvasSize.height, canvasSize.width, detectedWalls, effectivePlan, isDragging, onMetricsChange]);

  useEffect(() => {
    if (plan.calibratedAreaM2) {
      setAreaInput(String(plan.calibratedAreaM2));
    }
  }, [plan.calibratedAreaM2]);

  useEffect(() => {
    if (plan.mode !== 'area') {
      setAreaDraftPoints([]);
    }
  }, [plan.mode]);

  const handleMove = (event: MouseEvent<HTMLCanvasElement>) => {
    const point = getNormalizedPoint(event, canvasSize);
    if (draggingApId !== null && plan.mode === 'view') {
      setLocalApPositions((current) => ({
        ...current,
        [draggingApId]: point,
      }));
      return;
    }
    if (draggingPerimeterPoint !== null && plan.mode === 'area') {
      const nextPoints = activePerimeterPoints.map((item, index) => (index === draggingPerimeterPoint ? point : item));
      onPerimeterChange(nextPoints);
      return;
    }

    if (draftStart) {
      setDraftCursor(point);
    }

    const matched = hotspots.find(
      (hotspot) => Math.hypot(hotspot.x - point.x * canvasSize.width, hotspot.y - point.y * canvasSize.height) <= 16,
    );
    setHoveredAp(matched?.ap ?? null);
  };

  const handleMouseDown = (event: MouseEvent<HTMLCanvasElement>) => {
    const point = getNormalizedPoint(event, canvasSize);
    if (!baseLocked && plan.mode === 'area') {
      const matchedIndex = findNearestPerimeterPoint(activePerimeterPoints, point, 0.028);
      if (matchedIndex >= 0) {
        setDraggingPerimeterPoint(matchedIndex);
      }
      return;
    }

    if (plan.mode !== 'view') {
      return;
    }
    const matched = hotspots.find(
      (hotspot) => Math.hypot(hotspot.x - point.x * canvasSize.width, hotspot.y - point.y * canvasSize.height) <= 18,
    );

    if (matched) {
      setLocalApPositions((current) => ({
        ...current,
        [matched.ap.id]: { x: matched.ap.x, y: matched.ap.y },
      }));
      setDraggingApId(matched.ap.id);
    }
  };

  const finalizeApDrag = () => {
    if (draggingApId === null) {
      return;
    }
    const finalPoint = localApPositions[draggingApId];
    if (finalPoint) {
      onAccessPointMove(draggingApId, finalPoint);
    }
    setLocalApPositions({});
    setDraggingApId(null);
  };

  const handleMouseUp = () => {
    finalizeApDrag();
    setDraggingPerimeterPoint(null);
  };

  const handleCanvasClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const point = getNormalizedPoint(event, canvasSize);

    if (!baseLocked && plan.mode === 'area') {
      if (plan.perimeterPoints.length >= 3) {
        return;
      }

      if (areaDraftPoints.length >= 3) {
        const firstPoint = areaDraftPoints[0];
        if (Math.hypot(firstPoint.x - point.x, firstPoint.y - point.y) <= 0.03) {
          onPerimeterChange(areaDraftPoints);
          setAreaDraftPoints([]);
          return;
        }
      }

      setAreaDraftPoints((current) => [...current, point]);
      return;
    }

    if (plan.mode === 'view') {
      const wall = findNearestWall(plan.walls, point, 0.018);
      setSelectedWallId(wall?.id ?? null);
      return;
    }

    if (!draftStart) {
      setDraftStart(point);
      setDraftCursor(point);
      return;
    }

    if (plan.mode === 'scale') {
      onPendingLineChange([draftStart, point]);
    } else if (plan.mode === 'wall') {
      onWallAdd({ start: draftStart, end: point, material: selectedWall?.material ?? 'brick' });
    }

    setDraftStart(null);
    setDraftCursor(null);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `croqui-pagina-${analysis.pageNum}.png`;
    link.click();
  };

  const handleApplyScale = () => {
    const lengthMeters = Number(scaleInput.replace(',', '.'));
    if (!plan.pendingLine || !Number.isFinite(lengthMeters) || lengthMeters <= 0) {
      return;
    }
    onCalibrationApply(lengthMeters);
    setScaleInput('');
    setDraftStart(null);
    setDraftCursor(null);
    onModeChange('view');
  };

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slateink">Croqui interativo</p>
          <p className="text-xs text-slate-500">
            Alcance base alinhado ao U6+ oficial em area aberta e heatmap reagindo a distancia e barreiras.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((current) => Math.max(0.6, Number((current - 0.2).toFixed(2))))}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-tide hover:text-tide"
          >
            Zoom -
          </button>
          <button
            type="button"
            onClick={() => setZoom((current) => Math.min(2.4, Number((current + 0.2).toFixed(2))))}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-tide hover:text-tide"
          >
            Zoom +
          </button>
          <button
            type="button"
            onClick={onAccessPointAdd}
            className="rounded-full bg-tide px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#124f8f]"
          >
            Adicionar U6+
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="rounded-full border border-tide/20 px-4 py-2 text-sm font-semibold text-tide transition hover:border-tide hover:bg-tide/5"
          >
            Baixar croqui
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { mode: 'view' as const, label: 'Visualizar' },
          ...(baseLocked ? [] : [{ mode: 'area' as const, label: 'Validar area' }]),
          ...(baseLocked ? [] : [{ mode: 'scale' as const, label: 'Calibrar escala' }]),
          { mode: 'wall' as const, label: 'Desenhar parede' },
        ].map((option) => (
          <button
            key={option.mode}
            type="button"
            onClick={() => {
              setDraftStart(null);
              setDraftCursor(null);
              onPendingLineChange(null);
              onModeChange(option.mode);
            }}
            className={[
              'rounded-full border px-4 py-2 text-sm font-semibold transition',
              plan.mode === option.mode
                ? 'border-tide bg-tide text-white'
                : 'border-slate-300 text-slate-700 hover:border-tide hover:text-tide',
            ].join(' ')}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mb-4 rounded-2xl border border-tide/15 bg-tide/5 px-4 py-3 text-sm text-slate-600">
        {baseLocked ? (
          <>
            A area construida e a escala deste pavimento ja foram definidas na preparacao da planta e agora ficam
            travadas neste modulo. No modo <span className="font-semibold text-slateink">Visualizar</span>, use o botao
            direito sobre um U6+ para remover o ponto.
          </>
        ) : (
          <>
            Na etapa 2, use <span className="font-semibold text-slateink">Validar area</span> para clicar nas quinas do
            perimetro externo. Ao clicar novamente no primeiro vertice, o poligono fecha e a area rachurada passa a ser
            a base oficial da calibracao e da cobertura. No modo{' '}
            <span className="font-semibold text-slateink">Visualizar</span>, use o botao direito sobre um U6+ para
            remover o ponto.
          </>
        )}
      </div>

      <div className="space-y-4">
        <div className="relative inline-block overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
          <div className="max-h-[78vh] overflow-auto">
            <canvas
            ref={canvasRef}
            className={[
              'block',
              plan.mode === 'view' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair',
            ].join(' ')}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              finalizeApDrag();
              setHoveredAp(null);
              setDraftCursor(null);
              setLocalApPositions({});
              setDraggingPerimeterPoint(null);
            }}
            onContextMenu={(event) => {
              if (plan.mode !== 'view') {
                return;
              }

              const point = getNormalizedPoint(event, canvasSize);
              const matched = hotspots.find(
                (hotspot) =>
                  Math.hypot(hotspot.x - point.x * canvasSize.width, hotspot.y - point.y * canvasSize.height) <= 18,
              );

              if (!matched) {
                return;
              }

              event.preventDefault();
              const shouldDelete = window.confirm(`Excluir AP ${matched.ap.id}?`);
              if (shouldDelete) {
                onAccessPointDelete(matched.ap.id);
                setHoveredAp(null);
              }
            }}
            onClick={handleCanvasClick}
            />

            {hoveredAp ? (
              <div className="pointer-events-none absolute right-3 top-3 max-w-xs rounded-2xl bg-slateink/92 px-4 py-3 text-sm text-white shadow-lg backdrop-blur">
                <p className="font-semibold">
                  AP {hoveredAp.id} - {hoveredAp.ambiente}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-200">{hoveredAp.posicao_descrita}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">U6+ em edicao</p>
                <p className="mt-2 text-lg font-semibold text-slateink">{analysis.access_points.length} pontos ativos</p>
              </div>
              <button
                type="button"
                onClick={onAccessPointAdd}
                className="rounded-full border border-tide/20 px-3 py-2 text-xs font-semibold text-tide transition hover:border-tide hover:bg-tide/5"
              >
                + Novo U6+
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              O alcance base sem paredes segue a referencia oficial de 140 m2 do U6+, e o mapa vai perdendo intensidade
              quando cruza divisorias detectadas.
            </p>
          </div>

          {baseLocked ? (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Escala travada</p>
                <p className="mt-2 text-lg font-semibold text-slateink">
                  {plan.metersPerPixel ? `${plan.metersPerPixel.toFixed(4)} m/px` : 'Nao calibrada'}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  A escala veio da preparacao oficial do pavimento e nao pode mais ser editada aqui.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Area construida</p>
                <p className="mt-2 text-lg font-semibold text-slateink">
                  {plan.calibratedAreaM2 ? `${plan.calibratedAreaM2} m2` : 'Pendente'}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Esta area ja foi confirmada na etapa de preparacao e agora serve de base fixa para cobertura e
                  quantitativos.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Escala</p>
                <p className="mt-2 text-lg font-semibold text-slateink">
                  {plan.metersPerPixel ? `${plan.metersPerPixel.toFixed(4)} m/px` : 'Nao calibrada'}
                </p>
                {plan.calibrationLine ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Referencia ativa: {plan.calibrationLine.lengthMeters.toFixed(2)} m
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">
                    Se a leitura automatica ainda nao estiver boa, use dois pontos conhecidos da planta para calibrar.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Etapa 2 - area da planta</p>
                <p className="mt-2 text-lg font-semibold text-slateink">
                  {plan.calibratedAreaM2
                    ? `${plan.calibratedAreaM2} m2 confirmados`
                    : plan.detectedAreaM2
                      ? `~${plan.detectedAreaM2} m2 sugeridos`
                      : 'Aguardando confirmacao'}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Ajuste os pontos do perimetro no modo Validar area e informe a metragem total real para calibrar a
                  escala do pavimento inteiro.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onPerimeterChange([]);
                      setAreaDraftPoints([]);
                      onModeChange('area');
                    }}
                    className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-tide hover:text-tide"
                  >
                    Redesenhar area
                  </button>
                  <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                    {plan.perimeterPoints.length >= 3
                      ? `${plan.perimeterPoints.length} vertices confirmados`
                      : `${areaDraftPoints.length} vertices em desenho`}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={areaInput}
                    onChange={(event) => setAreaInput(event.target.value)}
                    placeholder="Area real em m2"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-0 transition focus:border-tide"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const parsed = Number(areaInput.replace(',', '.'));
                      if (Number.isFinite(parsed) && parsed > 0) {
                        onAreaCalibrationApply(parsed);
                      }
                    }}
                    className="rounded-xl bg-tide px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#124f8f]"
                  >
                    Confirmar
                  </button>
                </div>
              </div>

              {plan.pendingLine ? (
                <div className="rounded-2xl border border-tide/20 bg-white p-4">
                  <p className="text-sm font-semibold text-slateink">Aplicar escala</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Linha desenhada: ~{pendingPixels.toFixed(1)} px. Informe o comprimento real em metros.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={scaleInput}
                      onChange={(event) => setScaleInput(event.target.value)}
                      placeholder="Ex.: 4.9"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-0 transition focus:border-tide"
                    />
                    <button
                      type="button"
                      onClick={handleApplyScale}
                      className="rounded-xl bg-tide px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#124f8f]"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slateink">Leitura de paredes</p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {detectedWalls.length}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Esta camada tenta destacar divisorias principais automaticamente. O objetivo agora e tornar a leitura clara,
              como no Design Center, antes de sofisticar a classificacao RF.
            </p>
            {plan.perimeterPoints.length === 0 && autoPerimeter.length >= 4 ? (
              <p className="mt-2 text-xs leading-5 text-slate-500">
                O contorno automatico continua como sugestao visual, mas agora a calibracao oficial deve ser feita pelo
                poligono que voce desenhar manualmente.
              </p>
            ) : null}

            {selectedWall ? (
              <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Parede manual</p>
                  <p className="mt-1 text-sm font-semibold text-slateink">{selectedWall.id}</p>
                </div>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Material</span>
                  <select
                    value={selectedWall.material}
                    onChange={(event) => onWallMaterialChange(selectedWall.id, event.target.value as WallMaterial)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-tide"
                  >
                    {wallMaterialOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    onWallDelete(selectedWall.id);
                    setSelectedWallId(null);
                  }}
                  className="w-full rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                >
                  Excluir parede
                </button>
              </div>
            ) : (
              <p className="mt-3 text-xs leading-5 text-slate-500">
                As paredes automaticas ainda nao sao editaveis. As paredes manuais continuam disponiveis quando voce quiser
                corrigir algum trecho.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getNormalizedPoint(event: MouseEvent<HTMLCanvasElement>, canvasSize: { width: number; height: number }): PlanPoint {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
  };
}
