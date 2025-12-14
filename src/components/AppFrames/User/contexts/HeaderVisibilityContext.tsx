"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

export type HeaderVisibility = {
  sp: boolean;
  pc: boolean;
};

type HeaderVisibilityContextValue = {
  visibility: HeaderVisibility;
  setVisibility: (visibility: Partial<HeaderVisibility>) => void;
  reset: () => void;
};

const DEFAULT_VISIBILITY: HeaderVisibility = {
  sp: true,
  pc: true,
};

const HeaderVisibilityContext =
  createContext<HeaderVisibilityContextValue | null>(null);

export const HeaderVisibilityProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [visibility, setVisibilityState] =
    useState<HeaderVisibility>(DEFAULT_VISIBILITY);

  const setVisibility = useCallback((partial: Partial<HeaderVisibility>) => {
    setVisibilityState((prev) => ({ ...prev, ...partial }));
  }, []);

  const reset = useCallback(() => {
    setVisibilityState(DEFAULT_VISIBILITY);
  }, []);

  const value = useMemo(
    () => ({ visibility, setVisibility, reset }),
    [visibility, setVisibility, reset]
  );

  return (
    <HeaderVisibilityContext.Provider value={value}>
      {children}
    </HeaderVisibilityContext.Provider>
  );
};

export const useHeaderVisibility = (): HeaderVisibilityContextValue => {
  const context = useContext(HeaderVisibilityContext);
  if (!context) {
    throw new Error(
      "useHeaderVisibility must be used within HeaderVisibilityProvider"
    );
  }
  return context;
};
