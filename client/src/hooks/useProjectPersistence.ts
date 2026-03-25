import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  EditablePlan,
  EnvType,
  CommercialBudgetSection,
  ExtraBudgetModule,
  PdfPage,
  PersistedProjectState,
  ProjectModule,
  ProjectStage,
} from '../types';
import { buildProjectKey, clearProjectState, loadProjectState, saveProjectState } from '../lib/projectStorage';

interface UseProjectPersistenceParams {
  fileName: string;
  fileSize: number;
  fileFingerprint: string | null;
  pages: PdfPage[];
  enableAutoHydrate?: boolean;
  autoSaveEnabled?: boolean;
  projectStage: ProjectStage;
  plantsSetupSaved: boolean;
  selectedPages: number[];
  envType: EnvType;
  selectedModule: ProjectModule;
  savedModules: Partial<Record<ProjectModule, boolean>>;
  plans: Record<number, EditablePlan>;
  extraBudgetModules: ExtraBudgetModule[];
  commercialBudgetSections: CommercialBudgetSection[];
  onHydrate: (persisted: PersistedProjectState) => void;
}

export function useProjectPersistence({
  fileName,
  fileSize,
  fileFingerprint,
  pages,
  enableAutoHydrate = false,
  autoSaveEnabled = true,
  projectStage,
  plantsSetupSaved,
  selectedPages,
  envType,
  selectedModule,
  savedModules,
  plans,
  extraBudgetModules,
  commercialBudgetSections,
  onHydrate,
}: UseProjectPersistenceParams) {
  const [hydrationDone, setHydrationDone] = useState(false);
  const saveErrorShownRef = useRef(false);
  const loadErrorShownRef = useRef(false);
  const hydrateRef = useRef(onHydrate);

  useEffect(() => {
    hydrateRef.current = onHydrate;
  }, [onHydrate]);

  const projectKey = useMemo(() => {
    if (pages.length === 0) {
      return null;
    }

    return fileFingerprint || buildProjectKey(fileName, fileSize, pages.length);
  }, [fileFingerprint, fileName, fileSize, pages.length]);

  useEffect(() => {
    let cancelled = false;

    if (!enableAutoHydrate || !projectKey || pages.length === 0) {
      setHydrationDone(false);
      return;
    }

    setHydrationDone(false);
    loadErrorShownRef.current = false;

    void (async () => {
      try {
        const persisted = await loadProjectState(projectKey);
        if (cancelled) {
          return;
        }

        if (persisted) {
          hydrateRef.current(persisted);
        }
      } catch (error) {
        if (!cancelled && !loadErrorShownRef.current) {
          loadErrorShownRef.current = true;
          window.alert(error instanceof Error ? error.message : 'Falha ao carregar o projeto salvo.');
        }
      } finally {
        if (!cancelled) {
          setHydrationDone(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enableAutoHydrate, pages.length, projectKey]);

  useEffect(() => {
    if (!enableAutoHydrate && pages.length > 0) {
      setHydrationDone(true);
    }
  }, [enableAutoHydrate, pages.length]);

  useEffect(() => {
    if (!autoSaveEnabled || !projectKey || pages.length === 0 || !hydrationDone) {
      return;
    }

    void (async () => {
      try {
        await persistCurrentState();
        saveErrorShownRef.current = false;
      } catch (error) {
        if (!saveErrorShownRef.current) {
          saveErrorShownRef.current = true;
          window.alert(error instanceof Error ? error.message : 'Falha ao salvar o projeto.');
        }
      }
    })();
  }, [
    autoSaveEnabled,
    envType,
    fileName,
    fileFingerprint,
    fileSize,
    hydrationDone,
    pages.length,
    plans,
    plantsSetupSaved,
    projectKey,
    projectStage,
    savedModules,
    selectedModule,
    selectedPages,
    extraBudgetModules,
    commercialBudgetSections,
  ]);

  const persistCurrentState = async () => {
    if (!projectKey || pages.length === 0) {
      return { skipped: true } as const;
    }

    return saveProjectState({
      projectKey,
      fileName,
      fileSize,
      fileHash: fileFingerprint ?? undefined,
      projectStage,
      plantsSetupSaved,
      selectedPages,
      envType,
      selectedModule,
      savedModules,
      plans,
      extraBudgetModules,
      commercialBudgetSections,
      updatedAt: new Date().toISOString(),
    });
  };

  const clearPersistedProject = () => {
    if (!projectKey) {
      return;
    }
    void clearProjectState(projectKey).catch((error) => {
      window.alert(error instanceof Error ? error.message : 'Falha ao limpar o projeto salvo.');
    });
  };

  return {
    projectKey,
    clearPersistedProject,
    saveProjectNow: persistCurrentState,
  };
}
