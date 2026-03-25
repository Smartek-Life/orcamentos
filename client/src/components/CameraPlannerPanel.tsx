import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { createEmptyPlan } from '../lib/planState';
import { base64ToDataUrl, clamp } from '../lib/utils';
import type { CameraDevice, CameraProfile, EditablePlan, PdfPage, PlanPoint } from '../types';

const CAMERA_PROFILE_OPTIONS: Array<{ value: CameraProfile; label: string }> = [
  { value: '1220d', label: 'Cabeada interna (1220d)' },
  { value: '1220b', label: 'Cabeada externa (1220b)' },
  { value: 'im5', label: 'Wi-Fi externa (im5)' },
  { value: 'imx', label: 'Wi-Fi interna (imx)' },
];

interface CameraPlannerPanelProps {
  pages: PdfPage[];
  plans: Record<number, EditablePlan>;
  onCameraAdd: (pageNum: number) => void;
  onCameraMove: (pageNum: number, cameraId: number, point: PlanPoint) => void;
  onCameraUpdate: (pageNum: number, cameraId: number, patch: Partial<CameraDevice>) => void;
  onCameraDelete: (pageNum: number, cameraId: number) => void;
  onSnapshotChange: (pageNum: number, dataUrl: string) => void;
}

export function CameraPlannerPanel({
  pages,
  plans,
  onCameraAdd,
  onCameraMove,
  onCameraUpdate,
  onCameraDelete,
  onSnapshotChange,
}: CameraPlannerPanelProps) {
  return (
    <section className="rounded-[28px] border border-white/80 bg-white/90 p-8 shadow-soft backdrop-blur">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-tide">Modulo Cameras</p>
          <h2 className="mt-2 text-2xl font-semibold text-slateink">Planejamento inicial de CFTV</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            A base calibrada do pavimento agora alimenta um croqui de cameras com posicionamento manual, angulo de
            visao, alcance e leitura inicial da area observada.
          </p>
        </div>
        <div className="grid gap-2 text-right text-sm">
          <span className="rounded-full bg-tide/10 px-4 py-2 font-semibold text-tide">
            {pages.length} pagina(s) ativas
          </span>
          <span className="rounded-full bg-pine/10 px-4 py-2 font-semibold text-pine">
            {pages.reduce((sum, page) => sum + (plans[page.pageNum]?.cameras.length ?? 0), 0)} camera(s)
          </span>
        </div>
      </div>

      <div className="space-y-8">
        {pages.map((page) => (
          <CameraPageCard
            key={page.pageNum}
            page={page}
            plan={plans[page.pageNum]}
            onCameraAdd={() => onCameraAdd(page.pageNum)}
            onCameraMove={(cameraId, point) => onCameraMove(page.pageNum, cameraId, point)}
            onCameraUpdate={(cameraId, patch) => onCameraUpdate(page.pageNum, cameraId, patch)}
            onCameraDelete={(cameraId) => onCameraDelete(page.pageNum, cameraId)}
            onSnapshotChange={(dataUrl) => onSnapshotChange(page.pageNum, dataUrl)}
          />
        ))}
      </div>
    </section>
  );
}

interface CameraPageCardProps {
  page: PdfPage;
  plan: EditablePlan | undefined;
  onCameraAdd: () => void;
  onCameraMove: (cameraId: number, point: PlanPoint) => void;
  onCameraUpdate: (cameraId: number, patch: Partial<CameraDevice>) => void;
  onCameraDelete: (cameraId: number) => void;
  onSnapshotChange: (dataUrl: string) => void;
}

function CameraPageCard({
  page,
  plan,
  onCameraAdd,
  onCameraMove,
  onCameraUpdate,
  onCameraDelete,
  onSnapshotChange,
}: CameraPageCardProps) {
  const activePlan = plan ?? createEmptyPlan(page);
  const [selectedCameraId, setSelectedCameraId] = useState<number | null>(activePlan.cameras[0]?.id ?? null);

  useEffect(() => {
    if (activePlan.cameras.length === 0) {
      setSelectedCameraId(null);
      return;
    }

    if (!activePlan.cameras.some((camera) => camera.id === selectedCameraId)) {
      setSelectedCameraId(activePlan.cameras[0].id);
    }
  }, [activePlan.cameras, selectedCameraId]);

  const selectedCamera = activePlan.cameras.find((camera) => camera.id === selectedCameraId) ?? null;
  const coveredAreaLabel = useMemo(() => {
    if (!selectedCamera) {
      return 'Sem camera selecionada';
    }

    const perimeterArea = activePlan.calibratedAreaM2 ?? activePlan.detectedAreaM2;
    if (!perimeterArea || perimeterArea <= 0) {
      return `${selectedCamera.rangeMeters.toFixed(1)} m de alcance configurado`;
    }

    const estimatedCoverage = Math.min(
      100,
      Math.round(((Math.PI * selectedCamera.rangeMeters * selectedCamera.rangeMeters * (selectedCamera.fovDeg / 360)) / perimeterArea) * 100),
    );

    return `${estimatedCoverage}% da area confirmada`;
  }, [activePlan.calibratedAreaM2, activePlan.detectedAreaM2, selectedCamera]);

  return (
    <article className="rounded-[26px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-slateink">Pavimento - Pagina {page.pageNum}</h3>
          <p className="mt-1 text-sm text-slate-500">
            Base calibrada: {activePlan.calibratedAreaM2 ? `${activePlan.calibratedAreaM2} m2 confirmados` : 'pendente'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            {activePlan.cameras.length} camera(s)
          </span>
          <button
            type="button"
            onClick={onCameraAdd}
            className="rounded-full bg-tide px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#124f8f]"
          >
            Adicionar camera
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <CameraCanvas
          page={page}
          plan={activePlan}
          selectedCameraId={selectedCameraId}
          onSelectCamera={setSelectedCameraId}
          onCameraMove={onCameraMove}
          onCameraDelete={onCameraDelete}
          onSnapshotChange={onSnapshotChange}
        />

        <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Leitura do modulo</p>
            <h4 className="mt-2 text-lg font-semibold text-slateink">Controles da camera</h4>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Arraste a camera no croqui, clique para selecionar e ajuste abaixo o cone de visao inicial.
            </p>
          </div>

          {selectedCamera ? (
            <div className="space-y-4">
              <Field label="Tipo de camera">
                <select
                  value={selectedCamera.profile}
                  onChange={(event) => onCameraUpdate(selectedCamera.id, { profile: event.target.value as CameraProfile })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-tide"
                >
                  {CAMERA_PROFILE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Nome">
                <input
                  value={selectedCamera.nome}
                  onChange={(event) => onCameraUpdate(selectedCamera.id, { nome: event.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-tide"
                />
              </Field>

              <Field label={`Direcao (${Math.round(selectedCamera.directionDeg)} graus)`}>
                <input
                  type="range"
                  min="0"
                  max="359"
                  value={selectedCamera.directionDeg}
                  onChange={(event) => onCameraUpdate(selectedCamera.id, { directionDeg: Number(event.target.value) })}
                  className="w-full accent-tide"
                />
              </Field>

              <Field label={`Abertura (${Math.round(selectedCamera.fovDeg)} graus)`}>
                <input
                  type="range"
                  min="40"
                  max="140"
                  value={selectedCamera.fovDeg}
                  onChange={(event) => onCameraUpdate(selectedCamera.id, { fovDeg: Number(event.target.value) })}
                  className="w-full accent-tide"
                />
              </Field>

              <Field label={`Alcance (${selectedCamera.rangeMeters.toFixed(1)} m)`}>
                <input
                  type="range"
                  min="2"
                  max="30"
                  step="0.5"
                  value={selectedCamera.rangeMeters}
                  onChange={(event) => onCameraUpdate(selectedCamera.id, { rangeMeters: Number(event.target.value) })}
                  className="w-full accent-tide"
                />
              </Field>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slateink">Cobertura visual sugerida</p>
                <p className="mt-2">{coveredAreaLabel}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Este valor ainda e uma leitura geometrica inicial. O proximo passo sera considerar paredes, pontos
                  cegos e sentido de observacao por ambiente.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-500">
              Adicione a primeira camera para começar. O croqui vai mostrar o marcador, a direcao e o cone de visao
              diretamente sobre a planta.
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Base do pavimento</p>
            <div className="mt-3 space-y-3 text-sm text-slate-600">
              <Property label="Area sugerida" value={activePlan.detectedAreaM2 ? `~${activePlan.detectedAreaM2} m2` : 'Pendente'} />
              <Property
                label="Area confirmada"
                value={activePlan.calibratedAreaM2 ? `${activePlan.calibratedAreaM2} m2` : 'Pendente'}
              />
              <Property
                label="Escala"
                value={activePlan.metersPerPixel ? `${activePlan.metersPerPixel.toFixed(4)} m/px` : 'Nao calibrada'}
              />
              <Property
                label="Perimetro"
                value={activePlan.perimeterPoints.length >= 3 ? `${activePlan.perimeterPoints.length} vertices` : 'Nao validado'}
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

interface CameraCanvasProps {
  page: PdfPage;
  plan: EditablePlan;
  selectedCameraId: number | null;
  onSelectCamera: (cameraId: number | null) => void;
  onCameraMove: (cameraId: number, point: PlanPoint) => void;
  onCameraDelete: (cameraId: number) => void;
  onSnapshotChange: (dataUrl: string) => void;
}

function CameraCanvas({
  page,
  plan,
  selectedCameraId,
  onSelectCamera,
  onCameraMove,
  onCameraDelete,
  onSnapshotChange,
}: CameraCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1280, height: 900 });
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const imageUrl = useMemo(() => base64ToDataUrl(page.hiResBase64), [page.hiResBase64]);

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

      const maxWidth = 1620 * zoom;
      const maxHeight = 1080 * zoom;
      const ratio = Math.min(maxWidth / image.width, maxHeight / image.height);
      const width = Math.round(image.width * ratio);
      const height = Math.round(image.height * ratio);
      canvas.width = width;
      canvas.height = height;
      setCanvasSize({ width, height });

      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      if (plan.perimeterPoints.length >= 3) {
        drawPerimeter(context, plan.perimeterPoints, width, height);
      }

      for (const camera of plan.cameras) {
        drawCameraCoverage(context, camera, plan, width, height, camera.id === selectedCameraId);
      }

      drawCameraHeader(context, page.pageNum, plan);
      onSnapshotChange(canvas.toDataURL('image/png'));
    };

    image.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl, onSnapshotChange, page.pageNum, plan, selectedCameraId, zoom]);

  const hotspots = useMemo(
    () =>
      plan.cameras.map((camera) => ({
        id: camera.id,
        x: camera.x * canvasSize.width,
        y: camera.y * canvasSize.height,
      })),
    [canvasSize.height, canvasSize.width, plan.cameras],
  );

  const getPoint = (event: MouseEvent<HTMLCanvasElement>): PlanPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
  };

  return (
    <div className="relative inline-block overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
      <div className="absolute right-3 top-3 z-10 flex gap-2">
        <button
          type="button"
          onClick={() => setZoom((current) => Math.max(0.6, Number((current - 0.2).toFixed(2))))}
          className="rounded-full bg-white/92 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow"
        >
          Zoom -
        </button>
        <button
          type="button"
          onClick={() => setZoom((current) => Math.min(2.4, Number((current + 0.2).toFixed(2))))}
          className="rounded-full bg-white/92 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow"
        >
          Zoom +
        </button>
      </div>
      <div className="max-h-[78vh] overflow-auto">
      <canvas
        ref={canvasRef}
        className="block cursor-crosshair"
        onMouseDown={(event) => {
          const point = getPoint(event);
          const matched = hotspots.find(
            (camera) => Math.hypot(camera.x - point.x * canvasSize.width, camera.y - point.y * canvasSize.height) <= 18,
          );

          if (matched) {
            onSelectCamera(matched.id);
            setDraggingId(matched.id);
          } else {
            onSelectCamera(null);
          }
        }}
        onMouseMove={(event) => {
          if (draggingId === null) {
            return;
          }
          onCameraMove(draggingId, getPoint(event));
        }}
        onMouseUp={() => setDraggingId(null)}
        onMouseLeave={() => setDraggingId(null)}
        onClick={(event) => {
          const point = getPoint(event);
          const matched = hotspots.find(
            (camera) => Math.hypot(camera.x - point.x * canvasSize.width, camera.y - point.y * canvasSize.height) <= 18,
          );
          onSelectCamera(matched?.id ?? null);
        }}
        onContextMenu={(event) => {
          const point = getPoint(event);
          const matched = hotspots.find(
            (camera) => Math.hypot(camera.x - point.x * canvasSize.width, camera.y - point.y * canvasSize.height) <= 18,
          );
          if (!matched) {
            return;
          }

          event.preventDefault();
          const shouldDelete = window.confirm(`Excluir camera ${matched.id}?`);
          if (shouldDelete) {
            onCameraDelete(matched.id);
          }
        }}
      />
      <div className="pointer-events-none absolute left-3 top-3 rounded-2xl bg-slateink/90 px-4 py-3 text-sm text-white shadow-lg backdrop-blur">
        <p className="font-semibold">Planejamento de cameras</p>
        <p className="mt-1 text-xs leading-5 text-slate-200">
          Arraste os marcadores sobre a planta. Clique para editar e use botao direito para excluir.
        </p>
      </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slateink">{label}</span>
      {children}
    </label>
  );
}

function Property({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slateink">{value}</span>
    </div>
  );
}

function drawPerimeter(
  context: CanvasRenderingContext2D,
  points: PlanPoint[],
  canvasWidth: number,
  canvasHeight: number,
) {
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
  context.closePath();
  context.strokeStyle = 'rgba(24, 95, 165, 0.45)';
  context.lineWidth = 2;
  context.stroke();
  context.restore();
}

function drawCameraCoverage(
  context: CanvasRenderingContext2D,
  camera: CameraDevice,
  plan: EditablePlan,
  canvasWidth: number,
  canvasHeight: number,
  selected: boolean,
) {
  const centerX = camera.x * canvasWidth;
  const centerY = camera.y * canvasHeight;
  const radiusPx = plan.metersPerPixel
    ? camera.rangeMeters / plan.metersPerPixel
    : Math.min(canvasWidth, canvasHeight) * 0.18;
  const startAngle = ((camera.directionDeg - camera.fovDeg / 2 - 90) * Math.PI) / 180;
  const endAngle = ((camera.directionDeg + camera.fovDeg / 2 - 90) * Math.PI) / 180;

  context.save();
  context.fillStyle = selected ? 'rgba(15, 110, 86, 0.18)' : 'rgba(24, 95, 165, 0.14)';
  context.strokeStyle = selected ? 'rgba(15, 110, 86, 0.78)' : 'rgba(24, 95, 165, 0.52)';
  context.lineWidth = selected ? 2.6 : 1.8;
  context.beginPath();
  context.moveTo(centerX, centerY);
  context.arc(centerX, centerY, radiusPx, startAngle, endAngle);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();

  context.save();
  context.strokeStyle = selected ? '#0F6E56' : '#185FA5';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(centerX, centerY);
  context.lineTo(
    centerX + Math.cos((camera.directionDeg - 90) * (Math.PI / 180)) * radiusPx,
    centerY + Math.sin((camera.directionDeg - 90) * (Math.PI / 180)) * radiusPx,
  );
  context.stroke();
  context.restore();

  context.save();
  context.fillStyle = selected ? '#0F6E56' : '#10243A';
  context.strokeStyle = '#FFFFFF';
  context.lineWidth = 2.5;
  context.beginPath();
  context.arc(centerX, centerY, 11, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();

  context.save();
  context.fillStyle = '#FFFFFF';
  context.font = 'bold 10px "Segoe UI"';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(camera.id), centerX, centerY);
  context.restore();

  context.save();
  context.fillStyle = 'rgba(255,255,255,0.9)';
  const label = camera.nome;
  const labelWidth = Math.max(54, context.measureText(label).width + 16);
  roundRect(context, centerX + 14, centerY - 13, labelWidth, 22, 8);
  context.fill();
  context.fillStyle = '#10243A';
  context.font = '11px "Segoe UI"';
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillText(label, centerX + 22, centerY - 2);
  context.restore();
}

function drawCameraHeader(context: CanvasRenderingContext2D, pageNum: number, plan: EditablePlan) {
  const label = `Pagina ${pageNum} - ${plan.cameras.length} camera(s) - ${plan.calibratedAreaM2 ? `${plan.calibratedAreaM2}m2 confirmados` : 'area pendente'}`;
  context.save();
  context.font = '11px "Segoe UI"';
  const width = Math.min(context.measureText(label).width + 20, 380);
  context.fillStyle = 'rgba(255,255,255,0.92)';
  roundRect(context, 12, 12, width, 24, 8);
  context.fill();
  context.fillStyle = '#10243A';
  context.textBaseline = 'middle';
  context.fillText(label, 22, 24);
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
