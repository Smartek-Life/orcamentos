import { useState } from 'react';
import { createEmptyModuleSnapshots } from '../lib/planState';
import type { ProjectModule } from '../types';

export function useModuleDraftSnapshots() {
  const [moduleDraftSnapshots, setModuleDraftSnapshots] = useState(createEmptyModuleSnapshots);

  const resetModuleDraftSnapshots = () => {
    setModuleDraftSnapshots(createEmptyModuleSnapshots());
  };

  const setModuleSnapshot = (module: ProjectModule, pageNum: number, dataUrl: string) => {
    setModuleDraftSnapshots((current) => ({
      ...current,
      [module]: {
        ...current[module],
        [pageNum]: dataUrl,
      },
    }));
  };

  const clearModuleSnapshot = (module: ProjectModule, pageNum: number) => {
    setModuleDraftSnapshots((current) => ({
      ...current,
      [module]: Object.fromEntries(
        Object.entries(current[module]).filter(([key]) => Number(key) !== pageNum),
      ),
    }));
  };

  return {
    moduleDraftSnapshots,
    resetModuleDraftSnapshots,
    setModuleSnapshot,
    clearModuleSnapshot,
  };
}
