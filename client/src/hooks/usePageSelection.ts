import { useState } from 'react';

interface UsePageSelectionParams {
  onSelectionChange?: () => void;
}

export function usePageSelection({ onSelectionChange }: UsePageSelectionParams = {}) {
  const [selectedPages, setSelectedPages] = useState<number[]>([]);

  const togglePage = (pageNum: number) => {
    onSelectionChange?.();
    setSelectedPages((current) =>
      current.includes(pageNum)
        ? current.filter((value) => value !== pageNum)
        : [...current, pageNum].sort((a, b) => a - b),
    );
  };

  const selectAll = (pageNums: number[]) => {
    onSelectionChange?.();
    setSelectedPages(pageNums);
  };

  const clearSelection = () => {
    onSelectionChange?.();
    setSelectedPages([]);
  };

  const resetSelection = () => {
    setSelectedPages([]);
  };

  return {
    selectedPages,
    setSelectedPages,
    togglePage,
    selectAll,
    clearSelection,
    resetSelection,
  };
}
