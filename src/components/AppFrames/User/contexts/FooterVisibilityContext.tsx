"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

export type FooterVisibility = {
  sp: boolean;
  pc: boolean;
};

type FooterVisibilityContextValue = {
  visibility: FooterVisibility;
  setVisibility: (visibility: Partial<FooterVisibility>) => void;
  reset: () => void;
};

const DEFAULT_VISIBILITY: FooterVisibility = {
  sp: true,
  pc: true,
};

const FooterVisibilityContext =
  createContext<FooterVisibilityContextValue | null>(null);

export const FooterVisibilityProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [visibility, setVisibilityState] =
    useState<FooterVisibility>(DEFAULT_VISIBILITY);

  const setVisibility = useCallback((partial: Partial<FooterVisibility>) => {
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
    <FooterVisibilityContext.Provider value={value}>
      {children}
    </FooterVisibilityContext.Provider>
  );
};

export const useFooterVisibility = (): FooterVisibilityContextValue => {
  const context = useContext(FooterVisibilityContext);
  if (!context) {
    throw new Error(
      "useFooterVisibility must be used within FooterVisibilityProvider"
    );
  }
  return context;
};
