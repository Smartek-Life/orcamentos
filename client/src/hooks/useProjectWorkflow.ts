import { useMemo, useState } from 'react';
import { getModuleBoardStatus, getSavedModuleBoard } from '../lib/planState';
import type { AnalysisStateItem, EditablePlan, PdfPage, PersistedProjectState, ProjectModule, ProjectStage } from '../types';

interface UseProjectWorkflowParams {
  pages: PdfPage[];
  selectedPages: number[];
  plans: Record<number, EditablePlan>;
  analysisItems: AnalysisStateItem[];
  savedModules: Partial<Record<ProjectModule, boolean>>;
}

export function useProjectWorkflow({
  pages,
  selectedPages,
  plans,
  analysisItems,
  savedModules,
}: UseProjectWorkflowParams) {
  const [projectStage, setProjectStage] = useState<ProjectStage>('select');
  const [plantsSetupSaved, setPlantsSetupSaved] = useState(false);
  const [moduleWorkspaceOpen, setModuleWorkspaceOpen] = useState(false);
  const [activeModulePageNum, setActiveModulePageNum] = useState<number | null>(null);
  const [selectedModule, setSelectedModule] = useState<ProjectModule>('wifi');

  const selectedPageObjects = useMemo(
    () => pages.filter((page) => selectedPages.includes(page.pageNum)),
    [pages, selectedPages],
  );

  const preparedPages = useMemo(
    () => selectedPageObjects.filter((page) => plans[page.pageNum]?.baseReady),
    [plans, selectedPageObjects],
  );

  const moduleActivePages = useMemo(
    () => preparedPages.filter((page) => getModuleBoardStatus(plans[page.pageNum], selectedModule) !== 'skipped'),
    [plans, preparedPages, selectedModule],
  );

  const activeModulePage = useMemo(
    () => preparedPages.find((page) => page.pageNum === activeModulePageNum) ?? null,
    [activeModulePageNum, preparedPages],
  );

  const allSelectedPagesPrepared =
    selectedPageObjects.length > 0 &&
    selectedPageObjects.every((page) => {
      const plan = plans[page.pageNum];
      return Boolean(plan?.baseReady && plan.floorLabel.trim());
    });

  const allModulePagesResolved =
    preparedPages.length > 0 &&
    preparedPages.every((page) => {
      const status = getModuleBoardStatus(plans[page.pageNum], selectedModule);
      return status === 'saved' || status === 'skipped';
    });

  const visibleAnalysisItems = useMemo(
    () =>
      analysisItems.filter((item) => {
        if (!moduleActivePages.some((page) => page.pageNum === item.pageNum)) {
          return false;
        }
        return item.pageNum === activeModulePageNum;
      }),
    [activeModulePageNum, analysisItems, moduleActivePages],
  );

  const hasAnySavedModule = useMemo(() => Object.values(savedModules).some(Boolean), [savedModules]);

  const savedWifiBoards = useMemo(
    () =>
      selectedPageObjects
        .map((page) => ({ page, plan: plans[page.pageNum] }))
        .filter((entry) => Boolean(getSavedModuleBoard(entry.plan, 'wifi'))),
    [plans, selectedPageObjects],
  );

  const moveToSelectStage = () => {
    setPlantsSetupSaved(false);
    setModuleWorkspaceOpen(false);
    setActiveModulePageNum(null);
    setProjectStage('select');
  };

  const moveToPrepareStage = () => {
    setPlantsSetupSaved(false);
    setModuleWorkspaceOpen(false);
    setActiveModulePageNum(null);
    setProjectStage('prepare');
  };

  const handleConfirmSelectedPages = () => {
    if (selectedPages.length === 0) {
      return;
    }
    moveToPrepareStage();
  };

  const handleSavePlantConfigurations = () => {
    if (!allSelectedPagesPrepared) {
      return;
    }
    setPlantsSetupSaved(true);
    setProjectStage('module');
    setModuleWorkspaceOpen(false);
    setActiveModulePageNum(null);
  };

  const handleModuleSelect = (module: ProjectModule) => {
    setSelectedModule(module);
    setModuleWorkspaceOpen(true);
    setActiveModulePageNum(null);
  };

  const hydrateWorkflow = (persisted: PersistedProjectState) => {
    setSelectedModule(persisted.selectedModule);
    setProjectStage(persisted.projectStage ?? 'select');
    setPlantsSetupSaved(persisted.plantsSetupSaved ?? false);
    setModuleWorkspaceOpen(false);
    setActiveModulePageNum(null);
  };

  const resetWorkflowState = (module: ProjectModule = 'wifi') => {
    setProjectStage('select');
    setPlantsSetupSaved(false);
    setSelectedModule(module);
    setModuleWorkspaceOpen(false);
    setActiveModulePageNum(null);
  };

  return {
    projectStage,
    plantsSetupSaved,
    moduleWorkspaceOpen,
    activeModulePageNum,
    selectedModule,
    setProjectStage,
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
  };
}
