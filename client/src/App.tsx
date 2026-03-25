import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { CameraPlannerPanel } from './components/CameraPlannerPanel';
import { ExtraBudgetModulesPanel } from './components/ExtraBudgetModulesPanel';
import { ModuleSelector } from './components/ModuleSelector';
import { PageSelector } from './components/PageSelector';
import { ProjectPreparationPanel } from './components/ProjectPreparationPanel';
import { ResultPanel } from './components/ResultPanel';
import { UploadZone } from './components/UploadZone';
import { CollapsedStep } from './components/ui/CollapsedStep';
import { NotificationStack } from './components/ui/NotificationStack';
import { SummaryRow } from './components/ui/SummaryRow';
import { useAnalysis } from './hooks/useAnalysis';
import { useModuleDraftSnapshots } from './hooks/useModuleDraftSnapshots';
import { useNotifications } from './hooks/useNotifications';
import { usePageSelection } from './hooks/usePageSelection';
import { usePlanCollection } from './hooks/usePlanCollection';
import { usePdfPages } from './hooks/usePdfPages';
import { useProjectPersistence } from './hooks/useProjectPersistence';
import { useProjectReset } from './hooks/useProjectReset';
import { useProjectWorkflow } from './hooks/useProjectWorkflow';
import { isWebAuthEnabled } from './lib/auth';
import { buildBudgetSummary } from './lib/budgetSummary';
import type { AudioSystem } from './types';
import { alignSpeakers, rotateSpeaker } from './lib/audio/speakerGeometry';
import { distributeSpeakersInZone } from './lib/audio/zoneDistribution';
import { getPolygonArea } from './lib/geometry/polygon';
import { listPriceCatalog } from './lib/priceCatalog';
import {
  getModuleBoardStatus,
  getNextAvailableModule,
  getSavedModuleBoard,
  normalizePlan,
} from './lib/planState';
import { buildProjectReportHtml } from './lib/reporting';
import type {
  AudioZone,
  CameraDevice,
  EditablePlan,
  EnvType,
  PersistedProjectState,
  PlanEditorMode,
  CommercialBudgetSection,
  PlanPoint,
  PriceCatalogItem,
  ProjectModule,
  ProjectStage,
  SpeakerDevice,
  WallMaterial,
  ExtraBudgetModule,
} from './types';

const AudioPlannerPanel = lazy(() =>
  import('./components/AudioPlannerPanel').then((module) => ({ default: module.AudioPlannerPanel })),
);
const BudgetPreviewPanel = lazy(() =>
  import('./components/BudgetPreviewPanel').then((module) => ({ default: module.BudgetPreviewPanel })),
);

export default function App() {
  const pdf = usePdfPages();
  const analysis = useAnalysis();
  const [envType, setEnvType] = useState<EnvType>('residencial');
  const [savedModules, setSavedModules] = useState<Partial<Record<ProjectModule, boolean>>>({});
  const [extraBudgetModules, setExtraBudgetModules] = useState<ExtraBudgetModule[]>([]);
  const [budgetPreviewOpen, setBudgetPreviewOpen] = useState(false);
  const [commercialBudgetSections, setCommercialBudgetSections] = useState<CommercialBudgetSection[]>([]);
  const [priceCatalog, setPriceCatalog] = useState<PriceCatalogItem[]>([]);
  const [priceCatalogLoading, setPriceCatalogLoading] = useState(false);
  const [priceCatalogError, setPriceCatalogError] = useState<string | null>(null);
  const { notifications, dismissNotification, pushNotification } = useNotifications();
  const { moduleDraftSnapshots, resetModuleDraftSnapshots, setModuleSnapshot, clearModuleSnapshot } =
    useModuleDraftSnapshots();
  const { plans, setPlans, updatePlan } = usePlanCollection(pdf.pages);
  const { selectedPages, setSelectedPages, togglePage, selectAll, clearSelection, resetSelection } = usePageSelection({
    onSelectionChange: () => setPlantsSetupSaved(false),
  });

  const {
    projectStage,
    plantsSetupSaved,
    moduleWorkspaceOpen,
    activeModulePageNum,
    selectedModule,
    setPlantsSetupSaved,
    setModuleWorkspaceOpen,
    setActiveModulePageNum,
    setSelectedModule,
    selectedPageObjects,
    preparedPages,
    moduleActivePages,
    activeModulePage,
    allSelectedPagesPrepared,
    allModulePagesResolved,
    visibleAnalysisItems,
    hasAnySavedModule,
    savedWifiBoards,
    moveToSelectStage,
    moveToPrepareStage,
    handleConfirmSelectedPages,
    handleSavePlantConfigurations,
    handleModuleSelect,
    hydrateWorkflow,
    resetWorkflowState,
  } = useProjectWorkflow({
    pages: pdf.pages,
    selectedPages,
    plans,
    analysisItems: analysis.items,
    savedModules,
  });

  const hydrateFromPersistedProject = useCallback(
    (persisted: PersistedProjectState) => {
      setSelectedPages(persisted.selectedPages);
      setEnvType(persisted.envType);
      hydrateWorkflow(persisted);
      setSavedModules(persisted.savedModules ?? {});
      setExtraBudgetModules(persisted.extraBudgetModules ?? []);
      setCommercialBudgetSections(persisted.commercialBudgetSections ?? []);
      setPlans((current) => {
        const next: Record<number, EditablePlan> = {};
        for (const page of pdf.pages) {
          const saved = persisted.plans[page.pageNum];
          next[page.pageNum] = normalizePlan(page, saved ?? current[page.pageNum]);
        }
        return next;
      });
    },
    [hydrateWorkflow, pdf.pages],
  );

  const { clearPersistedProject, saveProjectNow } = useProjectPersistence({
    fileName: pdf.fileName,
    fileSize: pdf.fileSize,
    fileFingerprint: pdf.fileFingerprint,
    pages: pdf.pages,
    enableAutoHydrate: false,
    autoSaveEnabled: !isWebAuthEnabled(),
    projectStage,
    plantsSetupSaved,
    selectedPages,
    envType,
    selectedModule,
    savedModules,
    plans,
    extraBudgetModules,
    commercialBudgetSections,
    onHydrate: hydrateFromPersistedProject,
  });

  const { resetAll, prepareForNewFile } = useProjectReset({
    clearPersistedProject,
    resetPdf: pdf.reset,
    resetAnalysis: analysis.reset,
    resetSelection,
    setEnvType,
    setSavedModules,
    resetWorkflowState,
    resetModuleDraftSnapshots,
    setPlans,
  });

  useEffect(() => {
    if (!isWebAuthEnabled()) {
      setPriceCatalog([]);
      setPriceCatalogError(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      setPriceCatalogLoading(true);
      setPriceCatalogError(null);
      try {
        const items = await listPriceCatalog();
        if (!cancelled) {
          setPriceCatalog(items);
        }
      } catch (error) {
        if (!cancelled) {
          setPriceCatalogError(error instanceof Error ? error.message : 'Falha ao carregar catalogo.');
        }
      } finally {
        if (!cancelled) {
          setPriceCatalogLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleFileSelect = async (file: File) => {
    prepareForNewFile();
    await pdf.loadPdf(file);
  };

  const handleFinalizePlantConfigurations = () => {
    setSavedModules({});
    handleSavePlantConfigurations();
  };

  const handleFloorLabelChange = (pageNum: number, floorLabel: string) => {
    setPlantsSetupSaved(false);
    updatePlan(pageNum, (plan) => ({
      ...plan,
      floorLabel,
    }));
  };

  const handleModuleStateChange = (
    pageNum: number,
    module: ProjectModule,
    status: 'idle' | 'editing' | 'saved' | 'skipped',
  ) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      moduleBoards: {
        ...plan.moduleBoards,
        [module]: {
          ...plan.moduleBoards[module],
          status,
          board: status === 'skipped' ? undefined : plan.moduleBoards[module].board,
        },
      },
    }));
  };

  const handleSaveCurrentModule = () => {
    if (!allModulePagesResolved) {
      return;
    }

    setSavedModules((current) => ({
      ...current,
      [selectedModule]: true,
    }));
    setModuleWorkspaceOpen(false);
    setActiveModulePageNum(null);

    const nextModule = getNextAvailableModule(selectedModule, savedModules);
    if (nextModule) {
      setSelectedModule(nextModule);
    }
  };

  const handleBoardSave = (
    pageNum: number,
    module: ProjectModule,
    payload: { croquiDataUrl: string; productCount: number; productLabel: string; notes?: string },
  ) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      moduleBoards: {
        ...plan.moduleBoards,
        [module]: {
          status: 'saved',
          board: {
            savedAt: new Date().toISOString(),
            croquiDataUrl: payload.croquiDataUrl,
            productCount: payload.productCount,
            productLabel: payload.productLabel,
            notes: payload.notes,
          },
        },
      },
    }));
  };

  const handleModuleSnapshotChange = useCallback((module: ProjectModule, pageNum: number, dataUrl: string) => {
    setModuleSnapshot(module, pageNum, dataUrl);
  }, [setModuleSnapshot]);

  const handleCctvSnapshotChange = useCallback(
    (pageNum: number, dataUrl: string) => handleModuleSnapshotChange('cctv', pageNum, dataUrl),
    [handleModuleSnapshotChange],
  );

  const handleAudioSnapshotChange = useCallback(
    (pageNum: number, dataUrl: string) => handleModuleSnapshotChange('audio', pageNum, dataUrl),
    [handleModuleSnapshotChange],
  );

  const handleStartModuleWork = async (pageNum: number) => {
    handleModuleStateChange(pageNum, selectedModule, 'editing');
    setActiveModulePageNum(pageNum);

    if (selectedModule !== 'wifi') {
      return;
    }

    const page = preparedPages.find((item) => item.pageNum === pageNum);
    if (!page) {
      return;
    }

    const existingItem = analysis.items.find((item) => item.pageNum === pageNum && item.status === 'success');
    if (existingItem) {
      return;
    }

    await analysis.analyzePages([page], { envType });
  };

  const handleSkipModulePage = (pageNum: number) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      moduleBoards: {
        ...plan.moduleBoards,
        [selectedModule]: {
          status: 'skipped',
        },
      },
    }));
    clearModuleSnapshot(selectedModule, pageNum);
    if (activeModulePageNum === pageNum) {
      setActiveModulePageNum(null);
    }
  };

  const handleSaveModulePage = (pageNum: number) => {
    const plan = plans[pageNum];
    if (!plan) {
      return;
    }

    const snapshot = moduleDraftSnapshots[selectedModule][pageNum] ?? getSavedModuleBoard(plan, selectedModule)?.croquiDataUrl ?? null;
    if (!snapshot) {
      pushNotification('error', 'Abra esta prancha em "Trabalhar" antes de salvar, para gerar o croqui atual.');
      return;
    }

    if (selectedModule === 'wifi' && plan.accessPoints.length === 0) {
      pushNotification('error', 'Adicione ou gere pelo menos um U6+ antes de salvar esta prancha.');
      return;
    }

    if (selectedModule === 'cctv' && plan.cameras.length === 0) {
      pushNotification('error', 'Adicione pelo menos uma camera antes de salvar esta prancha.');
      return;
    }

    if (selectedModule === 'audio' && plan.speakers.length === 0) {
      pushNotification('error', 'Adicione pelo menos uma caixa antes de salvar esta prancha.');
      return;
    }

    if (selectedModule === 'audio') {
      const systemsMissingTvs = plan.audioSystems.filter(
        (system) => system.hasAudioSource && !plan.audioTvPoints.some((tv) => tv.systemId === system.id),
      );

      if (systemsMissingTvs.length > 0) {
        pushNotification('error', 'Marque as TVs dos sistemas com extracao de audio antes de salvar esta prancha.');
        return;
      }
    }

    const productCount =
      selectedModule === 'wifi'
        ? plan.accessPoints.length
        : selectedModule === 'cctv'
          ? plan.cameras.length
          : selectedModule === 'audio'
            ? plan.speakers.length
          : 0;
    const productLabel =
      selectedModule === 'wifi'
        ? productCount === 1
          ? 'AP'
          : 'APs'
        : selectedModule === 'cctv'
          ? productCount === 1
            ? 'camera'
            : 'cameras'
          : selectedModule === 'audio'
            ? productCount === 1
              ? 'caixa'
              : 'caixas'
          : 'itens';

    handleBoardSave(pageNum, selectedModule, {
      croquiDataUrl: snapshot,
      productCount,
      productLabel,
      notes:
        selectedModule === 'wifi'
          ? `Cobertura dinamica: ${plan.dynamicCoveragePercent ?? 0}% | Area confirmada: ${plan.calibratedAreaM2 ?? '-'} m2`
          : selectedModule === 'cctv'
            ? `Camera(s) posicionadas sobre base confirmada de ${plan.calibratedAreaM2 ?? '-'} m2`
            : selectedModule === 'audio'
              ? `${plan.speakers.length} caixa(s) | ${plan.audioZones.length} zona(s) | ${plan.audioSystems.length} sistema(s) | ${plan.audioTvPoints.length} TV(s)`
            : undefined,
    });

    if (activeModulePageNum === pageNum) {
      setActiveModulePageNum(null);
    }
  };

  const handleExportProjectPdf = async () => {
    const savedBoards = (['wifi', 'cctv', 'audio'] as const).flatMap((module) =>
      selectedPageObjects
        .map((page) => ({
          page,
          plan: plans[page.pageNum],
        }))
        .map(({ page, plan }) => {
          const board = getSavedModuleBoard(plan, module);
          return board
            ? {
                module,
                floorLabel: plan.floorLabel,
                pageNum: page.pageNum,
                board,
                plan,
              }
            : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    );

    if (savedBoards.length === 0) {
      pushNotification('info', 'Ainda nao existem pranchas salvas para exportar.');
      return;
    }

    const html = buildProjectReportHtml({
      preparedPlantsCount: preparedPages.length,
      savedBoards,
      commercialBudgetSections,
    });

    if (window.desktopApi?.exportProjectPdf) {
      try {
        const result = await window.desktopApi.exportProjectPdf({
          html,
          fileName: 'Relatorio do Projeto.pdf',
        });

        if (!result.canceled) {
          pushNotification('success', `PDF salvo com sucesso em:\n${result.filePath ?? 'local escolhido'}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido ao exportar o PDF.';
        pushNotification('error', `Falha ao exportar PDF.\n${message}`);
      }
      return;
    }

    const reportWindow = window.open('', '_blank', 'width=1280,height=900');
    if (!reportWindow) {
      pushNotification('error', 'Nao foi possivel abrir a janela de exportacao.');
      return;
    }

    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
  };

  const derivedBudgetSummarySections = useMemo(
    () =>
      buildBudgetSummary({
        plans,
        selectedPages,
        extraBudgetModules,
        priceCatalog,
      }),
    [extraBudgetModules, plans, priceCatalog, selectedPages],
  );

  useEffect(() => {
    if (commercialBudgetSections.length === 0 && derivedBudgetSummarySections.length > 0) {
      setCommercialBudgetSections(derivedBudgetSummarySections);
    }
  }, [commercialBudgetSections.length, derivedBudgetSummarySections]);

  const handleResetBudgetFromTechnicalBase = useCallback(() => {
    setCommercialBudgetSections(derivedBudgetSummarySections);
    pushNotification('info', 'Orcamento comercial atualizado a partir da base tecnica atual.');
  }, [derivedBudgetSummarySections, pushNotification]);

  const handleBudgetQuantityChange = useCallback((sectionId: string, lineIndex: number, quantity: number) => {
    setCommercialBudgetSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              lines: section.lines.map((line, index) =>
                index === lineIndex
                  ? {
                      ...line,
                      quantity: Number.isFinite(quantity) && quantity >= 0 ? quantity : 0,
                      totalPrice:
                        typeof line.unitPrice === 'number'
                          ? Number((((Number.isFinite(quantity) && quantity >= 0 ? quantity : 0) * line.unitPrice)).toFixed(2))
                          : null,
                    }
                  : line,
              ),
            }
          : section,
      ),
    );
  }, []);

  const handleBudgetUnitPriceChange = useCallback((sectionId: string, lineIndex: number, unitPrice: number) => {
    setCommercialBudgetSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              lines: section.lines.map((line, index) =>
                index === lineIndex
                  ? {
                      ...line,
                      unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
                      totalPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? Number((line.quantity * unitPrice).toFixed(2)) : null,
                      pendingPrice: false,
                    }
                  : line,
              ),
            }
          : section,
      ),
    );
  }, []);

  const handleSaveProjectToLibrary = async () => {
    try {
      await saveProjectNow();
      window.dispatchEvent(new Event('codex-projects-changed'));
      pushNotification('success', 'Projeto salvo na biblioteca web com sucesso.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido ao salvar projeto.';
      pushNotification('error', `Falha ao salvar na biblioteca.\n${message}`);
    }
  };

  const handleCreateExtraBudgetModule = () => {
    setExtraBudgetModules((current) => [
      ...current,
      {
        id: `extra-module-${Date.now()}`,
        name: `Novo modulo ${current.length + 1}`,
        items: [],
      },
    ]);
  };

  const handleDeleteExtraBudgetModule = (moduleId: string) => {
    setExtraBudgetModules((current) => current.filter((module) => module.id !== moduleId));
  };

  const handleRenameExtraBudgetModule = (moduleId: string, name: string) => {
    setExtraBudgetModules((current) =>
      current.map((module) => (module.id === moduleId ? { ...module, name } : module)),
    );
  };

  const handleAddExtraBudgetItem = (moduleId: string) => {
    setExtraBudgetModules((current) =>
      current.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              items: [
                ...module.items,
                {
                  id: `extra-item-${Date.now()}-${module.items.length + 1}`,
                  catalogProductId: null,
                  sku: '',
                  productName: '',
                  quantity: 1,
                  unit: 'un',
                  salePrice: null,
                },
              ],
            }
          : module,
      ),
    );
  };

  const handleDeleteExtraBudgetItem = (moduleId: string, itemId: string) => {
    setExtraBudgetModules((current) =>
      current.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              items: module.items.filter((item) => item.id !== itemId),
            }
          : module,
      ),
    );
  };

  const handleSelectExtraBudgetProduct = (moduleId: string, itemId: string, productId: string) => {
    const product = priceCatalog.find((entry) => entry.id === productId);
    setExtraBudgetModules((current) =>
      current.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              items: module.items.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      catalogProductId: product?.id ?? null,
                      sku: product?.sku ?? '',
                      productName: product?.productName ?? '',
                      unit: product?.unit ?? 'un',
                      salePrice: product?.salePrice ?? null,
                    }
                  : item,
              ),
            }
          : module,
      ),
    );
  };

  const handleChangeExtraBudgetQuantity = (moduleId: string, itemId: string, quantity: number) => {
    setExtraBudgetModules((current) =>
      current.map((module) =>
        module.id === moduleId
          ? {
              ...module,
              items: module.items.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
                    }
                  : item,
              ),
            }
          : module,
      ),
    );
  };

  const handleModeChange = (pageNum: number, mode: PlanEditorMode) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      mode,
      pendingLine: null,
    }));
  };

  const handlePendingLineChange = (pageNum: number, line: [PlanPoint, PlanPoint] | null) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      pendingLine: line,
    }));
  };

  const handleCalibrationApply = (pageNum: number, lengthMeters: number) => {
    updatePlan(pageNum, (plan) => {
      if (!plan.pendingLine) {
        return plan;
      }

      const deltaX = (plan.pendingLine[1].x - plan.pendingLine[0].x) * plan.pixelWidth;
      const deltaY = (plan.pendingLine[1].y - plan.pendingLine[0].y) * plan.pixelHeight;
      const pixelDistance = Math.hypot(deltaX, deltaY);
      if (pixelDistance <= 0) {
        return plan;
      }

      return {
        ...plan,
        metersPerPixel: lengthMeters / pixelDistance,
        calibrationLine: {
          start: plan.pendingLine[0],
          end: plan.pendingLine[1],
          lengthMeters,
        },
        pendingLine: null,
        mode: 'view',
      };
    });
  };

  const handleWallAdd = (
    pageNum: number,
    wall: { start: PlanPoint; end: PlanPoint; material: WallMaterial },
  ) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      walls: [
        ...plan.walls,
        {
          id: `wall-${pageNum}-${plan.walls.length + 1}`,
          start: wall.start,
          end: wall.end,
          material: wall.material,
        },
      ],
    }));
  };

  const handleWallDelete = (pageNum: number, wallId: string) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      walls: plan.walls.filter((wall) => wall.id !== wallId),
    }));
  };

  const handleWallMaterialChange = (pageNum: number, wallId: string, material: WallMaterial) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      walls: plan.walls.map((wall) => (wall.id === wallId ? { ...wall, material } : wall)),
    }));
  };

  const handleAccessPointMove = (pageNum: number, apId: number, point: PlanPoint) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      accessPoints: plan.accessPoints.map((ap) => (ap.id === apId ? { ...ap, x: point.x, y: point.y } : ap)),
    }));
  };

  const handleAccessPointAdd = (pageNum: number) => {
    updatePlan(pageNum, (plan) => {
      const nextId =
        plan.accessPoints.length > 0 ? Math.max(...plan.accessPoints.map((ap) => ap.id)) + 1 : 1;
      const fallbackY = 0.5 + (((nextId - 1) % 4) - 1.5) * 0.06;

      return {
        ...plan,
        accessPoints: [
          ...plan.accessPoints,
          {
            id: nextId,
            ambiente: `Novo ponto ${nextId}`,
            posicao_descrita: 'Ponto ajustavel manualmente no teto',
            x: 0.5,
            y: Math.min(Math.max(fallbackY, 0.12), 0.88),
            raio_cobertura_normalizado: 0.17,
            justificativa: 'AP adicional inserido manualmente para ajuste fino de cobertura.',
          },
        ],
      };
    });
  };

  const handleAccessPointDelete = (pageNum: number, apId: number) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      accessPoints: plan.accessPoints
        .filter((ap) => ap.id !== apId)
        .map((ap, index) => ({
          ...ap,
          id: index + 1,
        })),
    }));
  };

  const handleCameraAdd = (pageNum: number) => {
    updatePlan(pageNum, (plan) => {
      const nextId = plan.cameras.length > 0 ? Math.max(...plan.cameras.map((camera) => camera.id)) + 1 : 1;
      const fallbackY = 0.22 + ((nextId - 1) % 4) * 0.08;

      const nextCamera: CameraDevice = {
        id: nextId,
        nome: `Camera ${nextId}`,
        profile: '1220d',
        x: 0.18,
        y: Math.min(Math.max(fallbackY, 0.12), 0.88),
        directionDeg: 20,
        fovDeg: 92,
        rangeMeters: 8,
      };

      return {
        ...plan,
        cameras: [...plan.cameras, nextCamera],
      };
    });
  };

  const handleCameraMove = (pageNum: number, cameraId: number, point: PlanPoint) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      cameras: plan.cameras.map((camera) => (camera.id === cameraId ? { ...camera, x: point.x, y: point.y } : camera)),
    }));
  };

  const handleCameraUpdate = (pageNum: number, cameraId: number, patch: Partial<CameraDevice>) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      cameras: plan.cameras.map((camera) => (camera.id === cameraId ? { ...camera, ...patch } : camera)),
    }));
  };

  const handleCameraDelete = (pageNum: number, cameraId: number) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      cameras: plan.cameras
        .filter((camera) => camera.id !== cameraId)
        .map((camera, index) => ({
          ...camera,
          id: index + 1,
          nome: `Camera ${index + 1}`,
        })),
    }));
  };

  const handleSpeakerAdd = (pageNum: number) => {
    updatePlan(pageNum, (plan) => {
      const nextId = plan.speakers.length > 0 ? Math.max(...plan.speakers.map((speaker) => speaker.id)) + 1 : 1;
      const fallbackY = 0.25 + (((nextId - 1) % 5) - 1) * 0.1;

      return {
        ...plan,
        speakers: [
          ...plan.speakers,
          {
            id: nextId,
            nome: `Caixa ${nextId}`,
            type: 'ceiling_national',
            sizeInches: 6,
            x: 0.5,
            y: Math.min(Math.max(fallbackY, 0.14), 0.88),
            rotationDeg: 0,
          },
        ],
      };
    });
  };

  const handleSpeakerMove = (pageNum: number, speakerId: number, point: PlanPoint) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      speakers: plan.speakers.map((speaker) =>
        speaker.id === speakerId ? { ...speaker, x: point.x, y: point.y } : speaker,
      ),
    }));
  };

  const handleSpeakerUpdate = (pageNum: number, speakerId: number, patch: Partial<SpeakerDevice>) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      speakers: plan.speakers.map((speaker) => (speaker.id === speakerId ? { ...speaker, ...patch } : speaker)),
    }));
  };

  const handleSpeakerRotate = (pageNum: number, speakerId: number) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      speakers: plan.speakers.map((speaker) => (speaker.id === speakerId ? rotateSpeaker(speaker) : speaker)),
    }));
  };

  const handleSpeakerDelete = (pageNum: number, speakerId: number) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      speakers: plan.speakers
        .filter((speaker) => speaker.id !== speakerId)
        .map((speaker, index) => ({
          ...speaker,
          id: index + 1,
          nome: `Caixa ${index + 1}`,
        })),
    }));
  };

  const handleAudioTvAdd = (pageNum: number, systemId: string, point: PlanPoint) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      audioTvPoints: [
        ...plan.audioTvPoints,
        {
          id: `tv-${pageNum}-${Date.now()}-${Math.round(point.x * 1000)}-${Math.round(point.y * 1000)}`,
          systemId,
          x: point.x,
          y: point.y,
        },
      ],
    }));
  };

  const handleAudioTvMove = (pageNum: number, tvId: string, point: PlanPoint) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      audioTvPoints: plan.audioTvPoints.map((tv) => (tv.id === tvId ? { ...tv, x: point.x, y: point.y } : tv)),
    }));
  };

  const handleAudioTvDelete = (pageNum: number, tvId: string) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      audioTvPoints: plan.audioTvPoints.filter((tv) => tv.id !== tvId),
    }));
  };

  const handleSpeakerAlign = (
    pageNum: number,
    referenceId: number,
    targetId: number,
    axis: 'horizontal' | 'vertical',
  ) => {
    updatePlan(pageNum, (plan) => {
      const reference = plan.speakers.find((speaker) => speaker.id === referenceId);
      if (!reference) {
        return plan;
      }

      return {
        ...plan,
        speakers: plan.speakers.map((speaker) =>
          speaker.id === targetId ? alignSpeakers(reference, speaker, axis) : speaker,
        ),
      };
    });
  };

  const handleAudioSystemCreate = (pageNum: number, system: AudioSystem) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      audioSystems: [...plan.audioSystems, system],
    }));
  };

  const handleAudioSystemPatch = (pageNum: number, systemId: string, patch: Partial<AudioSystem>) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      audioSystems: plan.audioSystems.map((system) => (system.id === systemId ? { ...system, ...patch } : system)),
    }));
  };

  const handleAudioSystemDelete = (pageNum: number, systemId: string) => {
    updatePlan(pageNum, (plan) => {
      const removedZoneIds = new Set(plan.audioZones.filter((zone) => zone.systemId === systemId).map((zone) => zone.id));

      return {
        ...plan,
        audioSystems: plan.audioSystems.filter((system) => system.id !== systemId),
        audioZones: plan.audioZones.filter((zone) => zone.systemId !== systemId),
        audioTvPoints: plan.audioTvPoints.filter((tv) => tv.systemId !== systemId),
        speakers: plan.speakers
          .filter((speaker) => !speaker.zoneId || !removedZoneIds.has(speaker.zoneId))
          .map((speaker, index) => ({
            ...speaker,
            id: index + 1,
            nome: speaker.type === 'subwoofer' ? `Subwoofer ${index + 1}` : `Caixa ${index + 1}`,
          })),
      };
    });
  };

  const handleAudioZoneCreate = (pageNum: number, zone: AudioZone) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      audioZones: [...plan.audioZones, zone],
    }));
  };

  const handleAudioZonePatch = (pageNum: number, zoneId: string, patch: Partial<AudioZone>) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      audioZones: plan.audioZones.map((zone) => (zone.id === zoneId ? { ...zone, ...patch } : zone)),
      speakers: plan.speakers.map((speaker) => {
        if (speaker.zoneId !== zoneId || speaker.type === 'subwoofer') {
          return speaker;
        }

        return {
          ...speaker,
          type: patch.speakerType ?? speaker.type,
          sizeInches: patch.speakerSizeInches ?? speaker.sizeInches,
        };
      }),
    }));
  };

  const handleAudioZoneDelete = (pageNum: number, zoneId: string) => {
    updatePlan(pageNum, (plan) => ({
      ...plan,
      audioZones: plan.audioZones.filter((zone) => zone.id !== zoneId),
      speakers: plan.speakers
        .filter((speaker) => speaker.zoneId !== zoneId)
        .map((speaker, index) => ({
          ...speaker,
          id: index + 1,
          nome: speaker.type === 'subwoofer' ? `Subwoofer ${index + 1}` : `Caixa ${index + 1}`,
        })),
    }));
  };

  const handleDistributeAudioZone = (pageNum: number, zoneId: string) => {
    updatePlan(pageNum, (plan) => {
      const zone = plan.audioZones.find((item) => item.id === zoneId);
      if (!zone) {
        return plan;
      }

      const remainingSpeakers = plan.speakers.filter((speaker) => speaker.zoneId !== zoneId);
      const nextIdStart = remainingSpeakers.length > 0 ? Math.max(...remainingSpeakers.map((speaker) => speaker.id)) + 1 : 1;
      const generatedSpeakers = distributeSpeakersInZone(zone, nextIdStart);
      const ordered = [...remainingSpeakers, ...generatedSpeakers].map((speaker, index) => ({
        ...speaker,
        id: index + 1,
        nome: speaker.type === 'subwoofer' ? `Subwoofer ${index + 1}` : `Caixa ${index + 1}`,
      }));

      return {
        ...plan,
        speakers: ordered,
      };
    });
  };

  const handleMetricsChange = (pageNum: number, metrics: { areaM2: number | null; coveragePercent: number | null }) => {
    updatePlan(pageNum, (plan) => {
      const nextArea = plan.calibratedAreaM2 ?? metrics.areaM2;
      if (plan.detectedAreaM2 === nextArea && plan.dynamicCoveragePercent === metrics.coveragePercent) {
        return plan;
      }

      return {
        ...plan,
        detectedAreaM2: nextArea,
        dynamicCoveragePercent: metrics.coveragePercent,
      };
    });
  };

  const handlePerimeterChange = (pageNum: number, points: PlanPoint[]) => {
    setPlantsSetupSaved(false);
    updatePlan(pageNum, (plan) => ({
      ...plan,
      baseReady: false,
      perimeterPoints:
        plan.perimeterPoints.length === points.length &&
        plan.perimeterPoints.every((point, index) => point.x === points[index]?.x && point.y === points[index]?.y)
          ? plan.perimeterPoints
          : points,
    }));
  };

  const handleAreaCalibrationApply = (pageNum: number, areaM2: number) => {
    setPlantsSetupSaved(false);
    updatePlan(pageNum, (plan) => {
      if (plan.perimeterPoints.length < 3 || plan.pixelWidth <= 0 || plan.pixelHeight <= 0 || areaM2 <= 0) {
        return plan;
      }

      const normalizedArea = Math.abs(getPolygonArea(plan.perimeterPoints));
      if (normalizedArea <= 0) {
        return plan;
      }

      const sourcePixelArea = normalizedArea * plan.pixelWidth * plan.pixelHeight;
      const metersPerPixel = Math.sqrt(areaM2 / sourcePixelArea);

      return {
        ...plan,
        calibratedAreaM2: areaM2,
        detectedAreaM2: Math.round(areaM2),
        metersPerPixel,
        baseReady: true,
        mode: 'view',
      };
    });
  };

  const handleAnalyze = async () => {
    if (moduleActivePages.length === 0) {
      return;
    }

    await analysis.analyzePages(moduleActivePages, { envType });
  };

  useEffect(() => {
    analysis.items.forEach((item) => {
      const result = item.result;
      if (item.status !== 'success' || !result) {
        return;
      }

      setPlans((current) => {
        const existing = current[item.pageNum];
        if (!existing || existing.accessPoints.length > 0) {
          return current;
        }
        return {
          ...current,
          [item.pageNum]: {
            ...existing,
            accessPoints: result.access_points,
          },
        };
      });
    });
  }, [analysis.items]);

  return (
    <div className="min-h-screen bg-shell px-6 py-8 text-slateink lg:px-10">
      <NotificationStack notifications={notifications} onDismiss={dismissNotification} />
      <Suspense fallback={null}>
        <BudgetPreviewPanel
          open={budgetPreviewOpen}
          sections={commercialBudgetSections}
          onClose={() => setBudgetPreviewOpen(false)}
          onQuantityChange={handleBudgetQuantityChange}
          onUnitPriceChange={handleBudgetUnitPriceChange}
          onResetFromTechnicalBase={handleResetBudgetFromTechnicalBase}
        />
      </Suspense>
      <div className="mx-auto max-w-[1680px]">
        <header className="mb-8 overflow-hidden rounded-[32px] border border-white/60 bg-slateink px-8 py-10 text-white shadow-soft">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sand">WiFi Planner - UniFi U6+</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight">
              Base calibrada do projeto para Wi-Fi, sonorizacao e cameras
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-200">
              Primeiro voce prepara as plantas. Depois aplica cada modulo tecnico no tempo certo, podendo pular
              pavimentos onde aquela disciplina nao existe.
            </p>
          </div>
        </header>

        <main className="space-y-8">
          {pdf.pages.length === 0 ? (
            <UploadZone
              fileName={pdf.fileName}
              fileSize={pdf.fileSize}
              loading={pdf.loading}
              error={pdf.error}
              onFileSelect={handleFileSelect}
              onReset={resetAll}
            />
          ) : (
            <CollapsedStep
              step="Etapa 1"
              title="Upload do PDF"
              summary={`${pdf.fileName || 'PDF carregado'} com ${pdf.pages.length} pagina(s) renderizada(s)`}
              actionLabel="Trocar PDF"
              onAction={resetAll}
            />
          )}

          {pdf.pages.length > 0 ? (
            <section className="space-y-6">
              {projectStage === 'select' ? (
                <PageSelector
                  pages={pdf.pages}
                  selectedPages={selectedPages}
                  onTogglePage={togglePage}
                  onSelectAll={() => selectAll(pdf.pages.map((page) => page.pageNum))}
                  onClearSelection={clearSelection}
                />
              ) : (
                <CollapsedStep
                  step="Etapa 2"
                  title="Selecao manual de plantas"
                  summary={`${selectedPages.length} planta(s) escolhida(s) para o projeto`}
                  actionLabel="Editar selecao"
                  onAction={moveToSelectStage}
                />
              )}

              {projectStage === 'select' ? (
                <section className="rounded-[24px] border border-slate-200 bg-white p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-tide">Proximo passo</p>
                  <h3 className="mt-2 text-xl font-semibold text-slateink">Confirmar plantas e preparar pavimentos</h3>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                    Depois da selecao, voce vai renomear cada planta, validar a area rachurada e informar a metragem
                    real antes de escolher qualquer modulo tecnico.
                  </p>
                  <button
                    type="button"
                    disabled={selectedPages.length === 0}
                    onClick={handleConfirmSelectedPages}
                    className="mt-5 rounded-2xl bg-tide px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#124f8f] disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    Confirmar plantas selecionadas
                  </button>
                </section>
              ) : null}

              {projectStage === 'prepare' && selectedPageObjects.length > 0 ? (
                <ProjectPreparationPanel
                  pages={selectedPageObjects}
                  plans={plans}
                  onFloorLabelChange={handleFloorLabelChange}
                  onPerimeterChange={handlePerimeterChange}
                  onAreaCalibrationApply={handleAreaCalibrationApply}
                  onSavePreparation={handleFinalizePlantConfigurations}
                />
              ) : null}

              {projectStage === 'module' && selectedPageObjects.length > 0 ? (
                <CollapsedStep
                  step="Etapa 3"
                  title="Preparar plantas"
                  summary={`${preparedPages.length}/${selectedPageObjects.length} planta(s) preparadas e salvas`}
                  actionLabel="Reabrir preparacao"
                  onAction={moveToPrepareStage}
                />
              ) : null}

              {projectStage === 'module' && plantsSetupSaved && allSelectedPagesPrepared ? (
                <section className="space-y-6">
                  <ModuleSelector value={selectedModule} savedModules={savedModules} onChange={handleModuleSelect} />

                  {moduleWorkspaceOpen ? (
                  <section className="rounded-[24px] border border-slate-200 bg-white p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-tide">Execucao do modulo</p>
                        <h3 className="mt-2 text-xl font-semibold text-slateink">
                          {selectedModule === 'wifi'
                            ? 'Planejamento Wi-Fi'
                            : selectedModule === 'cctv'
                              ? 'Planejamento de Cameras'
                              : 'Planejamento de Sonorizacao'}
                        </h3>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                          Em cada pavimento voce pode trabalhar normalmente ou marcar que esse modulo nao se aplica.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={!allModulePagesResolved}
                          onClick={handleSaveCurrentModule}
                          className="rounded-full bg-tide px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#124f8f] disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          Salvar modulo
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {preparedPages.map((page) => {
                        const plan = plans[page.pageNum];
                        const moduleStatus = getModuleBoardStatus(plan, selectedModule);
                        return (
                          <div key={page.pageNum} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slateink">{plan.floorLabel}</p>
                                <p className="mt-1 text-xs text-slate-500">Pagina {page.pageNum}</p>
                              </div>
                              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                                {moduleStatus === 'saved'
                                  ? 'Concluido'
                                  : moduleStatus === 'skipped'
                                    ? 'Pulado'
                                    : moduleStatus === 'editing'
                                      ? 'Em edicao'
                                      : 'Ativo'}
                              </span>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void handleStartModuleWork(page.pageNum)}
                                className={[
                                  'rounded-full px-3 py-2 text-xs font-semibold transition',
                                  activeModulePageNum === page.pageNum
                                    ? 'bg-tide text-white'
                                    : 'border border-slate-300 text-slate-700 hover:border-tide hover:text-tide',
                                ].join(' ')}
                              >
                                Trabalhar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveModulePage(page.pageNum)}
                                className={[
                                  'rounded-full px-3 py-2 text-xs font-semibold transition',
                                  moduleStatus === 'saved'
                                    ? 'bg-pine text-white'
                                    : 'border border-slate-300 text-slate-700 hover:border-pine hover:text-pine',
                                ].join(' ')}
                              >
                                Salvar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSkipModulePage(page.pageNum)}
                                className={[
                                  'rounded-full px-3 py-2 text-xs font-semibold transition',
                                  moduleStatus === 'skipped'
                                    ? 'bg-amber-500 text-white'
                                    : 'border border-slate-300 text-slate-700 hover:border-amber-400 hover:text-amber-700',
                                ].join(' ')}
                              >
                                Pular neste pavimento
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                  ) : (
                    <section className="rounded-[24px] border border-slate-200 bg-white p-6">
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-tide">Escolha do modulo</p>
                      <h3 className="mt-2 text-xl font-semibold text-slateink">Selecione o proximo trabalho</h3>
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                        As plantas ja foram preparadas. Agora escolha um modulo ainda nao concluido para abrir a area de trabalho.
                      </p>
                    </section>
                  )}

                  {moduleWorkspaceOpen && selectedModule === 'wifi' ? null : moduleWorkspaceOpen && selectedModule === 'cctv' ? (
                    <section className="rounded-[24px] border border-slate-200 bg-white p-6">
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-tide">Modulo ativo</p>
                      <h3 className="mt-2 text-xl font-semibold text-slateink">Planejamento de Cameras</h3>
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                        Este modulo reutiliza a base calibrada do pavimento para posicionar cameras, ajustar angulo de
                        visao e estimar a cobertura visual inicial de cada ponto.
                      </p>
                    </section>
                  ) : moduleWorkspaceOpen && selectedModule === 'audio' ? (
                    <section className="rounded-[24px] border border-slate-200 bg-white p-6">
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-tide">Modulo ativo</p>
                      <h3 className="mt-2 text-xl font-semibold text-slateink">Sonorizacao</h3>
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                        Este modulo consome a base calibrada do pavimento para posicionar caixas, organizar zonas de
                        audio e definir a leitura inicial do amplificador por ambiente.
                      </p>
                    </section>
                  ) : null}
                </section>
              ) : null}
            </section>
          ) : null}

          {projectStage === 'module' && moduleWorkspaceOpen && selectedModule === 'wifi' && visibleAnalysisItems.length > 0 ? (
            <ResultPanel
              items={visibleAnalysisItems}
              running={analysis.running}
              onReset={resetAll}
              plans={plans}
              onModeChange={handleModeChange}
              onPendingLineChange={handlePendingLineChange}
              onCalibrationApply={handleCalibrationApply}
              onWallAdd={handleWallAdd}
              onWallDelete={handleWallDelete}
              onWallMaterialChange={handleWallMaterialChange}
              onAccessPointMove={handleAccessPointMove}
              onAccessPointDelete={handleAccessPointDelete}
              onAccessPointAdd={handleAccessPointAdd}
              onMetricsChange={handleMetricsChange}
              onPerimeterChange={handlePerimeterChange}
              onAreaCalibrationApply={handleAreaCalibrationApply}
              onBoardSnapshotChange={(pageNum, dataUrl) => handleModuleSnapshotChange('wifi', pageNum, dataUrl)}
            />
          ) : null}

          {projectStage === 'module' && moduleWorkspaceOpen && selectedModule === 'cctv' && activeModulePage ? (
            <CameraPlannerPanel
              pages={[activeModulePage]}
              plans={plans}
              onCameraAdd={handleCameraAdd}
              onCameraMove={handleCameraMove}
              onCameraUpdate={handleCameraUpdate}
              onCameraDelete={handleCameraDelete}
              onSnapshotChange={handleCctvSnapshotChange}
            />
          ) : null}

          {projectStage === 'module' && moduleWorkspaceOpen && selectedModule === 'audio' && activeModulePage ? (
            <Suspense
              fallback={
                <section className="rounded-[24px] border border-slate-200 bg-white p-6 text-sm text-slate-500">
                  Carregando modulo de sonorizacao...
                </section>
              }
            >
              <AudioPlannerPanel
                pages={[activeModulePage]}
                plans={plans}
                onSpeakerAdd={handleSpeakerAdd}
                onSpeakerMove={handleSpeakerMove}
                onSpeakerUpdate={handleSpeakerUpdate}
                onSpeakerRotate={handleSpeakerRotate}
                onSpeakerDelete={handleSpeakerDelete}
                onAudioTvAdd={handleAudioTvAdd}
                onAudioTvMove={handleAudioTvMove}
                onAudioTvDelete={handleAudioTvDelete}
                onSpeakerAlign={handleSpeakerAlign}
                onAudioSystemCreate={handleAudioSystemCreate}
                onAudioSystemPatch={handleAudioSystemPatch}
                onAudioSystemDelete={handleAudioSystemDelete}
                onAudioZoneCreate={handleAudioZoneCreate}
                onAudioZonePatch={handleAudioZonePatch}
                onAudioZoneDelete={handleAudioZoneDelete}
                onDistributeAudioZone={handleDistributeAudioZone}
                onSnapshotChange={handleAudioSnapshotChange}
              />
            </Suspense>
          ) : null}

          {projectStage === 'module' && plantsSetupSaved && hasAnySavedModule ? (
            <section className="rounded-[24px] border border-slate-200 bg-white p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-tide">Relatorio</p>
              <h3 className="mt-2 text-xl font-semibold text-slateink">Exportacao do projeto</h3>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                Pelo menos um modulo ja foi salvo. O botao de exportacao completa fica habilitado daqui para frente.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {isWebAuthEnabled() ? (
                  <button
                    type="button"
                    onClick={() => void handleSaveProjectToLibrary()}
                    className="rounded-2xl bg-tide px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#124f8f]"
                  >
                    Salvar projeto na biblioteca
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setBudgetPreviewOpen(true)}
                  className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-tide hover:text-tide"
                >
                  Visualizar orçamento
                </button>
                <button
                  type="button"
                  onClick={handleExportProjectPdf}
                  className="rounded-2xl border border-tide px-5 py-3 text-sm font-semibold text-tide transition hover:bg-tide/5"
                >
                  Exportar PDF completo
                </button>
              </div>
            </section>
          ) : null}

          {projectStage === 'module' && plantsSetupSaved ? (
            <ExtraBudgetModulesPanel
              modules={extraBudgetModules}
              products={priceCatalog}
              loadingProducts={priceCatalogLoading}
              productsError={priceCatalogError}
              onCreateModule={handleCreateExtraBudgetModule}
              onDeleteModule={handleDeleteExtraBudgetModule}
              onRenameModule={handleRenameExtraBudgetModule}
              onAddItem={handleAddExtraBudgetItem}
              onDeleteItem={handleDeleteExtraBudgetItem}
              onSelectProduct={handleSelectExtraBudgetProduct}
              onQuantityChange={handleChangeExtraBudgetQuantity}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
