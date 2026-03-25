import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { createEmptyPlan } from '../lib/planState';
import { base64ToDataUrl, clamp } from '../lib/utils';
import type { EditablePlan, PdfPage, PlanPoint } from '../types';

interface ProjectPreparationPanelProps {
  pages: PdfPage[];
  plans: Record<number, EditablePlan | undefined>;
  onFloorLabelChange: (pageNum: number, label: string) => void;
  onPerimeterChange: (pageNum: number, points: PlanPoint[]) => void;
  onAreaCalibrationApply: (pageNum: number, areaM2: number) => void;
  onSavePreparation: () => void;
}

export function ProjectPreparationPanel({
  pages,
  plans,
  onFloorLabelChange,
  onPerimeterChange,
  onAreaCalibrationApply,
  onSavePreparation,
}: ProjectPreparationPanelProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex > pages.length - 1) {
      setCurrentIndex(Math.max(pages.length - 1, 0));
    }
  }, [currentIndex, pages.length]);

  const currentPage = pages[currentIndex];
  if (!currentPage) {
    return null;
  }

  const currentPlan = plans[currentPage.pageNum] ?? (createEmptyPlan(currentPage) satisfies EditablePlan);
  const allPrepared = pages.every((page) => plans[page.pageNum]?.baseReady);

  return (
    <section className="rounded-[28px] border border-white/80 bg-white/90 p-8 shadow-soft backdrop-blur">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-tide">Etapa 3</p>
          <h2 className="mt-2 text-2xl font-semibold text-slateink">Preparar plantas</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Renomeie cada pavimento, feche a area util com vertices e informe a metragem real. Essa base vai alimentar
            todos os modulos depois.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-slateink px-4 py-2 text-sm font-semibold text-white">
            {pages.filter((page) => plans[page.pageNum]?.baseReady).length}/{pages.length} plantas prontas
          </span>
          <button
            type="button"
            disabled={!allPrepared}
            onClick={onSavePreparation}
            className="rounded-full bg-tide px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#124f8f] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Salvar configuracoes das plantas
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-3">
          {pages.map((page, index) => {
            const plan = plans[page.pageNum];
            const active = index === currentIndex;
            return (
              <button
                key={page.pageNum}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={[
                  'w-full rounded-2xl border px-4 py-4 text-left transition',
                  active
                    ? 'border-tide bg-gradient-to-br from-tide/10 to-pine/10'
                    : 'border-slate-200 bg-white hover:border-tide/40 hover:bg-slate-50',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slateink">{plan?.floorLabel || `Planta ${page.pageNum}`}</p>
                    <p className="mt-1 text-xs text-slate-500">Pagina {page.pageNum}</p>
                  </div>
                  <span
                    className={[
                      'rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]',
                      plan?.baseReady ? 'bg-pine/10 text-pine' : 'bg-amber-100 text-amber-700',
                    ].join(' ')}
                  >
                    {plan?.baseReady ? 'Pronta' : 'Pendente'}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  {plan?.calibratedAreaM2 ? `${plan.calibratedAreaM2} m2 confirmados` : 'Falta fechar a area e informar a metragem real'}
                </p>
              </button>
            );
          })}
        </div>

        <PreparationCard
          key={currentPage.pageNum}
          page={currentPage}
          plan={currentPlan}
          onFloorLabelChange={(label) => onFloorLabelChange(currentPage.pageNum, label)}
          onPerimeterChange={(points) => onPerimeterChange(currentPage.pageNum, points)}
          onAreaCalibrationApply={(areaM2) => onAreaCalibrationApply(currentPage.pageNum, areaM2)}
          onAdvance={() => setCurrentIndex((index) => Math.min(index + 1, pages.length - 1))}
        />
      </div>
    </section>
  );
}

interface PreparationCardProps {
  page: PdfPage;
  plan: EditablePlan;
  onFloorLabelChange: (label: string) => void;
  onPerimeterChange: (points: PlanPoint[]) => void;
  onAreaCalibrationApply: (areaM2: number) => void;
  onAdvance: () => void;
}

function PreparationCard({
  page,
  plan,
  onFloorLabelChange,
  onPerimeterChange,
  onAreaCalibrationApply,
  onAdvance,
}: PreparationCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1280, height: 900 });
  const [draftPoints, setDraftPoints] = useState<PlanPoint[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [areaInput, setAreaInput] = useState(plan.calibratedAreaM2 ? String(plan.calibratedAreaM2) : '');
  const imageUrl = useMemo(() => base64ToDataUrl(page.hiResBase64), [page.hiResBase64]);
  const visiblePoints = plan.perimeterPoints.length >= 3 ? plan.perimeterPoints : draftPoints;

  useEffect(() => {
    setDraftPoints([]);
    setAreaInput(plan.calibratedAreaM2 ? String(plan.calibratedAreaM2) : '');
  }, [page.pageNum, plan.calibratedAreaM2]);

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

      const maxWidth = 1620;
      const maxHeight = 1080;
      const ratio = Math.min(maxWidth / image.width, maxHeight / image.height);
      const width = Math.round(image.width * ratio);
      const height = Math.round(image.height * ratio);
      canvas.width = width;
      canvas.height = height;
      setCanvasSize({ width, height });

      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      drawPolygon(context, visiblePoints, width, height, plan.perimeterPoints.length >= 3);
      drawPreparationHeader(context, plan.floorLabel, plan);
    };

    image.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl, plan, visiblePoints]);

  const getPoint = (event: MouseEvent<HTMLCanvasElement>): PlanPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
  };

  const closePolygonIfNeeded = (point: PlanPoint) => {
    if (draftPoints.length < 3) {
      return false;
    }
    const first = draftPoints[0];
    return Math.hypot(first.x - point.x, first.y - point.y) <= 0.025;
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-slate-200 bg-white p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_160px]">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slateink">Nome da planta</span>
            <input
              value={plan.floorLabel}
              onChange={(event) => onFloorLabelChange(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-tide"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slateink">Area real (m2)</span>
            <input
              value={areaInput}
              onChange={(event) => setAreaInput(event.target.value)}
              placeholder="Ex.: 140"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-tide"
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                const parsed = Number(areaInput.replace(',', '.'));
                if (Number.isFinite(parsed) && parsed > 0) {
                  onAreaCalibrationApply(parsed);
                  onAdvance();
                }
              }}
              className="w-full rounded-xl bg-tide px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#124f8f]"
            >
              Salvar base
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-2">
            {plan.calibratedAreaM2 ? `${plan.calibratedAreaM2} m2 confirmados` : 'Area ainda nao confirmada'}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-2">
            {visiblePoints.length} vertices {plan.perimeterPoints.length >= 3 ? 'ativos' : 'em desenho'}
          </span>
          <button
            type="button"
            onClick={() => {
              setDraftPoints([]);
              onPerimeterChange([]);
            }}
            className="rounded-full border border-slate-300 px-3 py-2 font-medium text-slate-700 transition hover:border-tide hover:text-tide"
          >
            Redesenhar area
          </button>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-4">
        <p className="mb-3 text-sm leading-6 text-slate-600">
          Clique nas quinas do perimetro externo. Para fechar a area, clique novamente no primeiro vertice. Depois,
          se precisar, arraste os pontos para corrigir.
        </p>
        <div className="relative inline-block overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
          <canvas
            ref={canvasRef}
            className="block max-w-full cursor-crosshair"
            onMouseDown={(event) => {
              if (plan.perimeterPoints.length < 3) {
                return;
              }
              const point = getPoint(event);
              const match = findNearestPoint(plan.perimeterPoints, point, 0.025);
              if (match >= 0) {
                setDraggingIndex(match);
              }
            }}
            onMouseMove={(event) => {
              if (draggingIndex === null || plan.perimeterPoints.length < 3) {
                return;
              }
              const point = getPoint(event);
              const next = plan.perimeterPoints.map((item, index) => (index === draggingIndex ? point : item));
              onPerimeterChange(next);
            }}
            onMouseUp={() => setDraggingIndex(null)}
            onMouseLeave={() => setDraggingIndex(null)}
            onClick={(event) => {
              if (plan.perimeterPoints.length >= 3) {
                return;
              }
              const point = getPoint(event);
              if (closePolygonIfNeeded(point)) {
                onPerimeterChange(draftPoints);
                setDraftPoints([]);
                return;
              }
              setDraftPoints((current) => [...current, point]);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function drawPreparationHeader(context: CanvasRenderingContext2D, label: string, plan: EditablePlan) {
  const text = `${label} - ${plan.calibratedAreaM2 ? `${plan.calibratedAreaM2}m2 confirmados` : 'base pendente'}`;
  context.save();
  context.font = '11px "Segoe UI"';
  const width = Math.min(context.measureText(text).width + 20, 380);
  context.fillStyle = 'rgba(255,255,255,0.92)';
  roundRect(context, 12, 12, width, 24, 8);
  context.fill();
  context.fillStyle = '#10243A';
  context.textBaseline = 'middle';
  context.fillText(text, 22, 24);
  context.restore();
}

function drawPolygon(
  context: CanvasRenderingContext2D,
  points: PlanPoint[],
  canvasWidth: number,
  canvasHeight: number,
  closed: boolean,
) {
  if (points.length === 0) {
    return;
  }

  context.save();
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
    context.fillStyle = 'rgba(46, 204, 113, 0.06)';
    context.fill();
    context.strokeStyle = 'rgba(46, 204, 113, 0.7)';
    context.lineWidth = 2;
    context.stroke();

    context.save();
    context.clip();
    context.strokeStyle = 'rgba(46, 204, 113, 0.18)';
    for (let x = -canvasHeight; x < canvasWidth + canvasHeight; x += 14) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + canvasHeight, canvasHeight);
      context.stroke();
    }
    context.restore();
  } else {
    context.strokeStyle = 'rgba(46, 204, 113, 0.8)';
    context.lineWidth = 2;
    context.stroke();
  }

  points.forEach((point, index) => {
    const x = point.x * canvasWidth;
    const y = point.y * canvasHeight;
    context.beginPath();
    context.fillStyle = index === 0 ? '#185FA5' : '#0F6E56';
    context.arc(x, y, 6, 0, Math.PI * 2);
    context.fill();
  });

  context.restore();
}

function findNearestPoint(points: PlanPoint[], point: PlanPoint, threshold: number) {
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
