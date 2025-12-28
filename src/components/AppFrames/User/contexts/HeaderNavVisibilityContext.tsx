"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

export type HeaderNavVisibility = {
  sp: boolean;
  pc: boolean;
};

type HeaderNavVisibilityContextValue = {
  visibility: HeaderNavVisibility;
  setVisibility: (visibility: Partial<HeaderNavVisibility>) => void;
  reset: () => void;
};

const DEFAULT_VISIBILITY: HeaderNavVisibility = {
  sp: true,
  pc: true,
};

const HeaderNavVisibilityContext =
  createContext<HeaderNavVisibilityContextValue | null>(null);

export const HeaderNavVisibilityProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [visibility, setVisibilityState] =
    useState<HeaderNavVisibility>(DEFAULT_VISIBILITY);

  const setVisibility = useCallback((partial: Partial<HeaderNavVisibility>) => {
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
    <HeaderNavVisibilityContext.Provider value={value}>
      {children}
    </HeaderNavVisibilityContext.Provider>
  );
};

export const useHeaderNavVisibility = (): HeaderNavVisibilityContextValue => {
  const context = useContext(HeaderNavVisibilityContext);
  if (!context) {
    throw new Error(
      "useHeaderNavVisibility must be used within HeaderNavVisibilityProvider"
    );
  }
  return context;
};
