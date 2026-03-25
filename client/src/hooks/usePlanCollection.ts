import { useCallback, useEffect, useState } from 'react';
import { normalizePlan } from '../lib/planState';
import type { EditablePlan, PdfPage } from '../types';

export function usePlanCollection(pages: PdfPage[]) {
  const [plans, setPlans] = useState<Record<number, EditablePlan>>({});

  useEffect(() => {
    if (pages.length === 0) {
      setPlans({});
      return;
    }

    setPlans((current) => {
      const next: Record<number, EditablePlan> = {};
      pages.forEach((page) => {
        next[page.pageNum] = normalizePlan(page, current[page.pageNum]);
      });
      return next;
    });
  }, [pages]);

  const updatePlan = useCallback(
    (pageNum: number, updater: (plan: EditablePlan) => EditablePlan) => {
      const page = pages.find((item) => item.pageNum === pageNum);
      if (!page) {
        return;
      }

      setPlans((current) => ({
        ...current,
        [pageNum]: updater(normalizePlan(page, current[pageNum])),
      }));
    },
    [pages],
  );

  return {
    plans,
    setPlans,
    updatePlan,
  };
}
