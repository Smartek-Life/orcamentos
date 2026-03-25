import type { Dispatch, SetStateAction } from 'react';
import type { EnvType, ProjectModule } from '../types';

interface UseProjectResetParams {
  clearPersistedProject: () => void;
  resetPdf: () => void;
  resetAnalysis: () => void;
  resetSelection: () => void;
  setEnvType: Dispatch<SetStateAction<EnvType>>;
  setSavedModules: Dispatch<SetStateAction<Partial<Record<ProjectModule, boolean>>>>;
  resetWorkflowState: (module?: ProjectModule) => void;
  resetModuleDraftSnapshots: () => void;
  setPlans: Dispatch<SetStateAction<Record<number, any>>>;
}

export function useProjectReset({
  clearPersistedProject,
  resetPdf,
  resetAnalysis,
  resetSelection,
  setEnvType,
  setSavedModules,
  resetWorkflowState,
  resetModuleDraftSnapshots,
  setPlans,
}: UseProjectResetParams) {
  const resetAll = () => {
    clearPersistedProject();
    resetPdf();
    resetAnalysis();
    resetSelection();
    setEnvType('residencial');
    setSavedModules({});
    resetWorkflowState();
    resetModuleDraftSnapshots();
    setPlans({});
  };

  const prepareForNewFile = () => {
    clearPersistedProject();
    resetAnalysis();
    resetSelection();
    setSavedModules({});
    resetWorkflowState();
    resetModuleDraftSnapshots();
    setPlans({});
  };

  return {
    resetAll,
    prepareForNewFile,
  };
}
