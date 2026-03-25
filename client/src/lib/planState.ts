import type {
  EditablePlan,
  ModuleProgressStatus,
  PdfPage,
  PlanModuleBoards,
  ProjectModule,
  SavedModuleBoard,
} from '../types';

export function createEmptyModuleSnapshots() {
  return {
    wifi: {} as Record<number, string>,
    audio: {} as Record<number, string>,
    cctv: {} as Record<number, string>,
  };
}

export function createDefaultModuleBoards(): PlanModuleBoards {
  return {
    wifi: { status: 'idle' },
    audio: { status: 'idle' },
    cctv: { status: 'idle' },
  };
}

export function createEmptyPlan(page: PdfPage): EditablePlan {
  return {
    pageNum: page.pageNum,
    floorLabel: `Planta ${page.pageNum}`,
    baseReady: false,
    moduleBoards: createDefaultModuleBoards(),
    pixelWidth: page.width,
    pixelHeight: page.height,
    mode: 'view',
    metersPerPixel: null,
    calibrationLine: null,
    pendingLine: null,
    walls: [],
    accessPoints: [],
    cameras: [],
    speakers: [],
    audioSystems: [],
    audioZones: [],
    audioTvPoints: [],
    detectedAreaM2: null,
    dynamicCoveragePercent: null,
    perimeterPoints: [],
    calibratedAreaM2: null,
  };
}

export function normalizePlan(page: PdfPage, plan?: EditablePlan): EditablePlan {
  const fallback = createEmptyPlan(page);
  if (!plan) {
    return fallback;
  }

  const legacyPlan = plan as EditablePlan & {
    moduleState?: Partial<Record<ProjectModule, ModuleProgressStatus | 'done'>>;
    savedBoards?: Partial<Record<ProjectModule, SavedModuleBoard>>;
    moduleBoards?: Partial<PlanModuleBoards>;
  };

  const nextModuleBoards = createDefaultModuleBoards();

  (['wifi', 'audio', 'cctv'] as const).forEach((module) => {
    const legacyBoard = legacyPlan.savedBoards?.[module];
    const legacyStatus = legacyPlan.moduleState?.[module];
    const normalizedStatus: ModuleProgressStatus =
      legacyPlan.moduleBoards?.[module]?.status ??
      (legacyStatus === 'done' ? 'saved' : legacyStatus) ??
      (legacyBoard ? 'saved' : 'idle');

    nextModuleBoards[module] = {
      status: normalizedStatus,
      board: legacyPlan.moduleBoards?.[module]?.board ?? legacyBoard,
    };
  });

  return {
    ...fallback,
    ...plan,
    pixelWidth: page.width,
    pixelHeight: page.height,
    floorLabel: plan.floorLabel?.trim() ? plan.floorLabel : fallback.floorLabel,
    baseReady: plan.baseReady ?? false,
    moduleBoards: nextModuleBoards,
    cameras: (plan.cameras ?? []).map((camera) => ({
      ...camera,
      profile: camera.profile ?? '1220d',
    })),
    speakers: plan.speakers ?? [],
    audioSystems: plan.audioSystems ?? [],
    audioZones: plan.audioZones ?? [],
    audioTvPoints: plan.audioTvPoints ?? [],
  };
}

export function getModuleBoardStatus(plan: EditablePlan | undefined, module: ProjectModule): ModuleProgressStatus {
  return plan?.moduleBoards[module]?.status ?? 'idle';
}

export function getSavedModuleBoard(plan: EditablePlan | undefined, module: ProjectModule): SavedModuleBoard | undefined {
  const slot = plan?.moduleBoards[module];
  return slot?.status === 'saved' ? slot.board : undefined;
}

export function getNextAvailableModule(
  currentModule: ProjectModule,
  savedModules: Partial<Record<ProjectModule, boolean>>,
) {
  return (['wifi', 'cctv', 'audio'] as const).find((module) => module !== currentModule && !savedModules[module]) ?? null;
}
