import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { AMP_MODEL_OPTIONS, describeAudioSystem, getAmpModel, getSystemZones, selectAmplifier } from '../lib/audio/ampSelector';
import { getSpeakerBoxPx, pointInSpeakerBox } from '../lib/audio/speakerGeometry';
import {
  getSpeakerDisplayLabel,
  getSpeakerModelOptionById,
  getSpeakerModelOptionForSpeaker,
  SPEAKER_MODEL_OPTIONS,
} from '../lib/audio/speakerModels';
import { createEmptyPlan } from '../lib/planState';
import { base64ToDataUrl, clamp } from '../lib/utils';
import type { AudioTvPoint, AudioZone, AudioSystem, EditablePlan, PdfPage, PlanPoint, SpeakerDevice } from '../types';

interface AudioPlannerPanelProps {
  pages: PdfPage[];
  plans: Record<number, EditablePlan>;
  onSpeakerAdd: (pageNum: number) => void;
  onSpeakerMove: (pageNum: number, speakerId: number, point: PlanPoint) => void;
  onSpeakerUpdate: (pageNum: number, speakerId: number, patch: Partial<SpeakerDevice>) => void;
  onSpeakerRotate: (pageNum: number, speakerId: number) => void;
  onSpeakerDelete: (pageNum: number, speakerId: number) => void;
  onAudioTvAdd: (pageNum: number, systemId: string, point: PlanPoint) => void;
  onAudioTvMove: (pageNum: number, tvId: string, point: PlanPoint) => void;
  onAudioTvDelete: (pageNum: number, tvId: string) => void;
  onSpeakerAlign: (pageNum: number, referenceId: number, targetId: number, axis: 'horizontal' | 'vertical') => void;
  onAudioSystemCreate: (pageNum: number, system: AudioSystem) => void;
  onAudioSystemPatch: (pageNum: number, systemId: string, patch: Partial<AudioSystem>) => void;
  onAudioSystemDelete: (pageNum: number, systemId: string) => void;
  onAudioZoneCreate: (pageNum: number, zone: AudioZone) => void;
  onAudioZonePatch: (pageNum: number, zoneId: string, patch: Partial<AudioZone>) => void;
  onAudioZoneDelete: (pageNum: number, zoneId: string) => void;
  onDistributeAudioZone: (pageNum: number, zoneId: string) => void;
  onSnapshotChange: (pageNum: number, dataUrl: string) => void;
}

export function AudioPlannerPanel({
  pages,
  plans,
  onSpeakerAdd,
  onSpeakerMove,
  onSpeakerUpdate,
  onSpeakerRotate,
  onSpeakerDelete,
  onAudioTvAdd,
  onAudioTvMove,
  onAudioTvDelete,
  onSpeakerAlign,
  onAudioSystemCreate,
  onAudioSystemPatch,
  onAudioSystemDelete,
  onAudioZoneCreate,
  onAudioZonePatch,
  onAudioZoneDelete,
  onDistributeAudioZone,
  onSnapshotChange,
}: AudioPlannerPanelProps) {
  const totalSpeakers = pages.reduce((sum, page) => sum + (plans[page.pageNum]?.speakers.length ?? 0), 0);

  return (
    <section className="rounded-[28px] border border-white/80 bg-white/90 p-8 shadow-soft backdrop-blur">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-tide">Modulo Sonorizacao</p>
          <h2 className="mt-2 text-2xl font-semibold text-slateink">Planejamento de audio ambiente</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Posicione caixas de teto, outdoor e subwoofers sobre a planta calibrada. O sistema sugere a leitura inicial
            do amplificador por zonas e permite organizar alinhamento entre pontos.
          </p>
        </div>
        <div className="grid gap-2 text-right text-sm">
          <span className="rounded-full bg-tide/10 px-4 py-2 font-semibold text-tide">{pages.length} pagina(s) ativas</span>
          <span className="rounded-full bg-pine/10 px-4 py-2 font-semibold text-pine">{totalSpeakers} caixa(s)</span>
        </div>
      </div>

      <div className="space-y-8">
        {pages.map((page) => (
          <AudioPageCard
            key={page.pageNum}
            page={page}
            plan={plans[page.pageNum]}
            onSpeakerAdd={() => onSpeakerAdd(page.pageNum)}
            onSpeakerMove={(speakerId, point) => onSpeakerMove(page.pageNum, speakerId, point)}
            onSpeakerUpdate={(speakerId, patch) => onSpeakerUpdate(page.pageNum, speakerId, patch)}
            onSpeakerRotate={(speakerId) => onSpeakerRotate(page.pageNum, speakerId)}
            onSpeakerDelete={(speakerId) => onSpeakerDelete(page.pageNum, speakerId)}
            onAudioTvAdd={(systemId, point) => onAudioTvAdd(page.pageNum, systemId, point)}
            onAudioTvMove={(tvId, point) => onAudioTvMove(page.pageNum, tvId, point)}
            onAudioTvDelete={(tvId) => onAudioTvDelete(page.pageNum, tvId)}
            onSpeakerAlign={(referenceId, targetId, axis) => onSpeakerAlign(page.pageNum, referenceId, targetId, axis)}
            onAudioSystemCreate={(system) => onAudioSystemCreate(page.pageNum, system)}
            onAudioSystemPatch={(systemId, patch) => onAudioSystemPatch(page.pageNum, systemId, patch)}
            onAudioSystemDelete={(systemId) => onAudioSystemDelete(page.pageNum, systemId)}
            onAudioZoneCreate={(zone) => onAudioZoneCreate(page.pageNum, zone)}
            onAudioZonePatch={(zoneId, patch) => onAudioZonePatch(page.pageNum, zoneId, patch)}
            onAudioZoneDelete={(zoneId) => onAudioZoneDelete(page.pageNum, zoneId)}
            onDistributeAudioZone={(zoneId) => onDistributeAudioZone(page.pageNum, zoneId)}
            onSnapshotChange={(dataUrl) => onSnapshotChange(page.pageNum, dataUrl)}
          />
        ))}
      </div>
    </section>
  );
}

interface AudioPageCardProps {
  page: PdfPage;
  plan: EditablePlan | undefined;
  onSpeakerAdd: () => void;
  onSpeakerMove: (speakerId: number, point: PlanPoint) => void;
  onSpeakerUpdate: (speakerId: number, patch: Partial<SpeakerDevice>) => void;
  onSpeakerRotate: (speakerId: number) => void;
  onSpeakerDelete: (speakerId: number) => void;
  onAudioTvAdd: (systemId: string, point: PlanPoint) => void;
  onAudioTvMove: (tvId: string, point: PlanPoint) => void;
  onAudioTvDelete: (tvId: string) => void;
  onSpeakerAlign: (referenceId: number, targetId: number, axis: 'horizontal' | 'vertical') => void;
  onAudioSystemCreate: (system: AudioSystem) => void;
  onAudioSystemPatch: (systemId: string, patch: Partial<AudioSystem>) => void;
  onAudioSystemDelete: (systemId: string) => void;
  onAudioZoneCreate: (zone: AudioZone) => void;
  onAudioZonePatch: (zoneId: string, patch: Partial<AudioZone>) => void;
  onAudioZoneDelete: (zoneId: string) => void;
  onDistributeAudioZone: (zoneId: string) => void;
  onSnapshotChange: (dataUrl: string) => void;
}

function AudioPageCard({
  page,
  plan,
  onSpeakerAdd,
  onSpeakerMove,
  onSpeakerUpdate,
  onSpeakerRotate,
  onSpeakerDelete,
  onAudioTvAdd,
  onAudioTvMove,
  onAudioTvDelete,
  onSpeakerAlign,
  onAudioSystemCreate,
  onAudioSystemPatch,
  onAudioSystemDelete,
  onAudioZoneCreate,
  onAudioZonePatch,
  onAudioZoneDelete,
  onDistributeAudioZone,
  onSnapshotChange,
}: AudioPageCardProps) {
  const activePlan = plan ?? createEmptyPlan(page);
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<number | null>(activePlan.speakers[0]?.id ?? null);
  const [selectedTvId, setSelectedTvId] = useState<string | null>(activePlan.audioTvPoints[0]?.id ?? null);
  const [alignReferenceId, setAlignReferenceId] = useState<number | null>(null);
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(activePlan.audioSystems[0]?.id ?? null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(activePlan.audioZones[0]?.id ?? null);
  const [zoneDraftPoints, setZoneDraftPoints] = useState<PlanPoint[]>([]);
  const [drawingZone, setDrawingZone] = useState(false);
  const [markingTvs, setMarkingTvs] = useState(false);

  useEffect(() => {
    if (activePlan.speakers.length === 0) {
      setSelectedSpeakerId(null);
      setAlignReferenceId(null);
    } else {
      if (!activePlan.speakers.some((speaker) => speaker.id === selectedSpeakerId)) {
        setSelectedSpeakerId(activePlan.speakers[0].id);
      }

      if (alignReferenceId !== null && !activePlan.speakers.some((speaker) => speaker.id === alignReferenceId)) {
        setAlignReferenceId(null);
      }
    }
  }, [activePlan.speakers, alignReferenceId, selectedSpeakerId]);

  useEffect(() => {
    if (activePlan.audioTvPoints.length === 0) {
      setSelectedTvId(null);
      return;
    }

    if (!activePlan.audioTvPoints.some((tv) => tv.id === selectedTvId)) {
      setSelectedTvId(activePlan.audioTvPoints[0].id);
    }
  }, [activePlan.audioTvPoints, selectedTvId]);

  useEffect(() => {
    if (activePlan.audioSystems.length === 0) {
      setSelectedSystemId(null);
      return;
    }

    if (!activePlan.audioSystems.some((system) => system.id === selectedSystemId)) {
      setSelectedSystemId(activePlan.audioSystems[0].id);
    }
  }, [activePlan.audioSystems, selectedSystemId]);

  useEffect(() => {
    if (activePlan.audioZones.length === 0) {
      setSelectedZoneId(null);
      return;
    }

    if (!activePlan.audioZones.some((zone) => zone.id === selectedZoneId)) {
      setSelectedZoneId(activePlan.audioZones[0].id);
    }
  }, [activePlan.audioZones, selectedZoneId]);

  const selectedSpeaker = activePlan.speakers.find((speaker) => speaker.id === selectedSpeakerId) ?? null;
  const selectedTv = activePlan.audioTvPoints.find((tv) => tv.id === selectedTvId) ?? null;
  const alignReferenceSpeaker = activePlan.speakers.find((speaker) => speaker.id === alignReferenceId) ?? null;
  const selectedSystem = activePlan.audioSystems.find((system) => system.id === selectedSystemId) ?? null;
  const selectedZone = activePlan.audioZones.find((zone) => zone.id === selectedZoneId) ?? null;
  const selectedAmpModel = selectedSystem ? getAmpModel(selectedSystem.ampType) : null;
  const selectedSystemZones = selectedSystem ? getSystemZones(selectedSystem.id, activePlan.audioZones) : [];
  const selectedSystemTvPoints = selectedSystem
    ? activePlan.audioTvPoints.filter((tv) => tv.systemId === selectedSystem.id)
    : [];

  useEffect(() => {
    if (!selectedSystem?.hasAudioSource) {
      setMarkingTvs(false);
    }
  }, [selectedSystem?.hasAudioSource]);

  const finalizeZoneDraft = () => {
    if (zoneDraftPoints.length < 3) {
      return;
    }

    if (!selectedSystemId) {
      return;
    }

    const zoneId = `zone-${page.pageNum}-${Date.now()}`;
    const nextZoneIndex = activePlan.audioZones.length + 1;
    onAudioZoneCreate({
      id: zoneId,
      nome: `Zona ${nextZoneIndex}`,
      systemId: selectedSystemId,
      points: regularizeZoneRectangle(zoneDraftPoints),
      speakerCount: 4,
      includeSubwoofer: false,
      speakerType: 'ceiling_national',
      speakerSizeInches: 6,
    });
    setSelectedZoneId(zoneId);
    setZoneDraftPoints([]);
    setDrawingZone(false);
  };

  const createAudioSystem = () => {
    const nextIndex = activePlan.audioSystems.length + 1;
    const recommendation = selectAmplifier([]);
    const systemId = `system-${page.pageNum}-${Date.now()}`;
    onAudioSystemCreate({
      id: systemId,
      nome: `Sistema ${nextIndex}`,
      ampType: recommendation.ampType,
      hasAudioSource: false,
    });
    setSelectedSystemId(systemId);
  };

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
            {activePlan.speakers.length} caixa(s)
          </span>
          <button
            type="button"
            onClick={() => {
              if (!selectedSystemId) {
                return;
              }
              setMarkingTvs(false);
              setDrawingZone((current) => !current);
              setZoneDraftPoints([]);
            }}
            className={[
              'rounded-full border px-4 py-2 text-sm font-semibold transition',
              !selectedSystemId
                ? 'cursor-not-allowed border-slate-200 text-slate-300'
                : drawingZone
                  ? 'border-pine bg-pine/10 text-pine'
                  : 'border-slate-300 text-slate-700 hover:border-pine/50',
            ].join(' ')}
            disabled={!selectedSystemId}
          >
            {drawingZone ? 'Cancelar zona' : 'Desenhar zona'}
          </button>
          <button
            type="button"
            onClick={onSpeakerAdd}
            className="rounded-full bg-tide px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#124f8f]"
          >
            Adicionar caixa
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <AudioCanvas
          page={page}
          plan={activePlan}
          selectedSpeakerId={selectedSpeakerId}
          selectedTvId={selectedTvId}
          selectedZoneId={selectedZoneId}
          selectedSystemId={selectedSystemId}
          alignReferenceId={alignReferenceId}
          drawingZone={drawingZone}
          markingTvs={markingTvs}
          zoneDraftPoints={zoneDraftPoints}
          onSelectSpeaker={setSelectedSpeakerId}
          onSelectTv={setSelectedTvId}
          onSelectZone={setSelectedZoneId}
          onZoneDraftChange={setZoneDraftPoints}
          onZoneDraftComplete={finalizeZoneDraft}
          onZoneDrawingChange={setDrawingZone}
          onSpeakerMove={onSpeakerMove}
          onSpeakerRotate={onSpeakerRotate}
          onSpeakerDelete={onSpeakerDelete}
          onAudioTvAdd={onAudioTvAdd}
          onAudioTvMove={onAudioTvMove}
          onAudioTvDelete={onAudioTvDelete}
          onSnapshotChange={onSnapshotChange}
        />

        <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Leitura do modulo</p>
            <h4 className="mt-2 text-lg font-semibold text-slateink">Controles da caixa</h4>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Arraste as caixas sobre a planta, clique para selecionar e use os controles abaixo para definir tipo,
              tamanho, orientacao e alinhamento. Para ambientes completos, desenhe uma zona e deixe o sistema
              distribuir as caixas automaticamente.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Sistemas e zonas</p>
                <p className="mt-1 text-sm text-slate-500">
                  Crie um sistema com amplificador proprio e depois desenhe as zonas ligadas a ele.
                </p>
              </div>
              <button
                type="button"
                onClick={createAudioSystem}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-tide hover:text-tide"
              >
                Novo sistema
              </button>
            </div>

            {activePlan.audioSystems.length > 0 ? (
              <div className="space-y-3">
                {activePlan.audioSystems.map((system) => {
                  const systemZones = getSystemZones(system.id, activePlan.audioZones);
                  const summary = describeAudioSystem(system, activePlan.audioZones);
                  const recommended = selectAmplifier(systemZones);

                  return (
                    <div
                      key={system.id}
                      className={[
                        'rounded-2xl border p-4 transition',
                        selectedSystemId === system.id ? 'border-tide bg-tide/5' : 'border-slate-200 bg-white',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedSystemId(system.id)}
                          className="text-left"
                        >
                          <p className="text-sm font-semibold text-slateink">{system.nome}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {summary.zoneCount} zona(s) · {summary.speakerCount} item(ns)
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => onAudioSystemDelete(system.id)}
                          className="rounded-full border border-rose-300 px-2.5 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50"
                        >
                          Excluir
                        </button>
                      </div>

                      {selectedSystemId === system.id ? (
                        <div className="mt-4 space-y-3">
                          <Field label="Nome do sistema">
                            <input
                              value={system.nome}
                              onChange={(event) => onAudioSystemPatch(system.id, { nome: event.target.value })}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-tide"
                            />
                          </Field>

                          <Field label="Amplificador deste sistema">
                            <select
                              value={system.ampType}
                              onChange={(event) => onAudioSystemPatch(system.id, { ampType: event.target.value as AudioSystem['ampType'] })}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-tide"
                            >
                              {AMP_MODEL_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </Field>

                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Sugestao</p>
                            <p className="mt-1 text-sm font-semibold text-slateink">{recommended.label}</p>
                            <p className="mt-1 text-xs text-slate-500">{recommended.reason}</p>
                          </div>

                          <label className="flex cursor-pointer items-center gap-3">
                            <input
                              type="checkbox"
                              checked={system.hasAudioSource}
                              onChange={(event) => {
                                const checked = event.target.checked;
                                onAudioSystemPatch(system.id, { hasAudioSource: checked });
                                if (!checked) {
                                  selectedSystemTvPoints.forEach((tv) => onAudioTvDelete(tv.id));
                                  setMarkingTvs(false);
                                }
                              }}
                              className="h-4 w-4 rounded accent-tide"
                            />
                            <span className="text-sm text-slate-700">Ponto de extracao de audio neste sistema</span>
                          </label>

                          {system.hasAudioSource ? (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">TVs / entradas</p>
                                  <p className="mt-1 text-sm text-slate-700">
                                    Marque as TVs deste sistema para calcular DACs e conferir entradas disponiveis.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDrawingZone(false);
                                    setZoneDraftPoints([]);
                                    setMarkingTvs((current) => !current);
                                  }}
                                  className={[
                                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                                    markingTvs
                                      ? 'border-pine bg-pine/10 text-pine'
                                      : 'border-slate-300 text-slate-700 hover:border-pine/50 hover:text-pine',
                                  ].join(' ')}
                                >
                                  {markingTvs ? 'Parar de marcar TVs' : 'Marcar TVs no projeto'}
                                </button>
                              </div>

                              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                                <Property label="TVs marcadas" value={String(selectedSystemTvPoints.length)} />
                                <Property label="Entradas do amp" value={String(selectedAmpModel?.inputs ?? 0)} />
                                <Property label="DACs previstos" value={String(Math.max(0, selectedSystemTvPoints.length - 1))} />
                              </div>

                              {selectedAmpModel && selectedSystemTvPoints.length > selectedAmpModel.inputs ? (
                                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                                  O amplificador selecionado tem menos entradas do que a quantidade de TVs marcada neste sistema.
                                </p>
                              ) : null}
                            </div>
                          ) : null}

                          <div className="flex flex-wrap gap-2">
                            {systemZones.map((zone) => (
                              <button
                                key={zone.id}
                                type="button"
                                onClick={() => setSelectedZoneId(zone.id)}
                                className={[
                                  'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                                  selectedZoneId === zone.id
                                    ? 'border-tide bg-tide/10 text-tide'
                                    : 'border-slate-300 text-slate-600 hover:border-tide/50',
                                ].join(' ')}
                              >
                                {zone.nome}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Nenhum sistema criado ainda. Comece por “Novo sistema”.</p>
            )}

            {selectedZone ? (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                <Field label="Nome da zona">
                  <input
                    value={selectedZone.nome}
                    onChange={(event) => onAudioZonePatch(selectedZone.id, { nome: event.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-tide"
                  />
                </Field>

                <Field label="Quantidade de caixas">
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={selectedZone.speakerCount}
                    onChange={(event) =>
                      onAudioZonePatch(selectedZone.id, {
                        speakerCount: Math.max(1, Math.min(12, Number(event.target.value) || 1)),
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-tide"
                  />
                </Field>

                <Field label="Tipo de caixa da zona">
                  <select
                    value={
                      getSpeakerModelOptionForSpeaker({
                        type: selectedZone.speakerType,
                        sizeInches: selectedZone.speakerSizeInches,
                      })?.id ?? 'ceiling_national_6'
                    }
                    onChange={(event) => {
                      const nextModel = getSpeakerModelOptionById(event.target.value);
                      if (!nextModel) {
                        return;
                      }

                      onAudioZonePatch(selectedZone.id, {
                        speakerType: nextModel.type,
                        speakerSizeInches: nextModel.sizeInches,
                      });
                    }}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-tide"
                  >
                    {SPEAKER_MODEL_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedZone.includeSubwoofer}
                    onChange={(event) => onAudioZonePatch(selectedZone.id, { includeSubwoofer: event.target.checked })}
                    className="h-4 w-4 rounded accent-tide"
                  />
                  <span className="text-sm text-slate-700">Adicionar subwoofer nesta zona</span>
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onDistributeAudioZone(selectedZone.id)}
                    className="flex-1 rounded-xl bg-tide px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#124f8f]"
                  >
                    Distribuir caixas na zona
                  </button>
                  <button
                    type="button"
                    onClick={() => onAudioZoneDelete(selectedZone.id)}
                    className="rounded-xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {selectedSpeaker ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                <p className="font-semibold text-slateink">Caixa selecionada</p>
                <p className="mt-2">
                  Modelo da zona: <span className="font-semibold text-slateink">{selectedZone?.nome ?? 'Sem zona'}</span>
                </p>
                <p className="mt-1">
                  Item: <span className="font-semibold text-slateink">{getSpeakerDisplayLabel(selectedSpeaker)}</span>
                </p>
                <p className="mt-1">
                  Orientacao atual: <span className="font-semibold text-slateink">{selectedSpeaker.rotationDeg} graus</span>
                </p>
                <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs text-slate-500">
                  Use o botao auxiliar sobre a caixa no croqui para rotacionar 90 graus ou excluir.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-sm font-semibold text-slateink">Alinhamento</p>
                {alignReferenceId === null ? (
                  <button
                    type="button"
                    onClick={() => setAlignReferenceId(selectedSpeaker.id)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-tide hover:text-tide"
                  >
                    Definir como referencia
                  </button>
                ) : alignReferenceId === selectedSpeaker.id ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-tide">
                      Esta caixa e a referencia. Selecione outra para alinhar.
                    </p>
                    <button
                      type="button"
                      onClick={() => setAlignReferenceId(null)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-500 transition hover:border-slate-400"
                    >
                      Cancelar referencia
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">
                      Referencia:{' '}
                      <span className="font-semibold text-slateink">
                        {alignReferenceSpeaker?.nome ?? `Caixa ${alignReferenceId}`}
                      </span>
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSpeakerAlign(alignReferenceId, selectedSpeaker.id, 'horizontal');
                          setAlignReferenceId(null);
                        }}
                        className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-tide hover:text-tide"
                      >
                        Alinhar horizontal
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSpeakerAlign(alignReferenceId, selectedSpeaker.id, 'vertical');
                          setAlignReferenceId(null);
                        }}
                        className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-tide hover:text-tide"
                      >
                        Alinhar vertical
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAlignReferenceId(null)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-400 transition hover:border-slate-300"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-500">
              Adicione a primeira caixa para comecar. O croqui vai mostrar a caixa diretamente sobre a planta e o painel
              lateral libera os controles.
            </div>
          )}

          {selectedTv ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              <p className="font-semibold text-slateink">TV selecionada</p>
              <p className="mt-2">
                Sistema: <span className="font-semibold text-slateink">{selectedSystem?.nome ?? 'Sem sistema'}</span>
              </p>
              <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs text-slate-500">
                Use o botao auxiliar sobre a TV para excluir este ponto de extracao.
              </p>
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Resumo do pavimento</p>
              <p className="mt-2 text-sm font-semibold text-slateink">{activePlan.audioSystems.length} sistema(s) de audio</p>
              <p className="mt-1 text-xs text-slate-500">
                {activePlan.audioZones.length} zona(s) desenhada(s) e {activePlan.speakers.length} item(ns) posicionados.
              </p>
            </div>

            <Property label="Sistemas" value={`${activePlan.audioSystems.length || 0}`} />
            <Property label="Zonas desenhadas" value={`${activePlan.audioZones.length || 0}`} />
            <Property label="Caixas/Subs" value={`${activePlan.speakers.length || 0}`} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Base do pavimento</p>
            <div className="mt-3 space-y-3 text-sm text-slate-600">
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

interface AudioCanvasProps {
  page: PdfPage;
  plan: EditablePlan;
  selectedSpeakerId: number | null;
  selectedTvId: string | null;
  selectedZoneId: string | null;
  selectedSystemId: string | null;
  alignReferenceId: number | null;
  drawingZone: boolean;
  markingTvs: boolean;
  zoneDraftPoints: PlanPoint[];
  onSelectSpeaker: (speakerId: number | null) => void;
  onSelectTv: (tvId: string | null) => void;
  onSelectZone: (zoneId: string | null) => void;
  onZoneDraftChange: (points: PlanPoint[]) => void;
  onZoneDraftComplete: () => void;
  onZoneDrawingChange: (drawing: boolean) => void;
  onSpeakerMove: (speakerId: number, point: PlanPoint) => void;
  onSpeakerRotate: (speakerId: number) => void;
  onSpeakerDelete: (speakerId: number) => void;
  onAudioTvAdd: (systemId: string, point: PlanPoint) => void;
  onAudioTvMove: (tvId: string, point: PlanPoint) => void;
  onAudioTvDelete: (tvId: string) => void;
  onSnapshotChange: (dataUrl: string) => void;
}

function AudioCanvas({
  page,
  plan,
  selectedSpeakerId,
  selectedTvId,
  selectedZoneId,
  selectedSystemId,
  alignReferenceId,
  drawingZone,
  markingTvs,
  zoneDraftPoints,
  onSelectSpeaker,
  onSelectTv,
  onSelectZone,
  onZoneDraftChange,
  onZoneDraftComplete,
  onZoneDrawingChange,
  onSpeakerMove,
  onSpeakerRotate,
  onSpeakerDelete,
  onAudioTvAdd,
  onAudioTvMove,
  onAudioTvDelete,
  onSnapshotChange,
}: AudioCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1280, height: 900 });
  const [draggingSpeakerId, setDraggingSpeakerId] = useState<number | null>(null);
  const [draggingTvId, setDraggingTvId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; speakerId: number | null; tvId: string | null } | null>(null);
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

      renderAudioScene(context, image, {
        width,
        height,
        plan,
        pageNum: page.pageNum,
        selectedSpeakerId,
        selectedTvId,
        selectedZoneId,
        alignReferenceId,
        zoneDraftPoints,
      });

      const snapshotRatio = Math.min(1620 / image.width, 1080 / image.height);
      const snapshotW = Math.round(image.width * snapshotRatio);
      const snapshotH = Math.round(image.height * snapshotRatio);
      const snapshotCanvas = document.createElement('canvas');
      snapshotCanvas.width = snapshotW;
      snapshotCanvas.height = snapshotH;
      const snapshotCtx = snapshotCanvas.getContext('2d');
      if (snapshotCtx) {
        renderAudioScene(snapshotCtx, image, {
          width: snapshotW,
          height: snapshotH,
          plan,
          pageNum: page.pageNum,
          selectedSpeakerId,
          selectedTvId,
          selectedZoneId,
          alignReferenceId,
          zoneDraftPoints,
        });
        onSnapshotChange(snapshotCanvas.toDataURL('image/png'));
      }
    };

    image.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [alignReferenceId, imageUrl, onSnapshotChange, page.pageNum, plan, selectedSpeakerId, selectedTvId, selectedZoneId, zoneDraftPoints]);

  const getPoint = (event: MouseEvent<HTMLCanvasElement>): PlanPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
  };

  const findSpeakerAt = (point: PlanPoint): SpeakerDevice | undefined => {
    const px = point.x * canvasSize.width;
    const py = point.y * canvasSize.height;
    return plan.speakers.find((speaker) =>
      pointInSpeakerBox(px, py, speaker, plan, canvasSize.width, canvasSize.height),
    );
  };

  const findTvAt = (point: PlanPoint): AudioTvPoint | undefined => {
    const px = point.x * canvasSize.width;
    const py = point.y * canvasSize.height;
    return plan.audioTvPoints.find((tv) => pointInTvMarker(px, py, tv, canvasSize.width, canvasSize.height));
  };

  const findZoneVertexHit = (point: PlanPoint) => {
    if (zoneDraftPoints.length === 0) {
      return false;
    }

    const first = zoneDraftPoints[0];
    const dx = (first.x - point.x) * canvasSize.width;
    const dy = (first.y - point.y) * canvasSize.height;
    return Math.sqrt(dx * dx + dy * dy) <= 16;
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
        className={['block', drawingZone || markingTvs ? 'cursor-cell' : 'cursor-crosshair'].join(' ')}
        onMouseDown={(event) => {
          if (drawingZone || markingTvs) {
            return;
          }
          setContextMenu(null);
          const point = getPoint(event);
          const matchedSpeaker = findSpeakerAt(point);
          if (matchedSpeaker) {
            onSelectSpeaker(matchedSpeaker.id);
            onSelectTv(null);
            setDraggingSpeakerId(matchedSpeaker.id);
            return;
          }

          const matchedTv = findTvAt(point);
          if (matchedTv) {
            onSelectTv(matchedTv.id);
            onSelectSpeaker(null);
            setDraggingTvId(matchedTv.id);
            return;
          }

          onSelectSpeaker(null);
          onSelectTv(null);
        }}
        onMouseMove={(event) => {
          const point = getPoint(event);
          if (draggingSpeakerId !== null) {
            onSpeakerMove(draggingSpeakerId, point);
          }
          if (draggingTvId !== null) {
            onAudioTvMove(draggingTvId, point);
          }
        }}
        onMouseUp={() => {
          setDraggingSpeakerId(null);
          setDraggingTvId(null);
        }}
        onMouseLeave={() => {
          setDraggingSpeakerId(null);
          setDraggingTvId(null);
        }}
        onClick={(event) => {
          const point = getPoint(event);
          setContextMenu(null);
          if (drawingZone) {
            if (zoneDraftPoints.length >= 3 && findZoneVertexHit(point)) {
              onZoneDraftComplete();
              return;
            }

            onZoneDraftChange([...zoneDraftPoints, point]);
            return;
          }

          if (markingTvs && selectedSystemId) {
            onAudioTvAdd(selectedSystemId, point);
            return;
          }

          const matchedSpeaker = findSpeakerAt(point);
          if (matchedSpeaker) {
            onSelectSpeaker(matchedSpeaker.id);
            onSelectTv(null);
            return;
          }

          const matchedTv = findTvAt(point);
          if (matchedTv) {
            onSelectTv(matchedTv.id);
            onSelectSpeaker(null);
            return;
          }

          if (!matchedSpeaker) {
            const hitZone = plan.audioZones.find((zone) => pointInPolygonLike(point, zone.points));
            onSelectZone(hitZone?.id ?? null);
          }
          onSelectSpeaker(null);
          onSelectTv(null);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          const point = getPoint(event);
          const nativeEvent = event.nativeEvent;
          const matchedSpeaker = findSpeakerAt(point);
          if (matchedSpeaker) {
            onSelectSpeaker(matchedSpeaker.id);
            onSelectTv(null);
            setContextMenu({
              x: nativeEvent.offsetX + 18,
              y: nativeEvent.offsetY - 10,
              speakerId: matchedSpeaker.id,
              tvId: null,
            });
            return;
          }

          const matchedTv = findTvAt(point);
          if (matchedTv) {
            onSelectTv(matchedTv.id);
            onSelectSpeaker(null);
            setContextMenu({
              x: nativeEvent.offsetX + 18,
              y: nativeEvent.offsetY - 10,
              speakerId: null,
              tvId: matchedTv.id,
            });
            return;
          }

          setContextMenu(null);
        }}
      />
      {contextMenu ? (
        <div
          className="absolute z-20 min-w-[180px] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y, transform: 'translate(-10px, 6px)' }}
        >
          {contextMenu.speakerId !== null ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onSpeakerRotate(contextMenu.speakerId!);
                  setContextMenu(null);
                }}
                className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Rotacionar 90 graus
              </button>
              <button
                type="button"
                onClick={() => {
                  onSpeakerDelete(contextMenu.speakerId!);
                  setContextMenu(null);
                }}
                className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
              >
                Excluir caixa
              </button>
            </>
          ) : contextMenu.tvId ? (
            <button
              type="button"
              onClick={() => {
                onAudioTvDelete(contextMenu.tvId!);
                setContextMenu(null);
              }}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
            >
              Excluir TV
            </button>
          ) : null}
        </div>
      ) : null}
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

function renderAudioScene(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  params: {
    width: number;
    height: number;
    plan: EditablePlan;
    pageNum: number;
    selectedSpeakerId: number | null;
    selectedTvId: string | null;
    selectedZoneId: string | null;
    alignReferenceId: number | null;
    zoneDraftPoints: PlanPoint[];
  },
) {
  const { width, height, plan, pageNum, selectedSpeakerId, selectedTvId, selectedZoneId, alignReferenceId, zoneDraftPoints } =
    params;

  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  if (plan.perimeterPoints.length >= 3) {
    drawPerimeter(context, plan.perimeterPoints, width, height);
  }

  for (const zone of plan.audioZones) {
    drawAudioZone(context, zone, width, height, zone.id === selectedZoneId);
  }

  if (zoneDraftPoints.length > 0) {
    drawZoneDraft(context, zoneDraftPoints, width, height);
  }

  if (alignReferenceId !== null && selectedSpeakerId !== null && alignReferenceId !== selectedSpeakerId) {
    const reference = plan.speakers.find((speaker) => speaker.id === alignReferenceId);
    const selected = plan.speakers.find((speaker) => speaker.id === selectedSpeakerId);
    if (reference && selected) {
      drawAlignmentLine(context, reference, selected, width, height);
    }
  }

  for (const speaker of plan.speakers) {
    drawSpeaker(context, speaker, plan, width, height, speaker.id === selectedSpeakerId, speaker.id === alignReferenceId);
  }

  for (const tv of plan.audioTvPoints) {
    drawAudioTv(context, tv, width, height, tv.id === selectedTvId);
  }

  drawAudioHeader(context, pageNum, plan);
}

function drawPerimeter(context: CanvasRenderingContext2D, points: PlanPoint[], canvasWidth: number, canvasHeight: number) {
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
  context.strokeStyle = 'rgba(24, 95, 165, 0.4)';
  context.lineWidth = 2;
  context.stroke();
  context.restore();
}

function drawAlignmentLine(
  context: CanvasRenderingContext2D,
  reference: SpeakerDevice,
  target: SpeakerDevice,
  canvasWidth: number,
  canvasHeight: number,
) {
  context.save();
  context.setLineDash([6, 4]);
  context.strokeStyle = 'rgba(245, 166, 35, 0.75)';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(reference.x * canvasWidth, reference.y * canvasHeight);
  context.lineTo(target.x * canvasWidth, target.y * canvasHeight);
  context.stroke();
  context.restore();
}

function drawAudioZone(
  context: CanvasRenderingContext2D,
  zone: AudioZone,
  canvasWidth: number,
  canvasHeight: number,
  selected: boolean,
) {
  context.save();
  context.beginPath();
  zone.points.forEach((point, index) => {
    const x = point.x * canvasWidth;
    const y = point.y * canvasHeight;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  context.closePath();
  context.fillStyle = selected ? 'rgba(15, 110, 86, 0.12)' : 'rgba(24, 95, 165, 0.07)';
  context.strokeStyle = selected ? 'rgba(15, 110, 86, 0.9)' : 'rgba(24, 95, 165, 0.45)';
  context.lineWidth = selected ? 2.4 : 1.6;
  context.fill();
  context.stroke();

  zone.points.forEach((point, index) => {
    const x = point.x * canvasWidth;
    const y = point.y * canvasHeight;
    context.beginPath();
    context.fillStyle = index === 0 ? '#0F6E56' : '#185FA5';
    context.arc(x, y, 5, 0, Math.PI * 2);
    context.fill();
  });

  const anchor = zone.points[0];
  context.fillStyle = 'rgba(255,255,255,0.94)';
  roundRect(context, anchor.x * canvasWidth + 10, anchor.y * canvasHeight - 10, Math.max(82, zone.nome.length * 7 + 18), 22, 7);
  context.fill();
  context.fillStyle = '#10243A';
  context.font = '11px "Segoe UI"';
  context.textBaseline = 'middle';
  context.fillText(zone.nome, anchor.x * canvasWidth + 18, anchor.y * canvasHeight + 1);
  context.restore();
}

function drawZoneDraft(context: CanvasRenderingContext2D, points: PlanPoint[], canvasWidth: number, canvasHeight: number) {
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
  context.setLineDash([8, 5]);
  context.strokeStyle = 'rgba(15, 110, 86, 0.85)';
  context.lineWidth = 2;
  context.stroke();
  context.setLineDash([]);

  points.forEach((point, index) => {
    context.beginPath();
    context.fillStyle = index === 0 ? '#0F6E56' : '#185FA5';
    context.arc(point.x * canvasWidth, point.y * canvasHeight, index === 0 ? 7 : 5, 0, Math.PI * 2);
    context.fill();
  });
  context.restore();
}

function drawSpeaker(
  context: CanvasRenderingContext2D,
  speaker: SpeakerDevice,
  plan: EditablePlan,
  canvasWidth: number,
  canvasHeight: number,
  selected: boolean,
  isReference: boolean,
) {
  const centerX = speaker.x * canvasWidth;
  const centerY = speaker.y * canvasHeight;
  const { width, height } = getSpeakerBoxPx(plan, canvasWidth, canvasHeight);
  const radians = (speaker.rotationDeg * Math.PI) / 180;

  context.save();
  context.translate(centerX, centerY);
  context.rotate(radians);

  if (isReference) {
    context.fillStyle = 'rgba(245, 166, 35, 0.2)';
    context.strokeStyle = 'rgba(245, 166, 35, 0.9)';
    context.lineWidth = 2.6;
  } else if (speaker.type === 'subwoofer') {
    context.fillStyle = 'rgba(190, 24, 93, 0.18)';
    context.strokeStyle = 'rgba(190, 24, 93, 0.95)';
    context.lineWidth = 2.6;
  } else if (selected) {
    context.fillStyle = 'rgba(15, 110, 86, 0.2)';
    context.strokeStyle = '#0F6E56';
    context.lineWidth = 2.4;
  } else {
    context.fillStyle = 'rgba(24, 95, 165, 0.14)';
    context.strokeStyle = 'rgba(24, 95, 165, 0.7)';
    context.lineWidth = 1.8;
  }

  roundRect(context, -width / 2, -height / 2, width, height, 6);
  context.fill();
  context.stroke();

  context.strokeStyle = speaker.type === 'subwoofer' ? 'rgba(190, 24, 93, 0.95)' : selected ? '#0F6E56' : 'rgba(24, 95, 165, 0.9)';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(0, -height / 2);
  context.lineTo(0, -height / 2 + 8);
  context.stroke();

  context.fillStyle = '#ffffff';
  context.font = `bold ${Math.max(10, Math.min(width, height) * 0.38)}px "Segoe UI"`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(speaker.id), 0, 0);
  context.restore();

  context.save();
  context.font = '11px "Segoe UI"';
  const labelText = getSpeakerDisplayLabel(speaker);
  const labelWidth = Math.max(52, context.measureText(labelText).width + 14);
  context.fillStyle = 'rgba(255,255,255,0.92)';
  roundRect(context, centerX + width / 2 + 4, centerY - 11, labelWidth, 20, 6);
  context.fill();
  context.fillStyle = '#10243A';
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillText(labelText, centerX + width / 2 + 10, centerY);
  context.restore();
}

function drawAudioTv(
  context: CanvasRenderingContext2D,
  tv: AudioTvPoint,
  canvasWidth: number,
  canvasHeight: number,
  selected: boolean,
) {
  const centerX = tv.x * canvasWidth;
  const centerY = tv.y * canvasHeight;

  context.save();
  context.fillStyle = selected ? 'rgba(249, 115, 22, 0.2)' : 'rgba(249, 115, 22, 0.14)';
  context.strokeStyle = selected ? 'rgba(194, 65, 12, 0.95)' : 'rgba(249, 115, 22, 0.9)';
  context.lineWidth = selected ? 2.4 : 1.8;
  roundRect(context, centerX - 14, centerY - 10, 28, 20, 4);
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(centerX - 6, centerY + 12);
  context.lineTo(centerX + 6, centerY + 12);
  context.moveTo(centerX, centerY + 10);
  context.lineTo(centerX, centerY + 15);
  context.stroke();
  context.restore();
}

function pointInTvMarker(x: number, y: number, tv: AudioTvPoint, canvasWidth: number, canvasHeight: number) {
  const centerX = tv.x * canvasWidth;
  const centerY = tv.y * canvasHeight;
  return x >= centerX - 18 && x <= centerX + 18 && y >= centerY - 14 && y <= centerY + 18;
}

function drawAudioHeader(context: CanvasRenderingContext2D, pageNum: number, plan: EditablePlan) {
  const label = `Pagina ${pageNum} - ${plan.speakers.length} caixa(s) - ${
    plan.calibratedAreaM2 ? `${plan.calibratedAreaM2}m2 confirmados` : 'area pendente'
  }`;
  context.save();
  context.font = '11px "Segoe UI"';
  const width = Math.min(context.measureText(label).width + 20, 420);
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

function pointInPolygonLike(point: PlanPoint, polygon: PlanPoint[]) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

function regularizeZoneRectangle(points: PlanPoint[]): PlanPoint[] {
  if (points.length < 3) {
    return points;
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}
