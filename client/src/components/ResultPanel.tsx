import { Suspense, lazy, useMemo } from 'react';
import { getSavedModuleBoard } from '../lib/planState';
import type { AnalysisStateItem, EditablePlan, PlanEditorMode, PlanPoint, WallMaterial } from '../types';

const PlantCanvas = lazy(() =>
  import('./PlantCanvas').then((module) => ({ default: module.PlantCanvas })),
);

interface ResultPanelProps {
  items: AnalysisStateItem[];
  running: boolean;
  onReset: () => void;
  plans: Record<number, EditablePlan>;
  onModeChange: (pageNum: number, mode: PlanEditorMode) => void;
  onPendingLineChange: (pageNum: number, line: [PlanPoint, PlanPoint] | null) => void;
  onCalibrationApply: (pageNum: number, lengthMeters: number) => void;
  onWallAdd: (pageNum: number, wall: { start: PlanPoint; end: PlanPoint; material: WallMaterial }) => void;
  onWallDelete: (pageNum: number, wallId: string) => void;
  onWallMaterialChange: (pageNum: number, wallId: string, material: WallMaterial) => void;
  onAccessPointMove: (pageNum: number, apId: number, point: PlanPoint) => void;
  onAccessPointDelete: (pageNum: number, apId: number) => void;
  onAccessPointAdd: (pageNum: number) => void;
  onMetricsChange: (pageNum: number, metrics: { areaM2: number | null; coveragePercent: number | null }) => void;
  onPerimeterChange: (pageNum: number, points: PlanPoint[]) => void;
  onAreaCalibrationApply: (pageNum: number, areaM2: number) => void;
  onBoardSnapshotChange: (pageNum: number, dataUrl: string) => void;
}

export function ResultPanel({
  items,
  running,
  onReset,
  plans,
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
  onBoardSnapshotChange,
}: ResultPanelProps) {
  const savedBoards = useMemo(
    () =>
      items
        .map((item) => ({ item, board: getSavedModuleBoard(plans[item.pageNum], 'wifi') }))
        .filter((entry) => Boolean(entry.board)),
    [items, plans],
  );

  return (
    <section className="rounded-[28px] border border-white/80 bg-white/90 p-8 shadow-soft backdrop-blur">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-tide">Modulo Wi-Fi</p>
          <h2 className="mt-2 text-2xl font-semibold text-slateink">Resultados do planejamento sem fio</h2>
          <p className="mt-2 text-sm text-slate-500">
            Cada card consome a base calibrada do pavimento e consolida croqui, cobertura estimada, APs sugeridos e
            justificativas tecnicas do modulo Wi-Fi.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {running ? (
            <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700">
              Analise em andamento
            </span>
          ) : null}
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-tide hover:text-tide"
          >
            Nova analise
          </button>
        </div>
      </div>

      {savedBoards.length > 0 ? (
        <div className="mb-8 rounded-[24px] border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-tide">Pranchas Wi-Fi salvas</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {savedBoards.map(({ item, board }) => (
              <div key={item.pageNum} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slateink">{plans[item.pageNum]?.floorLabel || `Pagina ${item.pageNum}`}</p>
                <p className="mt-1 text-xs text-slate-500">{board?.productCount} {board?.productLabel}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Salva em {board ? new Date(board.savedAt).toLocaleString('pt-BR') : '-'}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-8">
        {items.map((item) => {
          if (item.status === 'loading') {
            return (
              <article
                key={item.pageNum}
                className="rounded-[26px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6"
              >
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-slateink">Pavimento - Pagina {item.pageNum}</h3>
                    <p className="text-sm text-slate-500">
                      O motor local esta estimando area, construcao e pontos de instalacao mais adequados.
                    </p>
                  </div>
                  <div className="rounded-full bg-tide/10 px-4 py-2 text-sm font-semibold text-tide">Processando</div>
                </div>
                <div className="flex min-h-60 items-center justify-center rounded-[22px] border border-dashed border-slate-300 bg-white">
                  <div className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-tide/20 border-t-tide" />
                    <p className="text-sm font-medium text-slate-600">Executando analise dedicada desta planta...</p>
                  </div>
                </div>
              </article>
            );
          }

          if (item.status === 'error') {
            return (
              <article key={item.pageNum} className="rounded-[26px] border border-rose-200 bg-rose-50 p-6">
                <h3 className="text-xl font-semibold text-rose-800">Pavimento - Pagina {item.pageNum}</h3>
                <p className="mt-3 text-sm text-rose-700">{item.error}</p>
              </article>
            );
          }

          if (!item.result) {
            return null;
          }

          const plan = plans[item.pageNum];
          const effectiveResult =
            plan && plan.accessPoints.length > 0
              ? {
                  ...item.result,
                  access_points: plan.accessPoints,
                  num_aps: plan.accessPoints.length,
                  cobertura_percentual: plan.dynamicCoveragePercent ?? item.result.cobertura_percentual,
                }
              : item.result;

          return (
            <article
              key={item.pageNum}
              className="rounded-[26px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6"
            >
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-slateink">Pavimento - Pagina {effectiveResult.pageNum}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Tipo construtivo inferido:{' '}
                    <span className="font-semibold text-slateink">{effectiveResult.tipo_construcao}</span>
                  </p>
                </div>
                <div className="grid gap-2 text-right text-sm">
                  <span className="rounded-full bg-tide/10 px-4 py-2 font-semibold text-tide">
                    {effectiveResult.num_aps} APs sugeridos
                  </span>
                  <span className="rounded-full bg-pine/10 px-4 py-2 font-semibold text-pine">
                    {effectiveResult.cobertura_percentual}% de cobertura
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                <Suspense
                  fallback={
                    <div className="rounded-[24px] border border-slate-200 bg-white p-6 text-sm text-slate-500">
                      Carregando croqui interativo...
                    </div>
                  }
                >
                  <PlantCanvas
                    analysis={effectiveResult}
                    pageImageBase64={item.pageImageBase64}
                    plan={plans[item.pageNum]}
                    baseLocked
                    onModeChange={(mode) => onModeChange(item.pageNum, mode)}
                    onPendingLineChange={(line) => onPendingLineChange(item.pageNum, line)}
                    onCalibrationApply={(lengthMeters) => onCalibrationApply(item.pageNum, lengthMeters)}
                    onWallAdd={(wall) => onWallAdd(item.pageNum, wall)}
                    onWallDelete={(wallId) => onWallDelete(item.pageNum, wallId)}
                    onWallMaterialChange={(wallId, material) => onWallMaterialChange(item.pageNum, wallId, material)}
                    onAccessPointMove={(apId, point) => onAccessPointMove(item.pageNum, apId, point)}
                    onAccessPointDelete={(apId) => onAccessPointDelete(item.pageNum, apId)}
                    onAccessPointAdd={() => onAccessPointAdd(item.pageNum)}
                    onMetricsChange={(metrics) => onMetricsChange(item.pageNum, metrics)}
                    onPerimeterChange={(points) => onPerimeterChange(item.pageNum, points)}
                    onAreaCalibrationApply={(areaM2) => onAreaCalibrationApply(item.pageNum, areaM2)}
                    onSnapshotChange={(dataUrl) => onBoardSnapshotChange(item.pageNum, dataUrl)}
                  />
                </Suspense>

                <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.78fr)_minmax(0,1.22fr)]">
                  <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
                    <StatCard label="Quantidade de APs" value={String(effectiveResult.num_aps)} />
                    <StatCard label="Area estimada" value={`~${item.result.area_estimada_m2} m2`} />
                    <StatCard
                      label="Area confirmada"
                      value={plan.calibratedAreaM2 ? `${plan.calibratedAreaM2} m2` : 'Pendente'}
                    />
                    <StatCard label="Cobertura" value={`${effectiveResult.cobertura_percentual}%`} />
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                    <h4 className="text-base font-semibold text-slateink">Analise tecnica local</h4>
                    <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                      {effectiveResult.analise.split('\n\n').map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-[24px] border border-slate-200 bg-white p-5">
                <h4 className="mb-4 text-base font-semibold text-slateink">Lista de APs</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="px-3 py-2 font-semibold">ID</th>
                        <th className="px-3 py-2 font-semibold">Ambiente / local</th>
                        <th className="px-3 py-2 font-semibold">Coordenadas</th>
                        <th className="px-3 py-2 font-semibold">Posicao de instalacao</th>
                        <th className="px-3 py-2 font-semibold">Justificativa tecnica</th>
                      </tr>
                    </thead>
                    <tbody>
                      {effectiveResult.access_points.map((ap) => (
                        <tr key={ap.id} className="rounded-2xl bg-slate-50 text-slate-700">
                          <td className="rounded-l-2xl px-3 py-3 font-semibold text-slateink">AP {ap.id}</td>
                          <td className="px-3 py-3">{ap.ambiente}</td>
                          <td className="px-3 py-3 font-mono text-xs">
                            x={ap.x.toFixed(3)} / y={ap.y.toFixed(3)}
                          </td>
                          <td className="px-3 py-3">{ap.posicao_descrita}</td>
                          <td className="rounded-r-2xl px-3 py-3">{ap.justificativa}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slateink">{value}</p>
    </div>
  );
}
