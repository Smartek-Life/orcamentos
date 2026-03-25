import { useCallback, useMemo, useState } from 'react';
import type {
  AnalysisStateItem,
  PdfPage,
  ProjectConfig,
} from '../types';
import { analyzeFloorLocally } from '../lib/planner';

export function useAnalysis() {
  const [items, setItems] = useState<AnalysisStateItem[]>([]);
  const [running, setRunning] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setItems([]);
    setRunning(false);
    setGlobalError(null);
  }, []);

  const analyzePages = useCallback(async (pages: PdfPage[], config: ProjectConfig) => {
    const sortedPages = pages.slice().sort((a, b) => a.pageNum - b.pageNum);

    setRunning(true);
    setGlobalError(null);
    setItems(
      sortedPages.map((page) => ({
        pageNum: page.pageNum,
        pageImageBase64: page.hiResBase64,
        status: 'loading',
      })),
    );

    const settled = await Promise.allSettled(
      sortedPages.map(async (page) => {
        try {
          const result = await analyzeFloorLocally(page, config.envType);
          setItems((current) =>
            current.map((item) =>
              item.pageNum === page.pageNum
                ? {
                    ...item,
                    status: 'success',
                    result,
                    error: undefined,
                  }
                : item,
            ),
          );
          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erro desconhecido na análise.';
          setItems((current) =>
            current.map((item) =>
              item.pageNum === page.pageNum
                ? {
                    ...item,
                    status: 'error',
                    error: message,
                  }
                : item,
            ),
          );
          throw error;
        }
      }),
    );

    if (settled.every((item) => item.status === 'rejected')) {
      setGlobalError('Nenhuma planta foi processada com sucesso. Revise o PDF e tente novamente.');
    }

    setRunning(false);
  }, []);

  const summary = useMemo(() => {
    const successCount = items.filter((item) => item.status === 'success').length;
    const errorCount = items.filter((item) => item.status === 'error').length;
    const loadingCount = items.filter((item) => item.status === 'loading').length;
    return { successCount, errorCount, loadingCount };
  }, [items]);

  return {
    items,
    running,
    globalError,
    summary,
    analyzePages,
    reset,
  };
}
