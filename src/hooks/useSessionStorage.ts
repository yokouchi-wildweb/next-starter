"use client";

import { useMemo } from "react";

export type SessionStorageHandler = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  exists: (key: string) => boolean;
};

export const useSessionStorage = (): SessionStorageHandler => {
  return useMemo(
    () => ({
      getItem: (key: string) => {
        if (typeof window === "undefined") return null;
        return window.sessionStorage.getItem(key);
      },
      setItem: (key: string, value: string) => {
        if (typeof window === "undefined") return;
        window.sessionStorage.setItem(key, value);
      },
      removeItem: (key: string) => {
        if (typeof window === "undefined") return;
        window.sessionStorage.removeItem(key);
      },
      clear: () => {
        if (typeof window === "undefined") return;
        window.sessionStorage.clear();
      },
      exists: (key: string) => {
        if (typeof window === "undefined") return false;
        return window.sessionStorage.getItem(key) !== null;
      },
    }),
    [],
  );
};

