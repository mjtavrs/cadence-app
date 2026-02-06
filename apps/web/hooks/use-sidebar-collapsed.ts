"use client";

import { useLocalStorageState } from "./use-local-storage-state";

const KEY = "cadence.sidebar.collapsed";

export function useSidebarCollapsed() {
  const { value, setValue, hydrated } = useLocalStorageState<boolean>(KEY, false);
  return {
    collapsed: value,
    setCollapsed: setValue,
    hydrated,
    toggle: () => setValue((v) => !v),
  } as const;
}

