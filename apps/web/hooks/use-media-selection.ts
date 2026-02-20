"use client";

import { useState, useCallback, useRef, useEffect } from "react";

type SelectionMode = "normal" | "add" | "range";

export function useMediaSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("normal");
  const lastSelectedIdRef = useRef<string | null>(null);
  const isSelectingRef = useRef(false);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastSelectedIdRef.current = null;
  }, []);

  const toggleSelection = useCallback((id: string, mode: SelectionMode = "normal") => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (mode === "add") {
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
      } else if (mode === "range" && lastSelectedIdRef.current) {
        // Range selection será implementado no componente que conhece a ordem dos itens
        newSet.add(id);
      } else {
        newSet.clear();
        newSet.add(id);
      }
      return newSet;
    });
    lastSelectedIdRef.current = id;
  }, []);

  const selectRange = useCallback((startId: string, endId: string, allIds: string[]) => {
    const startIndex = allIds.indexOf(startId);
    const endIndex = allIds.indexOf(endId);
    if (startIndex === -1 || endIndex === -1) return;

    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    const rangeIds = allIds.slice(minIndex, maxIndex + 1);

    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      rangeIds.forEach((id) => newSet.add(id));
      return newSet;
    });
    lastSelectedIdRef.current = endId;
  }, []);

  const selectAll = useCallback((allIds: string[]) => {
    setSelectedIds(new Set(allIds));
  }, []);

  const startSelection = useCallback((x: number, y: number, mode: SelectionMode = "normal") => {
    isSelectingRef.current = true;
    setIsSelecting(true);
    setSelectionStart({ x, y });
    setSelectionEnd({ x, y });
    setSelectionMode(mode);
    if (mode === "normal") {
      clearSelection();
    }
  }, [clearSelection]);

  const updateSelection = useCallback((x: number, y: number) => {
    if (isSelectingRef.current) {
      setSelectionEnd({ x, y });
    }
  }, []);

  const endSelection = useCallback(() => {
    isSelectingRef.current = false;
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearSelection]);

  const updateSelectedIds = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    setSelectedIds(updater);
  }, []);

  return {
    selectedIds,
    updateSelectedIds,
    isSelecting,
    selectionStart,
    selectionEnd,
    selectionMode,
    clearSelection,
    toggleSelection,
    selectRange,
    selectAll,
    startSelection,
    updateSelection,
    endSelection,
  };
}
